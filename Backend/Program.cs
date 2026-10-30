using Backend.Data;
using Backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Tên miền được phép truy cập
var allowedHosts = (builder.Configuration["AllowedHosts"] ?? "localhost")
    .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .ToHashSet(StringComparer.OrdinalIgnoreCase);
allowedHosts.Add("localhost");
allowedHosts.Add("127.0.0.1");
allowedHosts.Add("n9studio.onrender.com");

var isRender = string.Equals(Environment.GetEnvironmentVariable("RENDER"), "true", StringComparison.OrdinalIgnoreCase);
var renderHostname = Environment.GetEnvironmentVariable("RENDER_EXTERNAL_HOSTNAME");
if (isRender && !string.IsNullOrWhiteSpace(renderHostname))
    allowedHosts.Add(renderHostname);
builder.Configuration["AllowedHosts"] = string.Join(";", allowedHosts);

// Cấu hình cổng trên Render
if (isRender)
{
    var portText = Environment.GetEnvironmentVariable("PORT") ?? "10000";
    if (!int.TryParse(portText, out var port) || port < 1 || port > 65535)
        throw new InvalidOperationException("PORT phải là số nguyên từ 1 đến 65535.");
    builder.WebHost.ConfigureKestrel(options => options.ListenAnyIP(port));
}

builder.Services.AddScoped<Backend.Services.ProductImageStore>();
var dataProtection = builder.Services.AddDataProtection().SetApplicationName("N9Studio");
var keysPath = builder.Configuration["DataProtection:KeysPath"];
if (!string.IsNullOrWhiteSpace(keysPath))
{
    Directory.CreateDirectory(keysPath);
    dataProtection.PersistKeysToFileSystem(new DirectoryInfo(keysPath));
}

builder.Services.AddSingleton<Backend.Services.RecoveryCooldown>();
builder.Services.Configure<Backend.Services.PasswordResetOptions>(builder.Configuration.GetSection("PasswordReset"));
builder.Services.PostConfigure<Backend.Services.PasswordResetOptions>(options => {
    if (string.IsNullOrWhiteSpace(options.PublicUrl))
        options.PublicUrl = isRender ? "https://" + (renderHostname ?? "n9studio.onrender.com") : "https://localhost:7043";
});

builder.Services.Configure<Backend.Services.RecoveryEmailOptions>(builder.Configuration.GetSection("Email"));
builder.Services.AddHttpClient<Backend.Services.IPasswordResetEmailSender, Backend.Services.PasswordResetEmailSender>(client => client.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddScoped<Backend.Services.PasswordRecoveryService>();
builder.Services.Configure<DataProtectionTokenProviderOptions>(options => options.TokenLifespan = TimeSpan.FromMinutes(30));
builder.Services.Configure<SecurityStampValidatorOptions>(options => options.ValidationInterval = TimeSpan.FromMinutes(1));

// ✅ Đã sửa: Dùng PostgreSQL thay cho SQL Server
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Configure ConnectionStrings__DefaultConnection.");
var usePostgreSql = Backend.Services.DatabaseProvider.IsPostgreSql(connectionString, builder.Configuration["Database:Provider"]);
builder.Services.AddDbContext<ShopDbContext>(options => {
    if (usePostgreSql) options.UseNpgsql(Backend.Services.DatabaseProvider.PostgreSqlConnection(connectionString));
    else options.UseSqlServer(connectionString);
});

builder.Services.AddIdentity<ShopUser, IdentityRole>(o => {
    o.User.RequireUniqueEmail = true;
    o.Password.RequiredLength = 8;
    o.Lockout.MaxFailedAccessAttempts = 5;
    o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);
}).AddEntityFrameworkStores<ShopDbContext>().AddDefaultTokenProviders();

builder.Services.ConfigureApplicationCookie(o => {
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
});

builder.Services.AddAntiforgery(o => o.HeaderName = "X-CSRF-TOKEN");
builder.Services.AddControllersWithViews(o => o.Filters.Add(new AutoValidateAntiforgeryTokenAttribute()))
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddRateLimiter(o => {
    o.RejectionStatusCode = 429;
    o.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 15, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("recovery", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(15), QueueLimit = 0 }));
});

var app = builder.Build();

