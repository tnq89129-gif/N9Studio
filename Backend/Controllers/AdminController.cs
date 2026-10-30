using Backend.Contracts;
using Backend.Data;
using Backend.Models;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace Backend.Controllers;

[ApiController, Authorize(Roles="Admin"), Route("api/quan-tri")]
public class AdminController(ShopDbContext db) : ControllerBase {
    [HttpGet("tong-quan")]
    public async Task<IActionResult> Dashboard() => Ok(new {
        CartQuantity=await db.CartItems.SumAsync(x=>(int?)x.Quantity)??0,
        Customers=await db.Users.CountAsync(), Products=await db.Products.CountAsync(),
        Orders=await db.Orders.CountAsync(), Pending=await db.Orders.CountAsync(o=>o.Status==OrderStatus.Pending),
        Revenue=await db.Orders.Where(o=>o.Status==OrderStatus.Delivered).SumAsync(o=>(decimal?)o.Total)??0,
        BestSellers=await db.OrderLines.Where(l=>l.Order.Status==OrderStatus.Delivered)
            .GroupBy(l=>new {l.Variant.ProductId,l.ProductName}).Select(g=>new {g.Key.ProductId,g.Key.ProductName,Quantity=g.Sum(l=>l.Quantity),Revenue=g.Sum(l=>l.UnitPrice*l.Quantity)})
            .OrderByDescending(x=>x.Quantity).Take(10).ToListAsync()
    });

    [HttpGet("khach-hang")]
    public async Task<IActionResult> Customers(string? search,int page=1) {
        page=Math.Clamp(page,1,100000);
        var q=db.Users.AsNoTracking();
        if(!string.IsNullOrWhiteSpace(search)) q=q.Where(u=>u.FullName.Contains(search) || (u.Email!=null && u.Email.Contains(search)));
        return Ok(new {total=await q.CountAsync(),items=await q.OrderBy(u=>u.Id).Skip((page-1)*20).Take(20).Select(u=>new {u.Id,u.Email,u.FullName,u.PhoneNumber,u.Address}).ToListAsync()});
    }

    [HttpGet("san-pham")]
    public async Task<IActionResult> Products(int page=1) {
        page=Math.Clamp(page,1,100000);
        return Ok(new {total=await db.Products.CountAsync(),items=await db.Products.AsNoTracking().OrderByDescending(p=>p.Id).Skip((page-1)*20).Take(20).Select(p=>new {p.Id,p.Name,p.Description,p.Tag,p.ImageUrl,p.CategoryId,p.IsActive,Variants=p.Variants.Select(v=>new {v.Id,v.Size,v.Color,v.Price,v.Stock,v.IsActive})}).ToListAsync()});
    }

    [HttpPost("san-pham")]
    public async Task<IActionResult> AddProduct(ProductRequest r) => await SaveProduct(null,r);

    [HttpPut("san-pham/{id:int}")]
    public async Task<IActionResult> EditProduct(int id,ProductRequest r) => await SaveProduct(id,r);

    private async Task<IActionResult> SaveProduct(int? id,ProductRequest r) {
        if(string.IsNullOrWhiteSpace(r.Name))return BadRequest("Tên sản phẩm không được trống.");
        if(!ValidImage(r.ImageUrl))return BadRequest("Ảnh phải là đường dẫn /images/... hoặc URL HTTPS.");
        if(r.Variants!=null && r.IsActive && !r.Variants.Any(v=>v.IsActive))
            return BadRequest("Sản phẩm đang hiển thị cần ít nhất một dòng size/màu đang bán.");
        
        await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        if(!await db.Categories.AnyAsync(c=>c.Id==r.CategoryId))return BadRequest("Danh mục không tồn tại.");
        
        var p=id.HasValue?await db.Products.Include(p=>p.Variants).SingleOrDefaultAsync(p=>p.Id==id.Value):new Product();
        if(p==null)return NotFound();
        if(!id.HasValue)db.Products.Add(p);
        
        p.Name=r.Name.Trim();p.Description=r.Description;p.ImageUrl=r.ImageUrl;p.CategoryId=r.CategoryId;p.IsActive=r.IsActive;
        if(r.Tag!=null)p.Tag=r.Tag.Trim();
        
        try {
            if(r.Variants!=null)await ProductVariantEditor.ApplyAsync(db,p,r.Variants);
            await db.SaveChangesAsync();await tx.CommitAsync();
            return id.HasValue?NoContent():Ok(new {p.Id});
        }
        catch(ArgumentException e){return BadRequest(e.Message);}
        catch(DbUpdateException) {return Conflict("Dữ liệu bị trùng hoặc không hợp lệ. Kiểm tra lại size/màu.");}
    }

    [HttpDelete("san-pham/{id:int}")]
    public async Task<IActionResult> HideProduct(int id) => 
        await db.Products.Where(p=>p.Id==id).ExecuteUpdateAsync(s=>s.SetProperty(p=>p.IsActive,false))==0 ? NotFound() : NoContent();

    [HttpPost("san-pham/{productId:int}/bien-the")]
    public async Task<IActionResult> AddVariant(int productId,VariantRequest r) {
        if(!await db.Products.AnyAsync(p=>p.Id==productId))return NotFound();
        var v=new ProductVariant {ProductId=productId,Size=r.Size.Trim(),Color=r.Color.Trim(),Price=r.Price,Stock=r.Stock,IsActive=r.IsActive};
        db.Variants.Add(v);
        try{await db.SaveChangesAsync();}catch(DbUpdateException){return Conflict("Size và màu đã tồn tại.");}
        return Ok(new {v.Id});
    }

