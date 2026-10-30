using System.Data.Common;
using Npgsql;

namespace Backend.Services;

public static class DatabaseProvider
{
    public static bool IsPostgreSql(string connection, string? provider)
    {
        if (string.Equals(provider, "PostgreSql", StringComparison.OrdinalIgnoreCase)
            || string.Equals(provider, "Postgres", StringComparison.OrdinalIgnoreCase)) return true;
        if (string.Equals(provider, "SqlServer", StringComparison.OrdinalIgnoreCase)) return false;
        if (!string.IsNullOrWhiteSpace(provider) && !provider.Equals("Auto", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Database:Provider must be Auto, SqlServer or PostgreSql.");
        if (connection.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            || connection.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)) return true;
        return new DbConnectionStringBuilder { ConnectionString = connection }.ContainsKey("Host");
    }

    public static string PostgreSqlConnection(string connection)
    {
        if (!connection.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !connection.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            return new NpgsqlConnectionStringBuilder(connection).ConnectionString;
        if (!Uri.TryCreate(connection, UriKind.Absolute, out var uri) || string.IsNullOrEmpty(uri.Host))
            throw new InvalidOperationException("Invalid PostgreSQL connection URL.");
        var credentials = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder {
            Host = uri.Host.Trim('[', ']'), Port = uri.Port > 0 ? uri.Port : 5432,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = Uri.UnescapeDataString(credentials[0]),
            Password = credentials.Length == 2 ? Uri.UnescapeDataString(credentials[1]) : "",
            SslMode = SslMode.Require, Timeout = 30
        };
        foreach (var item in Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(uri.Query))
        {
            if (item.Key.Equals("sslmode", StringComparison.OrdinalIgnoreCase))
            {
                if (!Enum.TryParse<SslMode>(item.Value.ToString().Replace("-", ""), true, out var mode))
                    throw new InvalidOperationException("Invalid PostgreSQL sslmode.");
                builder.SslMode = mode;
            }
            else if (item.Key.Equals("connect_timeout", StringComparison.OrdinalIgnoreCase))
            {
                if (!int.TryParse(item.Value, out var seconds) || seconds < 1)
                    throw new InvalidOperationException("Invalid PostgreSQL connect_timeout.");
                builder.Timeout = seconds;
            }
            else throw new InvalidOperationException("Unsupported PostgreSQL URL option. Use an Npgsql key/value connection string for advanced options.");
        }
        if (string.IsNullOrWhiteSpace(builder.Database) || string.IsNullOrWhiteSpace(builder.Username))
            throw new InvalidOperationException("PostgreSQL database and username are required.");
        return builder.ConnectionString;
    }
}
