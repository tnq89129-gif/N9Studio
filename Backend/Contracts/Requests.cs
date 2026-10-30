using System.ComponentModel.DataAnnotations;
using Backend.Models;
namespace Backend.Contracts;
public record RegisterRequest([Required, EmailAddress] string Email, [Required, StringLength(100, MinimumLength=8)] string Password, [Required, StringLength(100)] string FullName);
public record LoginRequest([Required, EmailAddress] string Email, [Required] string Password, bool Remember=false);
public record ForgotPasswordRequest([Required, EmailAddress, StringLength(254)] string Email);
public record ResetPasswordRequest([Required, EmailAddress, StringLength(254)] string Email,
    [Required, StringLength(4096)] string Code,
    [Required, StringLength(100, MinimumLength=8)] string NewPassword,
    [Required, StringLength(100, MinimumLength=8)] string ConfirmPassword);
public record ProfileRequest([Required, StringLength(100)] string FullName, [StringLength(30)] string Phone, [StringLength(500)] string Address);
public record PasswordRequest([Required] string OldPassword, [Required, StringLength(100, MinimumLength=8)] string NewPassword);
public record CategoryRequest([Required, StringLength(100)] string Name, [StringLength(60)] string? Code=null, [StringLength(240)] string Description="", bool IsActive=true);
public record CategoryStatusRequest(bool IsActive);
public record ProductRequest([Required, StringLength(200)] string Name, [StringLength(5000)] string Description, [StringLength(2000)] string ImageUrl, [Range(1,int.MaxValue)] int CategoryId, bool IsActive=true, [StringLength(30)] string? Tag=null, [MaxLength(200)] List<ProductVariantRequest>? Variants=null);
public record VariantRequest([Required, StringLength(30)] string Size, [Required, StringLength(50)] string Color, [Range(typeof(decimal), "1", "999999999999")] decimal Price, [Range(0,1000000)] int Stock, bool IsActive=true);
public record CartRequest([Range(1,int.MaxValue)] int VariantId, [Range(1,99)] int Quantity);
public record QuantityRequest([Range(1,99)] int Quantity);
public record CheckoutRequest([Required, StringLength(100)] string Recipient, [Required, Phone, StringLength(30)] string Phone, [Required, StringLength(500)] string Address, [StringLength(1000)] string Note="");
public record StatusRequest(OrderStatus Status);
public record ReviewRequest([Range(1,5)] int Rating, [Required, StringLength(2000)] string Content);
public record VisibilityRequest(bool IsVisible);

public record ProductVariantRequest([Required, StringLength(30)] string Size, [Required, StringLength(50)] string Color, [Range(typeof(decimal), "1", "999999999999")] decimal Price, [Range(0,1000000)] int Stock, bool IsActive=true, [Range(1,int.MaxValue)] int? Id=null);
