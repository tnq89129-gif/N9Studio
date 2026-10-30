using Backend.Data;
using Backend.Models;
using Backend.Services;
using Microsoft.EntityFrameworkCore;
using Npgsql;

static void Check(bool value, string message) { if (!value) throw new Exception(message); }
Check(!DatabaseProvider.IsPostgreSql("Server=(localdb)\\MSSQLLocalDB;Database=Test;Trusted_Connection=True", "Auto"), "Local SQL Server detection");
Check(!DatabaseProvider.IsPostgreSql("Server=localhost;Password=\"test;Host=inside-password\"", "Auto"), "Quoted passwords do not change provider detection");
Check(DatabaseProvider.IsPostgreSql("Host = localhost;Database=test;Username=test;Password=fake", "Auto"), "PostgreSQL key/value detection");
Check(DatabaseProvider.IsPostgreSql("postgresql://test:p%40ss%3Aword@localhost:5433/n9%2Dtest?sslmode=verify-full", "Auto"), "PostgreSQL URL detection");
var normalized = new NpgsqlConnectionStringBuilder(DatabaseProvider.PostgreSqlConnection("postgresql://test:p%40ss%3Aword@localhost:5433/n9%2Dtest?sslmode=verify-full"));
Check(normalized.Host == "localhost" && normalized.Port == 5433 && normalized.Database == "n9-test", "URL host/port/database");
Check(normalized.Username == "test" && normalized.Password == "p@ss:word" && normalized.SslMode == SslMode.VerifyFull, "URL credentials and SSL mode");
try { DatabaseProvider.IsPostgreSql("", "Unknown"); throw new Exception("Invalid provider accepted"); } catch (InvalidOperationException) { }
foreach (var invalid in new[] { "postgres://user:pass@host/db?sslmode=unknown", "postgres://user:pass@host/db?connect_timeout=0" })
{ try { DatabaseProvider.PostgreSqlConnection(invalid); throw new Exception("Invalid URL option accepted"); } catch (InvalidOperationException) { } }

using var pg = new ShopDbContext(new DbContextOptionsBuilder<ShopDbContext>().UseNpgsql("Host=localhost;Database=n9;Username=n9;Password=fake").Options);
var postgresSql = pg.Database.GenerateCreateScript();
Check(postgresSql.Contains("CREATE TABLE \"AspNetUsers\"") && postgresSql.Contains("\"Stock\" >= 0"), "PostgreSQL model and quoted constraints");
Check(!postgresSql.Contains("[Stock]") && !postgresSql.Contains("IDENTITY(1,1)"), "No SQL Server dialect in PostgreSQL schema");
using var sql = new ShopDbContext(new DbContextOptionsBuilder<ShopDbContext>().UseSqlServer("Server=localhost;Database=n9;Integrated Security=True;TrustServerCertificate=True").Options);
var sqlServerSql = sql.Database.GenerateCreateScript();
Check(sqlServerSql.Contains("CREATE TABLE [AspNetUsers]") && sqlServerSql.Contains("[Stock] >= 0"), "SQL Server compatibility");
var catalogQuery = pg.Products.Where(p => p.IsActive && p.Category.IsActive)
    .Select(p => new { p.Id, p.Name, Variants = p.Variants.Where(v => v.IsActive).Select(v => new { v.Size, v.Color, v.Price }) }).ToQueryString();
Check(catalogQuery.Contains("\"Products\"") && catalogQuery.Contains("\"Variants\""), "PostgreSQL catalog query translation");
var exception = new PostgresException("test", "ERROR", "ERROR", PostgresErrorCodes.UniqueViolation);
Check(DatabaseErrors.IsUnique(new DbUpdateException("test", exception)), "PostgreSQL unique violation mapping");
Check(DatabaseErrors.IsTransactionConflict(new PostgresException("test", "ERROR", "ERROR", PostgresErrorCodes.SerializationFailure)), "PostgreSQL serialization conflict mapping");
if (args.Length > 0)
{
    Directory.CreateDirectory(args[0]);
    await File.WriteAllTextAsync(Path.Combine(args[0], "postgres-schema.sql"), postgresSql);
    await File.WriteAllTextAsync(Path.Combine(args[0], "postgres-catalog-query.sql"), catalogQuery);
}
Console.WriteLine("PASS provider detection, PostgreSQL URL/SSL normalization, EF SQL Server/PostgreSQL model and SQL generation, catalog query translation and database error mapping. No database connection opened.");
