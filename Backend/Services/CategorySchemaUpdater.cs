using Backend.Data;
using Microsoft.EntityFrameworkCore;
namespace Backend.Services;
public static class CategorySchemaUpdater {
    public static async Task UpdateAsync(ShopDbContext db,string contentRoot) {
        if (db.Database.IsNpgsql()) {
            var postgresScript = await File.ReadAllTextAsync(Path.Combine(contentRoot, "Sql", "UpdatePostgreSql.sql"));
            await using var postgresTransaction = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlRawAsync("SET LOCAL lock_timeout = '15s'; SELECT pg_advisory_xact_lock(9129412026);");
            await db.Database.ExecuteSqlRawAsync(postgresScript);
            await postgresTransaction.CommitAsync();
            Console.WriteLine("PostgreSQL category/product schema is up to date. Existing IDs and data were preserved.");
            return;
        }
        var script=await File.ReadAllTextAsync(Path.Combine(contentRoot,"Sql","UpdateCategories.sql"));
        await using var tx=await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync("DECLARE @result int; EXEC @result = sp_getapplock @Resource=N'FashionShop.CategorySchema', @LockMode=N'Exclusive', @LockOwner=N'Transaction', @LockTimeout=15000; IF @result < 0 THROW 51001, 'Category schema upgrade is busy. Try again later.', 1;");
        await db.Database.ExecuteSqlRawAsync(script);
        var productScript=await File.ReadAllTextAsync(Path.Combine(contentRoot,"Sql","UpdateProducts.sql"));
        await db.Database.ExecuteSqlRawAsync(productScript);
        await tx.CommitAsync();
        Console.WriteLine("Category/product schema is up to date. Existing IDs, products and accounts were preserved.");
    }
}
