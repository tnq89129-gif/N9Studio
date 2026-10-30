using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

[ApiController, Authorize(Roles = "Admin"), Route("api/quan-tri/anh-san-pham")]
public class ProductImagesController(ProductImageStore images, ILogger<ProductImagesController> logger) : ControllerBase
{
    [HttpGet]
    public IActionResult List() => Ok(images.List());

    // The global AutoValidateAntiforgeryToken filter also protects this multipart request.
    [HttpPost, RequestSizeLimit(6 * 1024 * 1024), RequestFormLimits(MultipartBodyLengthLimit = 6 * 1024 * 1024)]
    public async Task<IActionResult> Upload([FromForm] IFormFile? file, CancellationToken cancellationToken)
    {
        try { return Ok(await images.SaveAsync(file, cancellationToken)); }
        catch (ArgumentException e) { return BadRequest(new { message = e.Message }); }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            logger.LogError(e, "Cannot save product image");
            return StatusCode(500, new { message = "Không lưu được ảnh. Kiểm tra dung lượng và quyền ghi thư mục wwwroot/images/san-pham rồi thử lại." });
        }
    }
}
