using Backend.Contracts;
using Backend.Data;
using Backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
namespace Backend.Controllers;
[ApiController, Authorize, Route("api/danh-gia")]
public class ReviewsController(ShopDbContext db) : ControllerBase {
    [HttpPut("{productId:int}")]
    public async Task<IActionResult> Save(int productId,ReviewRequest r) {
        var uid=User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var purchased=await db.OrderLines.AnyAsync(l=>l.Variant.ProductId==productId && l.Order.UserId==uid && l.Order.Status==OrderStatus.Delivered);
        if(!purchased) return BadRequest("Chỉ đánh giá sản phẩm trong đơn đã giao của bạn.");
        var review=await db.Reviews.SingleOrDefaultAsync(x=>x.UserId==uid && x.ProductId==productId);
        if(review==null) {review=new Review {UserId=uid,ProductId=productId};db.Reviews.Add(review);}
        review.Rating=r.Rating;review.Content=r.Content;
        try { await db.SaveChangesAsync(); }
        catch(DbUpdateException) { return Conflict("Đánh giá vừa được tạo. Hãy tải lại và thử lại."); }
        return Ok(new {review.Id});
    }
}
