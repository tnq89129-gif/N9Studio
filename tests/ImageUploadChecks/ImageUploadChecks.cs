using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using Backend.Controllers;
using Backend.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

internal static class ImageUploadChecks
{
    private static void Check(bool valid, string message) { if (!valid) throw new Exception(message); }

    public static async Task Main()
    {
        // Isolated real HTTP host, cookie roles and antiforgery, using the production image controller/store.
        // No database or test-login endpoint is added to the production application.
        var root = Path.Combine(Path.GetTempPath(), "n9-image-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(root, "wwwroot", "images"));
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { ContentRootPath = root, WebRootPath = "wwwroot" });
        builder.Logging.ClearProviders();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o => {
            o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
            o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
        });
        builder.Services.AddAuthorization();
        builder.Services.AddAntiforgery(o => o.HeaderName = "X-CSRF-TOKEN");
        builder.Services.AddScoped<ProductImageStore>();
        builder.Services.AddControllersWithViews(o => o.Filters.Add(new AutoValidateAntiforgeryTokenAttribute()))
            .AddApplicationPart(typeof(ProductImagesController).Assembly);
        var app = builder.Build();
        app.UseAuthentication(); app.UseAuthorization();
        app.UseStaticFiles(new StaticFileOptions { OnPrepareResponse = c => c.Context.Response.Headers["X-Content-Type-Options"] = "nosniff" });
        app.MapControllers();
        app.MapGet("/test-login/{role}", async (string role, HttpContext context) => {
            var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, "test-user"), new Claim(ClaimTypes.Role, role) }, "Cookies");
            await context.SignInAsync("Cookies", new ClaimsPrincipal(identity));
        });
        app.MapGet("/test-csrf", (IAntiforgery antiforgery, HttpContext context) => new { token = antiforgery.GetAndStoreTokens(context).RequestToken });
        await app.StartAsync();
        try
        {
            var address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
            using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false, UseProxy = false }) { BaseAddress = new Uri(address) };
            const string route = "/api/quan-tri/anh-san-pham";
            var png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6H0sAAAAASUVORK5CYII=");
            async Task<HttpResponseMessage> Upload(byte[] data, string name, string? token)
            {
                using var body = new MultipartFormDataContent();
                body.Add(new ByteArrayContent(data), "file", name);
                using var request = new HttpRequestMessage(HttpMethod.Post, route) { Content = body };
                request.Headers.ExpectContinue = true;
                if (token != null) request.Headers.Add("X-CSRF-TOKEN", token);
                return await client.SendAsync(request);
            }
            async Task<string> Token()
            {
                var data = await client.GetFromJsonAsync<System.Text.Json.Nodes.JsonObject>("/test-csrf");
                return data!["token"]!.GetValue<string>();
            }

            Check((await client.GetAsync(route)).StatusCode == HttpStatusCode.Unauthorized, "Anonymous listing denied");
            Check((await Upload(png, "a.png", null)).StatusCode == HttpStatusCode.Unauthorized, "Anonymous upload denied");
            await client.GetAsync("/test-login/Customer");
            Check((await client.GetAsync(route)).StatusCode == HttpStatusCode.Forbidden, "Customer listing denied");
            Check((await Upload(png, "a.png", await Token())).StatusCode == HttpStatusCode.Forbidden, "Customer upload denied");
            await client.GetAsync("/test-login/Admin");
            Check((await Upload(png, "a.png", null)).StatusCode == HttpStatusCode.BadRequest, "Missing CSRF denied");
            Check((await Upload(png, "a.png", "invalid")).StatusCode == HttpStatusCode.BadRequest, "Invalid CSRF denied");
            var token = await Token();
            var firstResponse = await Upload(png, "ao-moi.png", token);
            Check(firstResponse.IsSuccessStatusCode, "Valid PNG upload: " + await firstResponse.Content.ReadAsStringAsync());
            var first = (await firstResponse.Content.ReadFromJsonAsync<ProductImageFile>())!;
            Check(first.Url.StartsWith("/images/san-pham/"), "Image URL under storage root");
            var download = await client.GetAsync(first.Url);
            Check(download.IsSuccessStatusCode && (await download.Content.ReadAsByteArrayAsync()).SequenceEqual(png), "Public image bytes match upload");
            Check(download.Headers.GetValues("X-Content-Type-Options").Single() == "nosniff", "Static image nosniff");
            var second = (await (await Upload(png, "ao-moi.png", token)).Content.ReadFromJsonAsync<ProductImageFile>())!;
            Check(first.Url != second.Url, "Duplicate filename does not overwrite");

            Check((await Upload(Convert.FromBase64String("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDDooorxjjP/9k="), "sample.jpg", token)).IsSuccessStatusCode, "Valid JPEG upload");
            Check((await Upload(Convert.FromBase64String("UklGRjQAAABXRUJQVlA4ICgAAABwAQCdASoCAAIAAUAmJZgCdAF1AAD+7gpn+xfsD+JZ1eHbmyLSAAAA"), "sample.webp", token)).IsSuccessStatusCode, "Valid WEBP upload");
            var list = (await client.GetFromJsonAsync<List<ProductImageFile>>(route))!;
            Check(list.Any(i => i.Url == first.Url) && list.Any(i => i.Url == second.Url), "Uploaded images persist in fresh GET");
            foreach (var (bytes, name) in new[] { (png, "fake.svg"), (png, "fake.jpg"), (Array.Empty<byte>(), "empty.png"), (new byte[100], "not-an-image.png"), (png[..20], "truncated.png"), (new byte[5 * 1024 * 1024 + 1], "too-big.png") })
                Check((await Upload(bytes, name, token)).StatusCode == HttpStatusCode.BadRequest, "Invalid image rejected: " + name);
            var oversized = await Upload(new byte[7 * 1024 * 1024], "huge.png", token);
            Check(oversized.StatusCode is HttpStatusCode.RequestEntityTooLarge or HttpStatusCode.BadRequest, "Oversized HTTP request rejected: " + oversized.StatusCode);
            using (var missing = new HttpRequestMessage(HttpMethod.Post, route) { Content = new MultipartFormDataContent() })
            {
                missing.Headers.Add("X-CSRF-TOKEN", token);
                Check((await client.SendAsync(missing)).StatusCode == HttpStatusCode.BadRequest, "Missing file rejected");
            }
            // A path supplied by the browser is never used as a disk path.
            var safe = (await (await Upload(png, "../../anh-moi.png", token)).Content.ReadFromJsonAsync<ProductImageFile>())!;
            Check(!safe.Url.Contains("..") && safe.Name.StartsWith("anh-moi-"), "Client path safely replaced");
            var files = Directory.GetFiles(Path.Combine(root, "wwwroot", "images", "san-pham"));
            Check(files.Length == 5 && files.All(f => !f.EndsWith(".tmp")), "Invalid files leave no artifacts");
            Console.WriteLine("PASS real HTTP image uploads: cookie roles, CSRF, size/format validation, unique names, static retrieval, persistence and safe paths. No SQL Server required.");
        }
        finally
        {
            await app.StopAsync(); await app.DisposeAsync();
            Directory.Delete(root, recursive: true);
        }
    }
}
