using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json.Nodes;
using Backend.Controllers;
using Backend.Data;
using Backend.Models;
using Backend.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.FileProviders;
using System.Threading.RateLimiting;

internal sealed class CapturedEmail : IPasswordResetEmailSender
{
    public bool IsConfigured { get; set; } = true;
    public bool Fail { get; set; }
    public List<(string Email, string Url)> Messages { get; } = [];
    public Task SendAsync(string email, string url, CancellationToken cancellationToken)
    {
        if (Fail) throw new HttpRequestException("simulated provider failure", null, HttpStatusCode.Forbidden);
        Messages.Add((email, url));
        return Task.CompletedTask;
    }
}

internal sealed class EmailApiStub : HttpMessageHandler
{
    public HttpStatusCode Status { get; set; } = HttpStatusCode.OK;
    public string Payload { get; private set; } = "";
    public string Authorization { get; private set; } = "";
    public Uri? Target { get; private set; }
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Payload = await request.Content!.ReadAsStringAsync(cancellationToken);
        Authorization = request.Headers.Authorization!.ToString(); Target = request.RequestUri;
        return new HttpResponseMessage(Status) { Content = JsonContent.Create(new { id = "local-captured-email" }) };
    }
}

internal sealed class EmailTestEnvironment(string root, string environment) : IWebHostEnvironment
{
    public string EnvironmentName { get; set; } = environment;
    public string ApplicationName { get; set; } = "Test";
    public string WebRootPath { get; set; } = Path.Combine(root, "wwwroot");
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    public string ContentRootPath { get; set; } = root;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}