// ✅ Đã sửa: Không cảnh báo sai khi dùng PostgreSQL
if (isRender && !usePostgreSql && (builder.Configuration.GetConnectionString("DefaultConnection")?.Contains("(localdb)", StringComparison.OrdinalIgnoreCase) ?? false))
    app.Logger.LogWarning("Render requires an online database. Set ConnectionStrings__DefaultConnection in Environment. LocalDB is not available here.");

if (isRender)
{
    app.Use((context, next) =>
    {
        context.Request.Scheme = "https";
        return next(context);
    });
}

if (!app.Environment.IsDevelopment()) { app.UseExceptionHandler("/Home/Error"); app.UseHsts(); }
app.UseMiddleware<Backend.Services.DatabaseAvailabilityMiddleware>();
app.UseHttpsRedirection();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.Use(async (context, next) => {
    if (context.Request.Path.StartsWithSegments("/api"))
        context.Response.Headers.CacheControl = "no-store";
    if (context.Request.Path.StartsWithSegments("/GiaoDien/QuanTri") &&
        (context.Request.Path.Value?.EndsWith(".html", StringComparison.OrdinalIgnoreCase) ?? false))
    {
        context.Response.Headers.CacheControl = "no-store";
        if (context.User.Identity?.IsAuthenticated != true)
        {
            context.Response.Redirect("/GiaoDien/NguoiDung/DangNhap/index.html");
            return;
        }
        if (!context.User.IsInRole("Admin"))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "text/plain; charset=utf-8";
            await context.Response.WriteAsync("Bạn không có quyền truy cập khu vực quản trị.");
            return;
        }
    }
    await next(context);
});

app.UseStaticFiles(new StaticFileOptions {
    OnPrepareResponse = context => context.Context.Response.Headers["X-Content-Type-Options"] = "nosniff"
});

var initializeOnStartup = builder.Configuration.GetValue<bool>("Database:InitializeOnStartup");
var createTeamAdmins = args.Contains("--create-team-admins") || (initializeOnStartup && builder.Configuration.GetValue<bool>("Database:CreateTeamAdmins"));

if (initializeOnStartup || args.Contains("--init-db") || args.Contains("--create-team-admins") || args.Contains("--update-categories") || args.Contains("--update-products"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();
    await db.Database.EnsureCreatedAsync();
    await Backend.Services.CategorySchemaUpdater.UpdateAsync(db, builder.Environment.ContentRootPath);
    
    if (!initializeOnStartup && (args.Contains("--update-categories") || args.Contains("--update-products")) && !args.Contains("--init-db") && !createTeamAdmins) return;

    var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    foreach (var role in new[] { "Admin", "Customer" })
    {
        if (!await roles.RoleExistsAsync(role))
        {
            var result = await roles.CreateAsync(new IdentityRole(role));
            if (!result.Succeeded) throw new InvalidOperationException(string.Join(";", result.Errors.Select(e => e.Description)));
        }
    }

    var email = builder.Configuration["SeedAdmin:Email"];
    var password = builder.Configuration["SeedAdmin:Password"];
    if (!createTeamAdmins && !string.IsNullOrWhiteSpace(email) && !string.IsNullOrWhiteSpace(password))
    {
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ShopUser>>();
        var user = await users.FindByEmailAsync(email);
        if (user == null)
        {
            user = new ShopUser { UserName = email, Email = email, FullName = "Quản trị viên" };
            var created = await users.CreateAsync(user, password);
            if (!created.Succeeded) throw new InvalidOperationException(string.Join(";", created.Errors.Select(e => e.Description)));
            var assigned = await users.AddToRoleAsync(user, "Admin");
            if (!assigned.Succeeded) throw new InvalidOperationException("Cannot assign Admin role.");
        }
        else if (!await users.IsInRoleAsync(user, "Admin"))
        {
            throw new InvalidOperationException("Seed email already belongs to a non-admin account. Choose another email.");
        }
    }

    if (args.Contains("--seed-catalog"))
        await Backend.Services.CatalogSeeder.SeedAsync(db, builder.Environment.ContentRootPath);
    if (createTeamAdmins)
        await Backend.Services.TeamAdminSeeder.CreateAsync(db, scope.ServiceProvider.GetRequiredService<UserManager<ShopUser>>());
    if (!initializeOnStartup) return;
}

app.MapControllers();
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
app.Run();
public partial class Program { }
