# 5 tài khoản quản trị của nhóm

Admin là quyền cao nhất trong hệ thống hiện tại. Cả 5 tài khoản có quyền quản lý sản phẩm, danh mục, biến thể/tồn kho, tất cả đơn hàng, khách hàng, đánh giá và thống kê. Không có cấp SuperAdmin riêng.

| Họ tên | Email đăng nhập | Mật khẩu |
|---|---|---|
| TN Quảng | tnq89129@gmail.com | Quang@2026 |
| Công Đạt | lightning191105@gmail.com | Dat@2026 |
| Đình Huy | nqh.290@gmail.com | Huy@2026 |
| Diệu Thúy | Thuycutephomaique46@gmail.com | Thuy@2026 |
| Văn Vượng | nhatvuong026@gmail.com | Vuong@2026 |

## Cách tạo và đăng nhập

1. Cấu hình SQL Server tại `Backend/appsettings.json` như README.
2. Nhấp đúp `Tao-5-Admin.cmd` trong thư mục này. Script tạo tài khoản rồi chạy website.
3. Mở https://localhost:7043/ và đăng nhập bằng email/mật khẩu trong bảng. Trang quản trị tự mở sau đăng nhập.

Hoặc mở Terminal trong thư mục `Backend`, chạy:

```powershell
dotnet run -- --create-team-admins
dotnet run --launch-profile https
```

Các tài khoản chỉ được ghi vào SQL Server khi lệnh tạo chạy thành công trên máy bạn. Lệnh có thể chạy lại. Nếu đã tạo 5 tài khoản bằng email @example.com trong bản trước, lệnh đổi Email và tên đăng nhập của các tài khoản đó sang Gmail trong bảng, giữ nguyên ID, quyền, tên, mật khẩu và liên kết dữ liệu. Không tạo thêm bản sao. Nếu tài khoản đã dùng email mới, lệnh giữ nguyên. Nếu email thuộc tài khoản khách hàng có sẵn, lệnh dừng toàn bộ nhóm; không tự nâng quyền hoặc đặt lại mật khẩu của tài khoản đó. Các admin khác trước đây vẫn được giữ, nên tổng số admin có thể lớn hơn 5.

Mật khẩu trong bảng áp dụng cho tài khoản mới tạo bằng lệnh này. Tên đăng nhập là email Gmail do bạn cung cấp; thao tác này không gửi thư đến các địa chỉ đó. Cơ sở dữ liệu lưu mật khẩu bằng Identity hash. Mật khẩu dễ nhớ được thiết lập theo yêu cầu cho đồ án; có thể đổi qua API đổi mật khẩu sau khi đăng nhập.

Đã kiểm tra build và cấu hình 5 tài khoản/chính sách mật khẩu. Chưa tạo tài khoản trên SQL Server của bạn từ môi trường này.

Sau khi đổi email, hãy đăng nhập lại bằng email mới. Nếu cả email cũ và email mới đã thuộc hai tài khoản khác nhau, lệnh báo xung đột và không ghép/xóa tài khoản. Chưa kiểm thử cập nhật database với SQL Server thật trong môi trường biên soạn.