internal static class PasswordRecoveryChecks
{
    private static void Check(bool value, string label) { if (!value) throw new Exception(label); }
    public static async Task Main()
    {
        var root = Path.Combine(Path.GetTempPath(), "n9-recovery-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        using var rsa = RSA.Create(2048);
        var request = new CertificateRequest("CN=localhost", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        var san = new SubjectAlternativeNameBuilder(); san.AddIpAddress(IPAddress.Loopback); san.AddDnsName("localhost");
        request.CertificateExtensions.Add(san.Build());
        using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow.AddHours(1));
        await using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { ContentRootPath = root, EnvironmentName = "Development" });
        builder.Logging.ClearProviders();
        builder.WebHost.ConfigureKestrel(o => o.Listen(IPAddress.Loopback, 0, listen => listen.UseHttps(certificate)));
        builder.Services.AddDbContext<ShopDbContext>(o => o.UseSqlite(connection));
        builder.Services.AddDataProtection().UseEphemeralDataProtectionProvider();
        builder.Services.AddIdentity<ShopUser, IdentityRole>(o => { o.User.RequireUniqueEmail = true; o.Password.RequiredLength = 8; })
            .AddEntityFrameworkStores<ShopDbContext>().AddDefaultTokenProviders();
        builder.Services.ConfigureApplicationCookie(o => {
            o.Cookie.SecurePolicy = Microsoft.AspNetCore.Http.CookieSecurePolicy.Always;
            o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
            o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
        });
        builder.Services.Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.Zero);
        builder.Services.Configure<DataProtectionTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromMinutes(30));
        builder.Services.AddAntiforgery(o => o.HeaderName = "X-CSRF-TOKEN");
        builder.Services.AddControllersWithViews(o => o.Filters.Add(new AutoValidateAntiforgeryTokenAttribute()))
            .AddApplicationPart(typeof(PasswordRecoveryController).Assembly);
        builder.Services.AddRateLimiter(o => {
            o.RejectionStatusCode = 429;
            o.AddPolicy("auth", c => RateLimitPartition.GetFixedWindowLimiter("test-auth", _ => new FixedWindowRateLimiterOptions { PermitLimit = 100, Window = TimeSpan.FromMinutes(15) }));
            o.AddPolicy("recovery", c => RateLimitPartition.GetFixedWindowLimiter(c.Request.Headers["X-Test-Bucket"].ToString(), _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(15) }));
        });
        var mail = new CapturedEmail();
        builder.Services.AddSingleton<IPasswordResetEmailSender>(mail);
        builder.Services.AddSingleton<RecoveryCooldown>();
        builder.Services.Configure<PasswordResetOptions>(o => o.PublicUrl = "https://n9studio.onrender.com");
        builder.Services.AddScoped<PasswordRecoveryService>();
        var app = builder.Build();
        app.UseRouting(); app.UseRateLimiter(); app.UseAuthentication(); app.UseAuthorization(); app.MapControllers();
        await using (var scope = app.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>(); await db.Database.EnsureCreatedAsync();
            var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
            Check((await roles.CreateAsync(new IdentityRole("Admin"))).Succeeded, "Create Admin role");
            Check((await roles.CreateAsync(new IdentityRole("Customer"))).Succeeded, "Create Customer role");
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ShopUser>>();
            foreach (var email in new[] { "admin@example.com", "other@example.com", "expire@example.com", "provider-error@example.com" })
            {
                var user = new ShopUser { UserName = email, Email = email, FullName = "Test", LockoutEnabled = true };
                Check((await users.CreateAsync(user, "Old@2026")).Succeeded, "Create test user");
                Check((await users.AddToRoleAsync(user, email.StartsWith("admin") ? "Admin" : "Customer")).Succeeded, "Assign role");
            }
        }
        await app.StartAsync();
        try
        {
            var address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
            HttpClient Client() => new(new HttpClientHandler {
                UseProxy = false, AllowAutoRedirect = false,
                ServerCertificateCustomValidationCallback = (_, cert, _, _) => cert?.Thumbprint == certificate.Thumbprint
            }) { BaseAddress = new Uri(address) };
            using var client = Client(); using var oldSession = Client();
            var bucket = 0;
            async Task<HttpResponseMessage> Post(string path, object body, bool csrf = true, HttpClient? target = null)
            {
                var c = target ?? client;
                using var req = new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(body) };
                req.Headers.Add("X-Test-Bucket", (++bucket).ToString());
                if (csrf)
                {
                    var token = (await c.GetFromJsonAsync<JsonObject>("/api/tai-khoan/csrf"))!["token"]!.GetValue<string>();
                    req.Headers.Add("X-CSRF-TOKEN", token);
                }
                return await c.SendAsync(req);
            }
            const string forgot = "/api/tai-khoan/quen-mat-khau", reset = "/api/tai-khoan/dat-lai-mat-khau";
            Check((await Post(forgot, new { email = "admin@example.com" }, false)).StatusCode == HttpStatusCode.BadRequest, "Forgot requires CSRF");
            Check((await Post(reset, new { email = "admin@example.com", code = "x", newPassword = "New@2026", confirmPassword = "New@2026" }, false)).StatusCode == HttpStatusCode.BadRequest, "Reset requires CSRF");
            Check((await Post(forgot, new { email = "not-an-email" })).StatusCode == HttpStatusCode.BadRequest, "Email validation");
            var known = await Post(forgot, new { email = "admin@example.com" });
            var unknown = await Post(forgot, new { email = "unknown@example.com" });
            Check(known.StatusCode == HttpStatusCode.Accepted && unknown.StatusCode == HttpStatusCode.Accepted, "Public recovery requests accepted");
            var knownBody = await known.Content.ReadAsStringAsync();
            Check(knownBody == await unknown.Content.ReadAsStringAsync(), "No email enumeration response");
            Check(!knownBody.Contains("code") && !knownBody.Contains("token"), "Token never returned by API");
            Check(mail.Messages.Count == 1, "Only existing account receives email");
            await Post(forgot, new { email = "ADMIN@example.com" }); Check(mail.Messages.Count == 1, "Cooldown ignores email case");
            var sent = new Uri(mail.Messages.Single().Url);
            Check(sent.GetLeftPart(UriPartial.Authority) == "https://n9studio.onrender.com" && sent.Query == "", "Trusted URL and fragment token");
            var fragment = QueryHelpers.ParseQuery(sent.Fragment[1..]); var code = fragment["code"].ToString();
            object Reset(string email, string token, string password = "New@2026", string? confirm = null) => new { email, code = token, newPassword = password, confirmPassword = confirm ?? password };
            Check((await Post(reset, Reset("admin@example.com", code, confirm: "Mismatch@2026"))).StatusCode == HttpStatusCode.BadRequest, "Confirm validation");
            Check((await Post(reset, Reset("admin@example.com", code, "weak"))).StatusCode == HttpStatusCode.BadRequest, "Weak password rejected");
            Check((await Post(reset, Reset("other@example.com", code))).StatusCode == HttpStatusCode.BadRequest, "Wrong-account token rejected");
            Check((await Post(reset, Reset("admin@example.com", "***"))).StatusCode == HttpStatusCode.BadRequest, "Malformed token rejected");
            Check((await Post(reset, Reset("admin@example.com", code[..^1] + (code[^1] == 'A' ? "B" : "A")))).StatusCode == HttpStatusCode.BadRequest, "Tampered token rejected");
            Check((await Post("/api/tai-khoan/dang-nhap", new { email = "admin@example.com", password = "Old@2026" }, target: oldSession)).IsSuccessStatusCode, "Old password works before reset");
            Check((await oldSession.GetAsync("/api/tai-khoan/me")).IsSuccessStatusCode, "Secure login cookie established");
            // Resetting a locked account also clears its login lockout.
            await using (var scope = app.Services.CreateAsyncScope())
            {
                var users = scope.ServiceProvider.GetRequiredService<UserManager<ShopUser>>();
                await users.SetLockoutEndDateAsync((await users.FindByEmailAsync("admin@example.com"))!, DateTimeOffset.UtcNow.AddHours(1));
            }
            Check((await Post(reset, Reset("admin@example.com", code))).IsSuccessStatusCode, "Valid reset succeeds");
            Check((await Post(reset, Reset("admin@example.com", code))).StatusCode == HttpStatusCode.BadRequest, "Single-use token");
            Check((await oldSession.GetAsync("/api/tai-khoan/me")).StatusCode == HttpStatusCode.Unauthorized, "Security stamp invalidates prior cookie");
            Check((await Post("/api/tai-khoan/dang-nhap", new { email = "admin@example.com", password = "Old@2026" })).StatusCode == HttpStatusCode.Unauthorized, "Old password rejected after reset");
            Check((await Post("/api/tai-khoan/dang-nhap", new { email = "admin@example.com", password = "New@2026" })).IsSuccessStatusCode, "New password logs in");
            var me = (await client.GetFromJsonAsync<JsonObject>("/api/tai-khoan/me"))!;
            Check(me["roles"]!.AsArray().Any(v => v!.GetValue<string>() == "Admin"), "Admin role preserved");

            await using (var scope = app.Services.CreateAsyncScope())
            {
                var users = scope.ServiceProvider.GetRequiredService<UserManager<ShopUser>>(); var user = (await users.FindByEmailAsync("expire@example.com"))!;
                var opts = scope.ServiceProvider.GetRequiredService<IOptions<DataProtectionTokenProviderOptions>>().Value;
                opts.TokenLifespan = TimeSpan.FromSeconds(-1);
                var expiredCode = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(await users.GeneratePasswordResetTokenAsync(user)));
                Check((await Post(reset, Reset(user.Email!, expiredCode))).StatusCode == HttpStatusCode.BadRequest, "Expired token rejected");
                opts.TokenLifespan = TimeSpan.FromMinutes(30);
                Check(await users.CheckPasswordAsync(user, "Old@2026"), "Failed reset preserves original password");
            }
            mail.IsConfigured = false;
            Check((await Post(forgot, new { email = "admin@example.com" })).StatusCode == HttpStatusCode.ServiceUnavailable, "Missing sender configuration returns 503");
            Check((await Post(forgot, new { email = "another-unknown@example.com" })).StatusCode == HttpStatusCode.ServiceUnavailable, "Missing configuration does not disclose accounts");
            mail.IsConfigured = true; mail.Fail = true;
            Check((await Post(forgot, new { email = "provider-error@example.com" })).StatusCode == HttpStatusCode.Accepted, "Provider errors don't reveal account existence");
            mail.Fail = false;
            using var rateClient = Client();
            var afToken = (await rateClient.GetFromJsonAsync<JsonObject>("/api/tai-khoan/csrf"))!["token"]!.GetValue<string>();
            for (var i = 0; i < 11; i++)
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, forgot) { Content = JsonContent.Create(new { email = "rate@example.com" }) };
                req.Headers.Add("X-CSRF-TOKEN", afToken); req.Headers.Add("X-Test-Bucket", "rate-test");
                Check((int)(await rateClient.SendAsync(req)).StatusCode == (i < 10 ? 202 : 429), "Recovery rate limit");
            }
            // Exercise the real email adapter using an in-memory HTTP handler, never a real provider.
            using var stub = new EmailApiStub(); using var http = new HttpClient(stub);
            var sender = new PasswordResetEmailSender(http, Options.Create(new RecoveryEmailOptions { ApiKey = "not-a-real-key", From = "N9 Studio <sender@example.com>" }), app.Environment);
            Check(sender.IsConfigured, "Resend adapter configuration");
            const string sampleLink = "https://n9studio.onrender.com/GiaoDien/NguoiDung/DatLaiMatKhau/index.html#email=test%40example.com&code=secret-test-code";
            await sender.SendAsync("test@example.com", sampleLink, CancellationToken.None);
            Check(stub.Target!.AbsoluteUri == "https://api.resend.com/emails" && stub.Authorization == "Bearer not-a-real-key", "HTTPS email endpoint and authorization");
            var payload = JsonNode.Parse(stub.Payload)!;
            Check(payload["to"]![0]!.GetValue<string>() == "test@example.com", "Email recipient");
            Check(payload["html"]!.GetValue<string>().Contains("&amp;code=") && payload["text"]!.GetValue<string>().Contains(sampleLink), "Email link HTML encoding and plain text");
            stub.Status = HttpStatusCode.Forbidden;
            try { await sender.SendAsync("test@example.com", sampleLink, CancellationToken.None); throw new Exception("Provider failure must throw"); }
            catch (HttpRequestException error) { Check(error.StatusCode == HttpStatusCode.Forbidden && !error.Message.Contains("secret-test-code"), "No token in provider error"); }
            var fileOptions = Options.Create(new RecoveryEmailOptions { Provider = "DevelopmentFile" });
            var fileSender = new PasswordResetEmailSender(http, fileOptions, new EmailTestEnvironment(root, "Development"));
            await fileSender.SendAsync("test@example.com", sampleLink, CancellationToken.None);
            var eml = Directory.GetFiles(Path.Combine(root, "App_Data", "ThuThuNghiem")).Single();
            Check((await File.ReadAllTextAsync(eml)).Contains(sampleLink) && !eml.Contains("wwwroot"), "Local email file outside public assets");
            Check(!new PasswordResetEmailSender(http, fileOptions, new EmailTestEnvironment(root, "Production")).IsConfigured, "File provider forbidden in Production");
            Check(!PasswordRecoveryService.ValidPublicUrl("http://n9studio.onrender.com") && !PasswordRecoveryService.ValidPublicUrl("https://n9studio.onrender.com/?x=1"), "Public URL validation");
            Console.WriteLine("PASS HTTPS password recovery + real Identity/SQLite: CSRF, generic responses, cooldown/rate limit, trusted email URL, invalid/wrong/expired/single-use token, confirmation/policy, old/new login, lockout recovery, Admin role and prior-session invalidation. Email captured locally; no external email or SQL Server used.");
        }
        finally { await app.StopAsync(); await app.DisposeAsync(); Directory.Delete(root, true); }
    }
}
