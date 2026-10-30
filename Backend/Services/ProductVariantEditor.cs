using Backend.Contracts;
using Backend.Data;
using Backend.Models;
using Microsoft.EntityFrameworkCore;
using System.Text;
namespace Backend.Services;
public static class ProductVariantEditor {
    private static string Clean(string s)=>CategoryRules.Name(s);
    private static string Key(string size,string color)=>size.Normalize(NormalizationForm.FormC).ToUpperInvariant()+"\n"+color.Normalize(NormalizationForm.FormC).ToUpperInvariant();
    // Caller owns a serializable transaction. Retain IDs so carts/order history keep their references.
    public static async Task ApplyAsync(ShopDbContext db,Product product,IReadOnlyList<ProductVariantRequest> requests) {
        if(requests.Count>200)throw new ArgumentException("Mỗi sản phẩm tối đa 200 biến thể.");
        var existing=product.Variants.ToArray();
        var plans=new List<(ProductVariant Entity,ProductVariantRequest Request)>();
        var keys=new HashSet<string>();var ids=new HashSet<int>();
        foreach(var raw in requests) {
            var r=raw with {Size=Clean(raw.Size),Color=Clean(raw.Color)};
            if(r.Size.Length is <1 or >30 || r.Color.Length is <1 or >50 || r.Price<1 || r.Price>999999999999m || r.Stock<0 || r.Stock>1000000)
                throw new ArgumentException("Nhập đủ size, màu, giá lớn hơn 0 và tồn kho từ 0 đến 1.000.000.");
            var key=Key(r.Size,r.Color);
            if(!keys.Add(key))throw new ArgumentException("Không được trùng size và màu trong cùng sản phẩm.");
            var entity=r.Id.HasValue?existing.SingleOrDefault(v=>v.Id==r.Id):existing.FirstOrDefault(v=>Key(v.Size,v.Color)==key);
            if(r.Id.HasValue && entity==null)throw new ArgumentException("Biến thể không thuộc sản phẩm này. Hãy tải lại dữ liệu.");
            if(entity!=null && !ids.Add(entity.Id))throw new ArgumentException("Một biến thể không được xuất hiện ở hai dòng.");
            plans.Add((entity??new ProductVariant(),r));
        }
        foreach(var plan in plans) {
            var blocker=existing.FirstOrDefault(v=>v.Id!=plan.Entity.Id && Key(v.Size,v.Color)==Key(plan.Request.Size,plan.Request.Color));
            if(blocker!=null && !plans.Any(p=>p.Entity.Id==blocker.Id && Key(p.Request.Size,p.Request.Color)!=Key(blocker.Size,blocker.Color)))
                throw new ArgumentException("Size/màu đã thuộc một dòng khác, kể cả dòng ngừng bán. Hãy sửa hoặc bật lại dòng đó.");
        }
        // Temporarily free unique keys to support swapping sizes/colors in a single atomic edit.
        var changed=plans.Where(p=>p.Entity.Id!=0 && Key(p.Entity.Size,p.Entity.Color)!=Key(p.Request.Size,p.Request.Color)).ToArray();
        foreach(var plan in changed)plan.Entity.Size="tmp-"+Guid.NewGuid().ToString("N")[..20];
        if(changed.Length>0)await db.SaveChangesAsync();
        foreach(var v in existing)if(!ids.Contains(v.Id))v.IsActive=false;
        foreach(var plan in plans) {
            var v=plan.Entity;var r=plan.Request;
            v.Size=r.Size;v.Color=r.Color;v.Price=r.Price;v.Stock=r.Stock;v.IsActive=r.IsActive;
            if(v.Id==0)product.Variants.Add(v);
        }
    }
}
