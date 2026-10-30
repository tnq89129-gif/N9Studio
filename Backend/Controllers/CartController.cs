using Backend.Contracts;
using Backend.Data;
using Backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Data;
namespace Backend.Controllers;
[ApiController, Authorize, Route("api/gio-hang")]
public class CartController(ShopDbContext db) : ControllerBase {
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await db.CartItems.AsNoTracking().Where(x=>x.UserId==UserId)
        .Select(x=>new {x.Id,x.VariantId,x.Quantity,Product=x.Variant.Product.Name,ImageUrl=x.Variant.Product.ImageUrl,x.Variant.Size,x.Variant.Color,x.Variant.Price,x.Variant.Stock,Available=x.Variant.IsActive && x.Variant.Product.IsActive && x.Variant.Product.Category.IsActive,Subtotal=x.Quantity*x.Variant.Price}).ToListAsync());
    [HttpPost]
    public async Task<IActionResult> Add(CartRequest r) {
        await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var v=await db.Variants.Include(v=>v.Product).ThenInclude(p=>p.Category).SingleOrDefaultAsync(v=>v.Id==r.VariantId);
        if(v==null || !v.IsActive || !v.Product.IsActive || !v.Product.Category.IsActive) return NotFound();
        var item=await db.CartItems.SingleOrDefaultAsync(x=>x.UserId==UserId && x.VariantId==r.VariantId);
        var quantity=(item?.Quantity??0)+r.Quantity;
        if(quantity>99 || quantity>v.Stock) return BadRequest("Số lượng vượt tồn kho hoặc giới hạn 99.");
        if(item==null) db.CartItems.Add(new CartItem {UserId=UserId,VariantId=r.VariantId,Quantity=quantity});
        else item.Quantity=quantity;
        await db.SaveChangesAsync(); await tx.CommitAsync(); return NoContent();
    }
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id,QuantityRequest r) {
        var item=await db.CartItems.Include(x=>x.Variant).ThenInclude(v=>v.Product).ThenInclude(p=>p.Category).SingleOrDefaultAsync(x=>x.Id==id && x.UserId==UserId);
        if(item==null) return NotFound();
        if(!item.Variant.IsActive || !item.Variant.Product.IsActive || !item.Variant.Product.Category.IsActive || r.Quantity>item.Variant.Stock) return BadRequest("Sản phẩm không khả dụng hoặc không đủ hàng.");
        item.Quantity=r.Quantity; await db.SaveChangesAsync(); return NoContent();
    }
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id) {
        var count=await db.CartItems.Where(x=>x.Id==id && x.UserId==UserId).ExecuteDeleteAsync();
        return count==0 ? NotFound() : NoContent();
    }
}
