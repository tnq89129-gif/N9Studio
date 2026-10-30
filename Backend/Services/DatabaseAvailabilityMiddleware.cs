
namespace Backend.Services;

public sealed class DatabaseAvailabilityMiddleware(RequestDelegate next, ILogger<DatabaseAvailabilityMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try { await next(context); }
        catch (Exception e) when (context.Request.Path.StartsWithSegments("/api")
            && !context.Response.HasStarted && DatabaseErrors.IsDatabaseFailure(e))
        {
            logger.LogError(e, "Database unavailable. Configure ConnectionStrings__DefaultConnection and Database__Provider for SQL Server or PostgreSQL, then initialize/import the matching schema. LocalDB is Windows-only.");
            context.Response.Clear();
            context.Response.StatusCode = DatabaseErrors.IsTransactionConflict(e) ? StatusCodes.Status409Conflict : StatusCodes.Status503ServiceUnavailable;
            context.Response.Headers.CacheControl = "no-store";
            await context.Response.WriteAsJsonAsync(new { message = DatabaseErrors.IsTransactionConflict(e) ? "Dữ liệu vừa thay đổi. Vui lòng tải lại và kiểm tra trạng thái trước khi thử lại." : "Hệ thống dữ liệu đang tạm gián đoạn. Vui lòng thử lại sau hoặc liên hệ N9 Studio." });
        }
    }

}
