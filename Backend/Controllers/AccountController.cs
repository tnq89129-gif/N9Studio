using Backend.Contracts;
using Backend.Models;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace Backend.Controllers;
[ApiController, Route("api/tai-khoan")]
public class AccountController(UserManager<ShopUser> users, SignInManager<ShopUser> signIn) : ControllerBase {
    [HttpGet("csrf"), AllowAnonymous]
    public IActionResult Csrf([FromServices] IAntiforgery af) => Ok(new { token=af.GetAndStoreTokens(HttpContext).RequestToken });
    [HttpPost("dang-ky"), AllowAnonymous, EnableRateLimiting("auth")]
    public async Task<IActionResult> Register(RegisterRequest r) {
        var u = new ShopUser { UserName=r.Email.Trim(), Email=r.Email.Trim(), FullName=r.FullName.Trim() };
        var result = await users.CreateAsync(u, r.Password);
        if (!result.Succeeded) return BadRequest(result.Errors.Select(e=>e.Description));
        var role = await users.AddToRoleAsync(u, "Customer");
        if (!role.Succeeded) { await users.DeleteAsync(u); return Problem("Chưa khởi tạo vai trò. Chạy --init-db."); }
        return Ok(new { message="Đăng ký thành công. Hãy đăng nhập." });
    }
    [HttpPost("dang-nhap"), AllowAnonymous, EnableRateLimiting("auth")]
    public async Task<IActionResult> Login(LoginRequest r) {
        var u = await users.FindByEmailAsync(r.Email.Trim());
        if (u == null) return Unauthorized(new { message="Email hoặc mật khẩu không đúng." });
        var result = await signIn.PasswordSignInAsync(u, r.Password, r.Remember, true);
        return result.Succeeded ? Ok(new { message="Đăng nhập thành công. Lấy lại CSRF token." }) : Unauthorized(new { message="Thông tin không đúng hoặc tài khoản tạm khóa." });
    }
    [HttpPost("dang-xuat"), Authorize]
    public async Task<IActionResult> Logout() { await signIn.SignOutAsync(); return NoContent(); }
    [HttpGet("me"), Authorize]
    public async Task<IActionResult> Me() {
        var u = await users.GetUserAsync(User);
        return u == null ? Unauthorized() : Ok(new { u.Id, u.Email, u.FullName, u.PhoneNumber, u.Address, Roles=await users.GetRolesAsync(u) });
    }
    [HttpPut("me"), Authorize]
    public async Task<IActionResult> Profile(ProfileRequest r) {
        var u = await users.GetUserAsync(User); if (u==null) return Unauthorized();
        u.FullName=r.FullName.Trim(); u.PhoneNumber=r.Phone; u.Address=r.Address;
        var result=await users.UpdateAsync(u);
        return result.Succeeded ? NoContent() : BadRequest(result.Errors.Select(e=>e.Description));
    }
    [HttpPut("mat-khau"), Authorize]
    public async Task<IActionResult> Password(PasswordRequest r) {
        var u=await users.GetUserAsync(User); if(u==null) return Unauthorized();
        var result=await users.ChangePasswordAsync(u,r.OldPassword,r.NewPassword);
        if(!result.Succeeded) return BadRequest(result.Errors.Select(e=>e.Description));
        await signIn.RefreshSignInAsync(u); return NoContent();
    }
}
