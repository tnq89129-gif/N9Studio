using Backend.Contracts;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Backend.Controllers;

[ApiController, AllowAnonymous, Route("api/tai-khoan"), EnableRateLimiting("recovery")]
public class PasswordRecoveryController(PasswordRecoveryService recovery) : ControllerBase
{
    [HttpPost("quen-mat-khau")]
    public async Task<IActionResult> Forgot(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        try { await recovery.RequestAsync(request.Email, cancellationToken); }
        catch (RecoveryUnavailableException)
        {
            return StatusCode(503, new { message = "Chưa thể gửi hướng dẫn lúc này. Vui lòng thử lại sau hoặc liên hệ N9 Studio." });
        }
        return Accepted(new { message = PasswordRecoveryService.SentMessage });
    }

    [HttpPost("dat-lai-mat-khau")]
    public async Task<IActionResult> Reset(ResetPasswordRequest request)
    {
        if (request.NewPassword != request.ConfirmPassword)
            return BadRequest(new { message = "Mật khẩu xác nhận chưa khớp." });
        var result = await recovery.ResetAsync(request.Email, request.Code, request.NewPassword);
        if (!result.Succeeded)
        {
            if (result.Errors.Any(e => e.Code is "InvalidToken" or "ConcurrencyFailure"))
                return BadRequest(new { message = PasswordRecoveryService.InvalidLinkMessage });
            return BadRequest(new { message = "Mật khẩu cần từ 8 đến 100 ký tự, có chữ hoa, chữ thường, chữ số và ký tự đặc biệt." });
        }
        return Ok(new { message = "Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới." });
    }
}
