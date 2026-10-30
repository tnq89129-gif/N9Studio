using Backend.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
namespace Backend.Data;
public class ShopDbContext(DbContextOptions<ShopDbContext> options) : IdentityDbContext<ShopUser>(options) {
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> Variants => Set<ProductVariant>();
    public DbSet<CartItem> CartItems => Set<CartItem>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderLine> OrderLines => Set<OrderLine>();
    public DbSet<Review> Reviews => Set<Review>();
    protected override void OnModelCreating(ModelBuilder b) {
        base.OnModelCreating(b);
        b.Entity<Category>().HasIndex(x => x.Name).IsUnique();
        b.Entity<Category>().HasIndex(x => x.Code).IsUnique();
        b.Entity<Category>().Property(x => x.IsActive).HasDefaultValue(true);
        b.Entity<Category>().Property(x => x.Description).HasDefaultValue("");
        b.Entity<ProductVariant>().HasIndex(x => new { x.ProductId, x.Size, x.Color }).IsUnique();
        b.Entity<CartItem>().HasIndex(x => new { x.UserId, x.VariantId }).IsUnique();
        b.Entity<Review>().HasIndex(x => new { x.UserId, x.ProductId }).IsUnique();
        b.Entity<ProductVariant>().Property(x => x.Price).HasPrecision(18,2);
        b.Entity<Order>().Property(x => x.Total).HasPrecision(18,2);
        b.Entity<OrderLine>().Property(x => x.UnitPrice).HasPrecision(18,2);
        b.Entity<Order>().Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
        // Avoid multiple cascade paths in SQL Server; preserve historical order references.
        foreach (var fk in b.Model.GetEntityTypes().SelectMany(t => t.GetForeignKeys()))
            fk.DeleteBehavior = DeleteBehavior.Restrict;
        b.Entity<ProductVariant>().ToTable(t => t.HasCheckConstraint("CK_Variant_Values", Database.IsNpgsql() ? "\"Stock\" >= 0 AND \"Price\" > 0" : "[Stock] >= 0 AND [Price] > 0"));
        b.Entity<CartItem>().ToTable(t => t.HasCheckConstraint("CK_Cart_Quantity", Database.IsNpgsql() ? "\"Quantity\" BETWEEN 1 AND 99" : "[Quantity] BETWEEN 1 AND 99"));
        b.Entity<Review>().ToTable(t => t.HasCheckConstraint("CK_Review_Rating", Database.IsNpgsql() ? "\"Rating\" BETWEEN 1 AND 5" : "[Rating] BETWEEN 1 AND 5"));
    }
}
