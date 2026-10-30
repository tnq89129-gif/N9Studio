using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
namespace Backend.Services;
public static class CatalogSeeder {
    private sealed record SeedProduct(string Name, string Description, string ImageUrl, string Category, decimal Price, string[] Colors);
    public static async Task SeedAsync(ShopDbContext db, string contentRoot) {
        if (await db.Products.AnyAsync())
            throw new InvalidOperationException("Catalog already contains products; sample import was not applied.");
        var json=await File.ReadAllTextAsync(Path.Combine(contentRoot,"Data","catalog-seed.json"));
        var source=JsonSerializer.Deserialize<List<SeedProduct>>(json,new JsonSerializerOptions {PropertyNameCaseInsensitive=true})
            ?? throw new InvalidOperationException("Invalid catalog seed.");
        var labels=new Dictionary<string,string> {
            ["women"]="Thời trang nữ", ["women outerwear"]="Thời trang nữ · Áo khoác",
            ["men"]="Thời trang nam", ["men outerwear"]="Thời trang nam · Áo khoác", ["outerwear"]="Áo khoác"
        };
        await using var tx=await db.Database.BeginTransactionAsync();
        foreach(var row in source) {
            var label=labels.GetValueOrDefault(row.Category,row.Category);
            var category=await db.Categories.SingleOrDefaultAsync(c=>c.Name==label);
            if(category==null) {category=new Category {Name=label,Code=CategoryRules.Slug(label)};db.Categories.Add(category);await db.SaveChangesAsync();}
            var product=new Product {Name=row.Name,Description=row.Description,ImageUrl=row.ImageUrl,CategoryId=category.Id};
            foreach(var size in new[]{"S","M","L","XL","XXL"})
                foreach(var color in row.Colors)
                    product.Variants.Add(new ProductVariant {Size=size,Color=color,Price=row.Price,Stock=0});
            db.Products.Add(product);await db.SaveChangesAsync();
        }
        await tx.CommitAsync();
    }
}
