using Microsoft.Data.SqlClient;
using Npgsql;

namespace Backend.Services;

public static class DatabaseErrors
{
    public static bool IsUnique(Exception error) => Any(error, e => e is SqlException { Number: 2601 or 2627 }
        || e is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation });
    public static bool IsForeignKey(Exception error) => Any(error, e => e is SqlException { Number: 547 }
        || e is PostgresException { SqlState: PostgresErrorCodes.ForeignKeyViolation });
    public static bool IsTransactionConflict(Exception error) => Any(error, e => e is SqlException { Number: 1205 }
        || e is PostgresException { SqlState: PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.DeadlockDetected });
    public static bool IsDatabaseFailure(Exception error) => Any(error, e => e is SqlException or NpgsqlException
        || e is PlatformNotSupportedException && e.Message.Contains("LocalDB", StringComparison.OrdinalIgnoreCase));
    private static bool Any(Exception error, Func<Exception, bool> predicate) => predicate(error)
        || error.InnerException != null && Any(error.InnerException, predicate);
}
