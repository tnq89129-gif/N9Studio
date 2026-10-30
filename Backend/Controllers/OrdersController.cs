using Backend.Contracts;
using Backend.Data;
using Backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data;
using System.Security.Claims;
namespace Backend.Controllers;
[ApiController, Authorize, Route("api/don-hang")]
public class OrdersController(ShopDbContext db) : ControllerBase {
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    [HttpGet]
    public async Task<IActionResult> Mine(int page=1) {
        page=Math.Clamp(page,1,100000);
        var q=db.Orders.AsNoTracking().Where(o=>o.UserId==UserId);
        return Ok(new {total=await q.CountAsync(),items=await q.OrderByDescending(o=>o.Id).Skip((page-1)*20).Take(20).Select(o=>new {o.Id,o.CreatedAt,o.Status,o.Total,o.Recipient,o.Phone,o.Address,o.Note,Lines=o.Lines.Select(l=>new {l.VariantId,l.ProductName,l.Size,l.Color,l.UnitPrice,l.Quantity})}).ToListAsync()});
    }
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Detail(int id) {
        var o=await db.Orders.AsNoTracking().Where(o=>o.Id==id && o.UserId==UserId).Select(o=>new {
            o.Id,o.CreatedAt,o.Status,o.Total,o.Recipient,o.Phone,o.Address,o.Note,
            PaymentMethod="COD",Lines=o.Lines.Select(l=>new {l.VariantId,l.ProductName,l.Size,l.Color,l.UnitPrice,l.Quantity})
        }).SingleOrDefaultAsync();
        return o==null ? NotFound() : Ok(o);
    }
    [HttpPost]
    public async Task<IActionResult> Checkout(CheckoutRequest r) {
        await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var cart=await db.CartItems.Include(x=>x.Variant).ThenInclude(v=>v.Product).ThenInclude(p=>p.Category).Where(x=>x.UserId==UserId).OrderBy(x=>x.VariantId).ToListAsync();
        if(cart.Count==0) return BadRequest("Giỏ hàng trống.");
        var order=new Order { UserId=UserId,Recipient=r.Recipient,Phone=r.Phone,Address=r.Address,Note=r.Note };
        foreach(var item in cart) {
            var v=item.Variant;
            if(!v.IsActive || !v.Product.IsActive || !v.Product.Category.IsActive) return Conflict("Sản phẩm đã ngừng bán.");
            var changed=await db.Variants.Where(x=>x.Id==v.Id && x.Stock>=item.Quantity && x.IsActive)
                .ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Stock,x=>x.Stock-item.Quantity));
            if(changed!=1) return Conflict($"Không đủ hàng: {v.Product.Name}, {v.Size}, {v.Color}.");
            order.Lines.Add(new OrderLine {VariantId=v.Id,ProductName=v.Product.Name,Size=v.Size,Color=v.Color,UnitPrice=v.Price,Quantity=item.Quantity});
        }
        order.Total=order.Lines.Sum(l=>l.UnitPrice*l.Quantity);
        db.Orders.Add(order); db.CartItems.RemoveRange(cart);
        await db.SaveChangesAsync(); await tx.CommitAsync();
        return CreatedAtAction(nameof(Detail),new {id=order.Id},new {order.Id,order.Total,order.Status});
    }
    [HttpPost("{id:int}/huy")]
    public async Task<IActionResult> Cancel(int id) {
        await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var order=await db.Orders.Include(o=>o.Lines).SingleOrDefaultAsync(o=>o.Id==id && o.UserId==UserId);
        if(order==null) return NotFound();
        if(order.Status!=OrderStatus.Pending) return Conflict("Chỉ hủy được đơn chờ xác nhận.");
        var changed=await db.Orders.Where(o=>o.Id==id && o.Status==OrderStatus.Pending).ExecuteUpdateAsync(s=>s.SetProperty(o=>o.Status,OrderStatus.Cancelled));
        if(changed!=1) return Conflict("Trạng thái đơn đã thay đổi.");
        foreach(var line in order.Lines.OrderBy(l=>l.VariantId))
            await db.Variants.Where(v=>v.Id==line.VariantId).ExecuteUpdateAsync(s=>s.SetProperty(v=>v.Stock,v=>v.Stock+line.Quantity));
        await tx.CommitAsync(); return NoContent();
    }
}
