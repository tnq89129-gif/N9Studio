using System.Net.Http.Headers;
using System.Net.Mail;
using System.Net;
using System.Text;
using Microsoft.Extensions.Options;

namespace Backend.Services;

public sealed class PasswordResetOptions
{
    public string PublicUrl { get; set; } = "";
}

public sealed class RecoveryEmailOptions
{
    public string Provider { get; set; } = "Resend";
    public string ApiKey { get; set; } = "";
    public string From { get; set; } = "";
}

public interface IPasswordResetEmailSender
{
    bool IsConfigured { get; }
    Task SendAsync(string recipient, string resetUrl, CancellationToken cancellationToken);
}

public sealed class PasswordResetEmailSender(HttpClient client, IOptions<RecoveryEmailOptions> settings,
    IWebHostEnvironment environment) : IPasswordResetEmailSender
{
    private RecoveryEmailOptions Options => settings.Value;
    private bool IsDevelopmentFile => Options.Provider.Equals("DevelopmentFile", StringComparison.OrdinalIgnoreCase)
        && environment.IsDevelopment()
        && !string.Equals(Environment.GetEnvironmentVariable("RENDER"), "true", StringComparison.OrdinalIgnoreCase);
    public bool IsConfigured => IsDevelopmentFile ||
        (Options.Provider.Equals("Resend", StringComparison.OrdinalIgnoreCase)
        && !string.IsNullOrWhiteSpace(Options.ApiKey) && MailAddress.TryCreate(Options.From, out _));

    public async Task SendAsync(string recipient, string resetUrl, CancellationToken cancellationToken)
    {
        if (!IsConfigured) throw new InvalidOperationException("Recovery email is not configured.");
        var text = $"N9 Studio\n\nBan da yeu cau dat lai mat khau. Mo lien ket sau trong 30 phut:\n{resetUrl}\n\nLien ket chi dung duoc mot lan sau khi dat lai thanh cong. Neu khong phai ban yeu cau, hay bo qua email nay.\nN9 Studio khong bao gio yeu cau ban gui mat khau qua email.";
        if (IsDevelopmentFile)
        {
            // Explicit local-only testing. Never expose this directory through wwwroot or an API.
            var folder = Path.Combine(environment.ContentRootPath, "App_Data", "ThuThuNghiem");
            Directory.CreateDirectory(folder);
            await File.WriteAllTextAsync(Path.Combine(folder, $"khoi-phuc-{Guid.NewGuid():N}.eml"),
                $"To: {recipient}\nSubject: Dat lai mat khau N9 Studio\nContent-Type: text/plain; charset=utf-8\n\n{text}", Encoding.UTF8, cancellationToken);
            return;
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Options.ApiKey);
        request.Headers.UserAgent.ParseAdd("N9Studio/1.0");
        var safeUrl = WebUtility.HtmlEncode(resetUrl);
        request.Content = JsonContent.Create(new {
            from = Options.From, to = new[] { recipient }, subject = "Đặt lại mật khẩu N9 Studio",
            text,
            html = $"<div style=\"font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;background:#20261e;color:#f3efdf;border-radius:16px\"><h2>N9 Studio</h2><p>Bạn vừa yêu cầu đặt lại mật khẩu.</p><p>Liên kết có hiệu lực trong <strong>30 phút</strong> và chỉ dùng được một lần sau khi đặt lại thành công.</p><p style=\"margin:28px 0\"><a href=\"{safeUrl}\" style=\"display:inline-block;padding:14px 24px;background:#ded0a5;color:#20261e;border-radius:9px;text-decoration:none\">Đặt lại mật khẩu</a></p><p>Nếu nút không mở được, sao chép đường dẫn này vào trình duyệt:</p><p style=\"word-break:break-all\">{safeUrl}</p><p>Nếu không phải bạn yêu cầu, hãy bỏ qua email này. Mật khẩu hiện tại vẫn giữ nguyên.</p><small>N9 Studio không yêu cầu bạn gửi mật khẩu qua email.</small></div>"
        });
        using var response = await client.SendAsync(request, cancellationToken);
        // Do not log a provider response body, recipient, reset URL or API key.
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"Recovery email provider returned HTTP {(int)response.StatusCode}. Check API key, verified sender and provider dashboard.", null, response.StatusCode);
    }
}
