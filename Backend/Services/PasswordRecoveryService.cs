using System.Text;
using Backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Backend.Services;

public sealed class RecoveryUnavailableException : Exception;

// Bounded, per-email cooldown. The HTTP rate limiter also limits invalid/new email addresses.
public sealed class RecoveryCooldown : IDisposable
{
    private readonly MemoryCache cache = new(new MemoryCacheOptions { SizeLimit = 10000 });
    public bool TryAcquire(string email)
    {
        lock (cache)
        {
            var key = email.ToUpperInvariant();
            if (cache.TryGetValue(key, out _)) return false;
            cache.Set(key, true, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1), Size = 1 });
            return true;
        }
    }
    public void Dispose() => cache.Dispose();
}

public sealed class PasswordRecoveryService(UserManager<ShopUser> users, IPasswordResetEmailSender sender,
    IOptions<PasswordResetOptions> settings, RecoveryCooldown cooldown, ILogger<PasswordRecoveryService> logger)
{
    public const string SentMessage = "Nếu email khớp với một tài khoản, hướng dẫn khôi phục sẽ được gửi. Hãy kiểm tra Hộp thư đến và Spam. Bạn có thể yêu cầu lại sau 60 giây.";
    public const string InvalidLinkMessage = "Liên kết đặt lại mật khẩu không hợp lệ, đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.";

    public async Task RequestAsync(string email, CancellationToken cancellationToken)
    {
        // A configuration failure must have the same response for all email addresses.
        if (!sender.IsConfigured || !ValidPublicUrl(settings.Value.PublicUrl))
        {
            logger.LogWarning("Password recovery unavailable. Configure Email provider/API key/verified From and PasswordReset:PublicUrl. DevelopmentFile is local Development only.");
            throw new RecoveryUnavailableException();
        }
        email = email.Trim();
        if (!cooldown.TryAcquire(email)) return;
        var user = await users.FindByEmailAsync(email);
        if (user == null || string.IsNullOrWhiteSpace(user.Email)) return;
        var token = await users.GeneratePasswordResetTokenAsync(user);
        var code = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
        // A fragment is not transmitted in HTTP requests or Referer headers. Never use Request.Host.
        var url = settings.Value.PublicUrl.TrimEnd('/') + "/GiaoDien/NguoiDung/DatLaiMatKhau/index.html#email="
            + Uri.EscapeDataString(user.Email) + "&code=" + code;
        try { await sender.SendAsync(user.Email, url, cancellationToken); }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception e)
        {
            // Keep responses identical for unknown accounts and provider delivery failures.
            logger.LogError("Password recovery email failed: {FailureType}, status {Status}. Check the email provider dashboard/configuration. No token or recipient is logged.",
                e.GetType().Name, (e as HttpRequestException)?.StatusCode);
        }
    }

    public async Task<IdentityResult> ResetAsync(string email, string code, string newPassword)
    {
        string token;
        try { token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(code)); }
        catch (FormatException) { return InvalidToken(); }
        var user = await users.FindByEmailAsync(email.Trim());
        if (user == null) return InvalidToken();
        // Identity changes the password hash and security stamp: the link cannot be reused.
        var result = await users.ResetPasswordAsync(user, token, newPassword);
        if (!result.Succeeded) return result;
        if (users.SupportsUserLockout)
        {
            var unlocked = await users.SetLockoutEndDateAsync(user, null);
            if (!unlocked.Succeeded) logger.LogWarning("Password reset succeeded, but clearing lockout failed.");
            var cleared = await users.ResetAccessFailedCountAsync(user);
            if (!cleared.Succeeded) logger.LogWarning("Password reset succeeded, but clearing failed-access count failed.");
        }
        return result;
    }

    private static IdentityResult InvalidToken() => IdentityResult.Failed(new IdentityError { Code = "InvalidToken", Description = InvalidLinkMessage });
    public static bool ValidPublicUrl(string value) => Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && uri.Scheme == "https" && string.IsNullOrEmpty(uri.UserInfo) && string.IsNullOrEmpty(uri.Query)
        && string.IsNullOrEmpty(uri.Fragment) && uri.AbsolutePath == "/";
}
