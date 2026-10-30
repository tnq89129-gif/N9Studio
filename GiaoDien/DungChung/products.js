(() => {
  function normalizeImagePath(image) {
    if (typeof image !== "string" || /^(?:https?:|data:|blob:)/i.test(image)) return image;

    const imagePath = image.split(/[?#]/, 1)[0];
    const match = imagePath.match(/(?:^|\/)Images\/(.+)$/i);
    if (!match) return image;

    const filename = match[1].split("/").pop();
    let decodedFilename;
    try {
      decodedFilename = decodeURIComponent(filename);
    } catch (error) {
      console.error("Đường dẫn ảnh sản phẩm có mã URL không hợp lệ:", image, error);
      return image;
    }
    return `../../Images/${encodeURIComponent(decodedFilename)}`;
  }

  window.storeCatalog = {
    storageKey: "products",
    normalizeImagePath,
    initial: [
      { id: "shirt-white", name: "Sơ mi trắng tối giản", price: 890000, image: "../../Images/7.jpg", description: "Áo sơ mi phom dáng thanh lịch, dễ kết hợp trong nhiều dịp.", colors: ["Trắng", "Đen", "Be"], category: "women", tag: "Được yêu thích", rating: 4.8, reviews: 126, published: true },
      { id: "blazer-black", name: "Blazer đen thanh lịch", price: 1290000, image: "../../Images/8.jpg", description: "Blazer phom đứng hiện đại, tạo điểm nhấn chỉn chu và thanh lịch.", colors: ["Đen", "Be", "Kem"], category: "women outerwear", tag: "Mới", rating: 4.9, reviews: 98, published: true },
      { id: "dress-brown", name: "Đầm nâu thanh lịch", price: 1150000, image: "../../Images/10.jpg", description: "Thiết kế đầm nữ tôn dáng với sắc nâu ấm áp, phù hợp nhiều dịp.", colors: ["Nâu", "Đen", "Be"], category: "women", tag: "Bộ sưu tập mới", rating: 4.7, reviews: 74, published: true },
      { id: "coat-classic", name: "Áo khoác dạ cổ điển", price: 1790000, image: "../../Images/11.jpg", description: "Áo khoác dạ dáng dài, giữ ấm và hoàn thiện vẻ ngoài cổ điển.", colors: ["Xám", "Đen", "Be"], category: "women outerwear", tag: "Thiết kế tinh tế", rating: 4.8, reviews: 52, published: true },
      { id: "set-minimal", name: "Set dạo phố tối giản", price: 1250000, image: "../../Images/12.jpg", description: "Set phối sẵn tối giản, tiện lợi cho những buổi dạo phố thường ngày.", colors: ["Xám", "Đen", "Trắng"], category: "women", tag: "Dễ phối đồ", rating: 4.6, reviews: 43, published: true },
      { id: "denim-jacket", name: "Áo khoác denim cá tính", price: 1390000, image: "../../Images/%C3%A1o%206.jpg", description: "Áo khoác denim năng động, dễ phối với trang phục thường ngày.", colors: ["Đen", "Xanh denim", "Xám"], category: "men outerwear", tag: "Phong cách riêng", rating: 4.8, reviews: 61, published: true }
    ]
  };
})();
