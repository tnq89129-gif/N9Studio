using Backend.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace Backend.Controllers;
[ApiController, Route("api/san-pham")]
public class CatalogController(ShopDbContext db) : ControllerBase {
    [HttpGet("danh-muc")]
    public async Task<IActionResult> Categories() => Ok(await db.Categories.AsNoTracking().Where(c=>c.IsActive).OrderBy(x=>x.Name).ToListAsync());
    [HttpGet]
    public async Task<IActionResult> List(string? search, int? categoryId, string? size, string? color, decimal? minPrice, decimal? maxPrice, int page=1, int pageSize=12) {
        page=Math.Max(1,page); pageSize=Math.Clamp(pageSize,1,100);
        if(page>100000) return BadRequest("Trang quá lớn.");
        var q=db.Products.AsNoTracking().Where(p=>p.IsActive && p.Category.IsActive);
        if(!string.IsNullOrWhiteSpace(search)) q=q.Where(p=>p.Name.Contains(search));
        if(categoryId.HasValue) q=q.Where(p=>p.CategoryId==categoryId);
        q=q.Where(p=>p.Variants.Any(v=>v.IsActive && (size==null || v.Size==size) && (color==null || v.Color==color) && (!minPrice.HasValue || v.Price>=minPrice) && (!maxPrice.HasValue || v.Price<=maxPrice)));
        var total=await q.CountAsync();
        var items=await q.OrderByDescending(p=>p.Id).Skip((page-1)*pageSize).Take(pageSize)
            .Select(p=>new { p.Id,p.Name,p.Description,p.Tag,p.ImageUrl,p.CategoryId,Variants=p.Variants.Where(v=>v.IsActive).Select(v=>new {v.Id,v.Size,v.Color,v.Price,v.Stock}) }).ToListAsync();
        return Ok(new {total,page,pageSize,items});
    }
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Detail(int id) {
        var p=await db.Products.AsNoTracking().Where(p=>p.Id==id && p.IsActive && p.Category.IsActive).Select(p=>new {
            p.Id,p.Name,p.Description,p.Tag,p.ImageUrl,p.CategoryId,Category=p.Category.Name,
            Variants=p.Variants.Where(v=>v.IsActive).Select(v=>new {v.Id,v.Size,v.Color,v.Price,v.Stock}).ToList()
        }).SingleOrDefaultAsync();
        if(p==null)return NotFound();
        var reviews=await db.Reviews.AsNoTracking().Where(r=>r.ProductId==id && r.IsVisible)
            .OrderByDescending(r=>r.Id).Take(100)
            .Select(r=>new {r.Id,r.User.FullName,r.Rating,r.Content,r.CreatedAt}).ToListAsync();
        return Ok(new {p.Id,p.Name,p.Description,p.Tag,p.ImageUrl,p.CategoryId,p.Category,p.Variants,Reviews=reviews});
    }
}