    [HttpPut("bien-the/{id:int}")]
    public async Task<IActionResult> EditVariant(int id,VariantRequest r) {
        await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var v=await db.Variants.FindAsync(id);if(v==null)return NotFound();
        v.Size=r.Size.Trim();v.Color=r.Color.Trim();v.Price=r.Price;v.Stock=r.Stock;v.IsActive=r.IsActive;
        try{await db.SaveChangesAsync();}catch(DbUpdateException){return Conflict("Dữ liệu biến thể không hợp lệ hoặc trùng size/màu.");}
        await tx.CommitAsync();return NoContent();
    }

    [HttpDelete("bien-the/{id:int}")]
    public async Task<IActionResult> HideVariant(int id) => 
        await db.Variants.Where(v=>v.Id==id).ExecuteUpdateAsync(s=>s.SetProperty(v=>v.IsActive,false))==0 ? NotFound() : NoContent();

    [HttpGet("don-hang")]
    public async Task<IActionResult> Orders(OrderStatus? status,string? userId,int page=1) {
        page=Math.Clamp(page,1,100000);
        var q=db.Orders.AsNoTracking();
        if(status.HasValue)q=q.Where(o=>o.Status==status);
        if(userId!=null)q=q.Where(o=>o.UserId==userId);
        return Ok(new {total=await q.CountAsync(),items=await q.OrderByDescending(o=>o.Id).Skip((page-1)*20).Take(20).Select(o=>new {o.Id,o.UserId,Email=o.User.Email,o.Recipient,o.Phone,o.Address,o.Note,o.Status,o.Total,o.CreatedAt,Lines=o.Lines.Select(l=>new {l.VariantId,l.ProductName,l.Size,l.Color,l.UnitPrice,l.Quantity})}).ToListAsync()});
    }

    [HttpGet("don-hang/{id:int}")]
    public async Task<IActionResult> Order(int id) {
        var order=await db.Orders.AsNoTracking().Where(o=>o.Id==id).Select(o=>new {o.Id,o.UserId,Email=o.User.Email,o.Recipient,o.Phone,o.Address,o.Note,o.CreatedAt,o.Status,o.Total,PaymentMethod="COD",Lines=o.Lines.Select(l=>new {l.VariantId,l.ProductName,l.Size,l.Color,l.UnitPrice,l.Quantity})}).SingleOrDefaultAsync();
        return order==null ? NotFound() : Ok(order);
    }

    [HttpPut("don-hang/{id:int}/trang-thai")]
    public async Task<IActionResult> Status(int id,StatusRequest r) {
        await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var order=await db.Orders.Include(o=>o.Lines).SingleOrDefaultAsync(o=>o.Id==id);
        if(order==null)return NotFound();
        
        var allowed=(order.Status,r.Status) switch {
            (OrderStatus.Pending,OrderStatus.Confirmed)=>true,
            (OrderStatus.Pending,OrderStatus.Cancelled)=>true,
            (OrderStatus.Confirmed,OrderStatus.Shipping)=>true,
            (OrderStatus.Confirmed,OrderStatus.Cancelled)=>true,
            (OrderStatus.Shipping,OrderStatus.Delivered)=>true,
            _=>false
        };
        if(!allowed)return Conflict("Không được chuyển sang trạng thái này.");
        
        var changed=await db.Orders.Where(o=>o.Id==id && o.Status==order.Status).ExecuteUpdateAsync(s=>s.SetProperty(o=>o.Status,r.Status));
        if(changed!=1)return Conflict("Trạng thái vừa thay đổi.");
        
        if(r.Status==OrderStatus.Cancelled)
            foreach(var line in order.Lines.OrderBy(l=>l.VariantId))
                await db.Variants.Where(v=>v.Id==line.VariantId).ExecuteUpdateAsync(s=>s.SetProperty(v=>v.Stock,v=>v.Stock+line.Quantity));
        
        await tx.CommitAsync();return NoContent();
    }

    [HttpGet("danh-gia")]
    public async Task<IActionResult> Reviews(int page=1) {
        page=Math.Clamp(page,1,100000);
        return Ok(new {total=await db.Reviews.CountAsync(),items=await db.Reviews.AsNoTracking().OrderByDescending(r=>r.Id).Skip((page-1)*20).Take(20).Select(r=>new {r.Id,r.ProductId,ProductName=r.Product.Name,r.UserId,r.User.FullName,r.Rating,r.Content,r.IsVisible,r.CreatedAt}).ToListAsync()});
    }

    [HttpPut("danh-gia/{id:int}")]
    public async Task<IActionResult> Moderate(int id,VisibilityRequest r) => 
        await db.Reviews.Where(x=>x.Id==id).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.IsVisible,r.IsVisible))==0 ? NotFound() : NoContent();

    private static bool ValidImage(string? s) => 
        string.IsNullOrEmpty(s) || 
        (s.StartsWith("/images/") && !s.Contains("..") && !s.Contains('\\')) || 
        (Uri.TryCreate(s,UriKind.Absolute,out var uri) && uri.Scheme=="https");
}