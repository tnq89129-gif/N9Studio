# Cập nhật footer N9 Studio

Đã thêm footer dùng chung về kiểu dáng cho 7 trang khách hàng: TrangChu, SanPham, GioHang, DonHang, TaiKhoan, DangNhap, DangKy. Giữ nền xanh ô-liu, màu chữ dịu, điểm nhấn vàng, hiệu ứng hover/focus và hỗ trợ giảm chuyển động. Bố cục 4 cột ở màn hình rộng, 2 cột ở máy tính bảng; phần giới thiệu/liên hệ xếp thành hàng riêng trên điện thoại.

Thông tin do bạn cung cấp:

- Tên: N9 Studio.
- Địa chỉ: Trường Đại học Nghệ An.
- Điện thoại: 0347799850, có liên kết gọi điện.
- Email: tnq89129@gmail.com, có liên kết mở ứng dụng email.
- Giờ mở cửa: 07:00–22:00, hằng ngày.
- Facebook: https://www.facebook.com/huyit205.
- Zalo: +84 374 290 105, liên kết https://zalo.me/84374290105.

Số điện thoại cửa hàng và số Zalo được giữ riêng, không tự thay thế cho nhau. Liên kết Facebook/Zalo mở tab mới. Không gửi thư hoặc tin nhắn khi cập nhật mã nguồn; chỉ khi bạn bấm liên kết thì trình duyệt mở ứng dụng/trang tương ứng.

## Sử dụng

Dừng website cũ, giải nén bản này và giữ nguyên cấu hình kết nối SQL Server đang dùng. Mở Backend rồi chạy `dotnet run --launch-profile https` như trước. Nhấn Ctrl+F5 nếu trình duyệt vẫn giữ footer cũ. Không cần chạy lệnh nâng cấp database cho riêng thay đổi footer này.

CSS nằm ở Backend/wwwroot/GiaoDien/DungChung/footer.css. Nội dung HTML nằm trong footer của 7 tệp NguoiDung/*/index.html để vẫn đọc được khi không chạy JavaScript. Tiêu đề trang và mô tả truy cập của ảnh logo dùng tên N9 Studio; ảnh logo có sẵn vẫn được giữ nguyên. Không thêm chính sách giao hàng/đổi trả chưa được cung cấp.

Chỉ thay đổi giao diện phía khách hàng và tài liệu này; mã backend, tài khoản quản trị, sản phẩm, danh mục và cấu hình database không đổi. Đã kiểm tra nội dung/liên kết, mã HTML/DOM và các bài kiểm tra giao diện API mô phỏng. Chưa kiểm tra bố cục trực quan bằng trình duyệt thật trong môi trường biên soạn.
