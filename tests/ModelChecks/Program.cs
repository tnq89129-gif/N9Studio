using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;
var options = new DbContextOptionsBuilder<ShopDbContext>().UseSqlServer("Server=localhost;Database=SchemaChecks;Integrated Security=True;TrustServerCertificate=True").Options;
using var db = new ShopDbContext(options);
var sql = db.Database.GenerateCreateScript(); // Validates EF model without opening a SQL connection.
foreach(var fragment in new[]{"CREATE TABLE [Orders]", "CREATE TABLE [OrderLines]", "CREATE TABLE [AspNetUsers]", "CK_Variant_Values", "CK_Cart_Quantity", "CK_Review_Rating"})
    if(!sql.Contains(fragment)) throw new Exception("Missing schema element: "+fragment);
var variant=db.Model.FindEntityType(typeof(ProductVariant))!;
if(!variant.GetIndexes().Any(i=>i.IsUnique && i.Properties.Select(p=>p.Name).SequenceEqual(new[]{"ProductId","Size","Color"})))
    throw new Exception("Variant uniqueness was not configured.");
if(variant.FindProperty("Price")!.GetPrecision()!=18)throw new Exception("Price precision incorrect.");
var cart=db.Model.FindEntityType(typeof(CartItem))!;
if(!cart.GetIndexes().Any(i=>i.IsUnique && i.Properties.Select(p=>p.Name).SequenceEqual(new[]{"UserId","VariantId"})))
    throw new Exception("Cart uniqueness was not configured.");
Console.WriteLine("PASS EF SQL Server model, schema generation, constraints, unique keys and money precision. Database connection not tested.");

var accounts=Backend.Services.TeamAdminSeeder.Accounts;
if(accounts.Count!=5 || accounts.Select(a=>a.Email).Distinct().Count()!=5)
    throw new Exception("Expected five distinct admin logins.");
if(!accounts.Select(a=>a.FullName).SequenceEqual(new[]{"TN Quảng","Công Đạt","Đình Huy","Diệu Thúy","Văn Vượng"}))
    throw new Exception("Team names must match the requested spelling.");
foreach(var account in accounts) {
    var user=new ShopUser {Email=account.Email,UserName=account.Email,FullName=account.FullName};
    var hasher=new Microsoft.AspNetCore.Identity.PasswordHasher<ShopUser>();
    var hash=hasher.HashPassword(user,account.Password);
    if(hasher.VerifyHashedPassword(user,hash,account.Password)==Microsoft.AspNetCore.Identity.PasswordVerificationResult.Failed)
        throw new Exception("Password hash verification failed.");
    if(account.Password.Length<8 || !account.Password.Any(char.IsUpper) || !account.Password.Any(char.IsLower) || !account.Password.Any(char.IsDigit) || account.Password.All(char.IsLetterOrDigit))
        throw new Exception("Password does not meet configured requirements.");
}
Console.WriteLine("PASS five requested names, distinct logins, password policy and Identity hash verification. SQL provisioning not tested.");

if(!accounts.Select(a=>a.Email).SequenceEqual(new[]{"tnq89129@gmail.com","lightning191105@gmail.com","nqh.290@gmail.com","Thuycutephomaique46@gmail.com","nhatvuong026@gmail.com"}))
    throw new Exception("Admin emails do not match requested Gmail addresses.");
Console.WriteLine("PASS five requested Gmail addresses in the correct name order.");

var category=db.Model.FindEntityType(typeof(Category))!;
if(!category.GetIndexes().Any(i=>i.IsUnique&&i.Properties.SingleOrDefault()?.Name=="Code"))
    throw new Exception("Unique category code is required.");
if(category.FindProperty("Description")!.GetMaxLength()!=240 || category.FindProperty("IsActive")==null)
    throw new Exception("Missing category schema fields.");
Console.WriteLine("PASS SQL Server category model: unique code, description length and visibility.");
