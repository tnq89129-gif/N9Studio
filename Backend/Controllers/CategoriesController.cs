using Backend.Contracts;
using Backend.Data;
using Backend.Models;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace Backend.Controllers;

[ApiController, Authorize(Roles="Admin"), Route("api/quan-tri/danh-muc")]
public class CategoriesController(ShopDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() => Ok(await db.Categories.AsNoTracking().OrderBy(c => c.Id)
        .Select(c => new { c.Id, c.Name, c.Code, c.Description, c.IsActive, ProductCount = db.Products.Count(p => p.CategoryId == c.Id) }).ToListAsync());

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Detail(int id)
    {
        var category = await db.Categories.AsNoTracking().Where(c => c.Id == id)
            .Select(c => new { c.Id, c.Name, c.Code, c.Description, c.IsActive, ProductCount = db.Products.Count(p => p.CategoryId == c.Id) }).SingleOrDefaultAsync();
        return category == null ? NotFound() : Ok(category);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CategoryRequest request)
    {
        var name = CategoryRules.Name(request.Name);
        var code = request.Code == null ? CategoryRules.Slug(name) : CategoryRules.Code(request.Code);
        if (name.Length == 0 || !CategoryRules.ValidCode(code))
            return BadRequest("Tên không được trống; mã chỉ gồm chữ thường không dấu, số, gạch ngang hoặc khoảng trắng giữa các từ.");

        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        if (await Duplicate(name, code))
            return Conflict("Tên hoặc mã danh mục đã tồn tại.");

        var category = new Category { Name = name, Code = code, Description = request.Description?.Trim() ?? "", IsActive = request.IsActive };
        db.Categories.Add(category);
        try
        {
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Ok(new { category.Id });
        }
        catch (DbUpdateException)
        {
            return Conflict("Tên hoặc mã danh mục đã tồn tại.");
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, CategoryRequest request)
    {
        var name = CategoryRules.Name(request.Name);
        if (name.Length == 0)
            return BadRequest("Tên danh mục không được trống.");

        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var category = await db.Categories.FindAsync(id);
        if (category == null)
            return NotFound();

        var code = request.Code == null ? category.Code : CategoryRules.Code(request.Code);
        if (!CategoryRules.ValidCode(code))
            return BadRequest("Mã danh mục không hợp lệ.");
        if (await Duplicate(name, code, id))
            return Conflict("Tên hoặc mã danh mục đã tồn tại.");
        if (code != category.Code && await db.Products.AnyAsync(p => p.CategoryId == id))
            return Conflict("Không thể đổi mã danh mục đang có sản phẩm.");

        category.Name = name;
        category.Code = code;
        category.Description = request.Description?.Trim() ?? "";
        category.IsActive = request.IsActive;

        try
        {
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return NoContent();
        }
        catch (DbUpdateException)
        {
            return Conflict("Tên hoặc mã danh mục đã tồn tại.");
        }
    }

    [HttpPatch("{id:int}/trang-thai")]
    public async Task<IActionResult> Status(int id, CategoryStatusRequest request) =>
        await db.Categories.Where(c => c.Id == id).ExecuteUpdateAsync(s => s.SetProperty(c => c.IsActive, request.IsActive)) == 0
            ? NotFound()
            : NoContent();

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var category = await db.Categories.FindAsync(id);
        if (category == null)
            return NotFound();
        if (await db.Products.AnyAsync(p => p.CategoryId == id))
            return Conflict("Danh mục đang có sản phẩm, kể cả sản phẩm đã ngừng bán. Hãy chuyển sản phẩm sang danh mục khác trước khi xóa.");

        db.Categories.Remove(category);
        try
        {
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return NoContent();
        }
        catch (DbUpdateException)
        {
            return Conflict("Danh mục đang được sử dụng.");
        }
    }

    private Task<bool> Duplicate(string name, string code, int exceptId = 0)
    {
        var upper = name.ToUpperInvariant();
        return db.Categories.AnyAsync(c => c.Id != exceptId && (c.Name.ToUpper() == upper || c.Code == code));
    }
}