using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;
namespace Backend.Models;
public class ShopUser : IdentityUser {
    [MaxLength(100)] public string FullName { get; set; } = "";
    [MaxLength(500)] public string Address { get; set; } = "";
}
public class Category {
    public int Id { get; set; }
    [MaxLength(100)] public string Name { get; set; } = "";
    [MaxLength(60)] public string Code { get; set; } = "";
    [MaxLength(240)] public string Description { get; set; } = "";
    public bool IsActive { get; set; } = true;
}
public class Product {
    public int Id { get; set; }
    [MaxLength(200)] public string Name { get; set; } = "";
    [MaxLength(5000)] public string Description { get; set; } = "";
    [MaxLength(30)] public string Tag { get; set; } = "";
    [MaxLength(2000)] public string ImageUrl { get; set; } = "";
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;
    public bool IsActive { get; set; } = true;
    public List<ProductVariant> Variants { get; set; } = [];
}
public class ProductVariant {
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    [MaxLength(30)] public string Size { get; set; } = "";
    [MaxLength(50)] public string Color { get; set; } = "";
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public bool IsActive { get; set; } = true;
}
public class CartItem {
    public int Id { get; set; }
    public string UserId { get; set; } = "";
    public ShopUser User { get; set; } = null!;
    public int VariantId { get; set; }
    public ProductVariant Variant { get; set; } = null!;
    public int Quantity { get; set; }
}
public enum OrderStatus { Pending, Confirmed, Shipping, Delivered, Cancelled }
public class Order {
    public int Id { get; set; }
    public string UserId { get; set; } = "";
    public ShopUser User { get; set; } = null!;
    [MaxLength(100)] public string Recipient { get; set; } = "";
    [MaxLength(30)] public string Phone { get; set; } = "";
    [MaxLength(500)] public string Address { get; set; } = "";
    [MaxLength(1000)] public string Note { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public OrderStatus Status { get; set; }
    public decimal Total { get; set; }
    public List<OrderLine> Lines { get; set; } = [];
}
public class OrderLine {
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public int VariantId { get; set; }
    public ProductVariant Variant { get; set; } = null!;
    [MaxLength(200)] public string ProductName { get; set; } = "";
    [MaxLength(30)] public string Size { get; set; } = "";
    [MaxLength(50)] public string Color { get; set; } = "";
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
}
public class Review {
    public int Id { get; set; }
    public string UserId { get; set; } = "";
    public ShopUser User { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int Rating { get; set; }
    [MaxLength(2000)] public string Content { get; set; } = "";
    public bool IsVisible { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
