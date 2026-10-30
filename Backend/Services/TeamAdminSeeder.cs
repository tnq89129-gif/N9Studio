using Backend.Data;
using Backend.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Data;
namespace Backend.Services;
public static class TeamAdminSeeder {
    public sealed record Account(string FullName, string Email, string Password);
    private static readonly Dictionary<string,string> PreviousEmails = new() {
        ["tnq89129@gmail.com"]="tnquang@example.com",
        ["lightning191105@gmail.com"]="congdat@example.com",
        ["nqh.290@gmail.com"]="dinhhuy@example.com",
        ["Thuycutephomaique46@gmail.com"]="dieuthuy@example.com",
        ["nhatvuong026@gmail.com"]="vanvuong@example.com"
    };
    // User-requested memorable credentials for the project team. Identity stores password hashes.
    public static IReadOnlyList<Account> Accounts { get; } = Array.AsReadOnly(new[] {
        new Account("TN Quảng", "tnq89129@gmail.com", "Quang@2026"),
        new Account("Công Đạt", "lightning191105@gmail.com", "Dat@2026"),
        new Account("Đình Huy", "nqh.290@gmail.com", "Huy@2026"),
        new Account("Diệu Thúy", "Thuycutephomaique46@gmail.com", "Thuy@2026"),
        new Account("Văn Vượng", "nhatvuong026@gmail.com", "Vuong@2026")
    });
    public static async Task CreateAsync(ShopDbContext db, UserManager<ShopUser> users) {
        await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var existing=new Dictionary<string,ShopUser?>();
        // Check every name before creating any account. Never promote an existing customer.
        foreach(var account in Accounts) {
            var user=await users.FindByEmailAsync(account.Email);
            var legacy=await users.FindByEmailAsync(PreviousEmails[account.Email]);
            var byName=await users.FindByNameAsync(account.Email);
            if ((user!=null && legacy!=null && user.Id!=legacy.Id) ||
                (legacy!=null && (legacy.FullName!=account.FullName || !await users.IsInRoleAsync(legacy,"Admin"))))
                throw new InvalidOperationException($"Conflicting old/new accounts for {account.FullName}. No accounts or emails were changed.");
            user ??= legacy;
            if ((user!=null && !await users.IsInRoleAsync(user,"Admin")) ||
                (byName!=null && byName.Id!=user?.Id))
                throw new InvalidOperationException($"Email/login {account.Email} is already used by another account. No team accounts were created; existing passwords and roles are unchanged.");
            existing[account.Email]=user;
        }
        var created=new List<Account>();
        foreach(var account in Accounts) {
            var previous=existing[account.Email];
            if(previous!=null) {
                if(!string.Equals(previous.Email,account.Email,StringComparison.Ordinal) ||
                   !string.Equals(previous.UserName,account.Email,StringComparison.Ordinal)) {
                    Ensure(await users.SetEmailAsync(previous,account.Email));
                    Ensure(await users.SetUserNameAsync(previous,account.Email));
                    Ensure(await users.UpdateSecurityStampAsync(previous));
                }
                continue;
            }
            var user=new ShopUser {UserName=account.Email,Email=account.Email,FullName=account.FullName};
            Ensure(await users.CreateAsync(user,account.Password));
            Ensure(await users.AddToRoleAsync(user,"Admin"));
            created.Add(account);
        }
        await tx.CommitAsync();
        Console.WriteLine($"Created {created.Count} team Admin accounts. Admin is the highest role in this application.");
        foreach(var account in Accounts) {
            if(created.Contains(account)) Console.WriteLine($"{account.FullName} | {account.Email}: Admin created. Initial credentials are listed in the private setup guide; no password is printed to deployment logs.");
            else Console.WriteLine($"{account.Email}: Admin email/login updated or already current; existing name/password and user ID were kept unchanged.");
        }
    }
    private static void Ensure(IdentityResult result) {
        if(!result.Succeeded)throw new InvalidOperationException(string.Join("; ",result.Errors.Select(e=>e.Description)));
    }
}
