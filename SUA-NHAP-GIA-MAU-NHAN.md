# Đã sửa nhập giá, màu sắc và nhãn sản phẩm

## Chạy bản mới

1. Dừng website cũ. Giải nén bản ZIP vào thư mục mới và giữ đúng chuỗi kết nối SQL Server của bạn trong Backend/appsettings.json.
2. Sao lưu database rồi chạy **CapNhat-SanPham.cmd**. Lệnh bổ sung cột Tag vào Products nếu chưa có; cũng giữ cập nhật danh mục của bản trước. Không xóa hoặc tạo lại dữ liệu cũ.
3. Mở https://localhost:7043/, đăng nhập Admin → Sản phẩm → Sửa hoặc Thêm sản phẩm.
4. Nhập **Nhãn sản phẩm** ở phần thông tin chung; nhập **Size, Màu sắc, Giá bán, Tồn kho** vào từng dòng bên dưới. Ví dụ: M / Đen / 199000 / 10. Nhấn **+ Thêm dòng** nếu có nhiều lựa chọn.
5. Bật Hiển thị sản phẩm, giữ ít nhất một dòng Đang bán và chọn danh mục đang hiển thị rồi nhấn Lưu sản phẩm.
6. Về cửa hàng → Sản phẩm. Sản phẩm sẽ hiện cùng giá thấp nhất trong các lựa chọn đang bán và nhãn vừa nhập.

Có thể thay bước 2 bằng lệnh trong Terminal tại Backend:

```powershell
dotnet run -- --update-products
dotnet run --launch-profile https
```

Không mở giao diện bằng Live Server. Nếu vẫn thấy form cũ có ô bị khóa, nhấn Ctrl+F5 và kiểm tra đang chạy đúng dự án vừa giải nén. 5 tài khoản Admin, email, mật khẩu và dữ liệu danh mục/đơn hàng vẫn giữ nguyên.

## Các thay đổi

- Bỏ ô giá/màu chỉ xem; giá và màu nhập trực tiếp ở mỗi dòng size/màu. Có thể sửa size/màu của dòng đã lưu, chỉnh giá và tồn kho riêng.
- Ô nhãn đã mở và lưu SQL Server, tối đa 30 ký tự, không bắt buộc. Nhãn hiển thị ở thẻ sản phẩm cửa hàng.
- Mỗi sản phẩm được lưu cùng các dòng lựa chọn trong một giao dịch: nếu kiểm tra thất bại, không lưu dở thông tin sản phẩm hoặc giá/tồn kho.
- Size/màu trùng bị chặn. Giá phải lớn hơn 0; tồn kho là số nguyên từ 0 đến 1.000.000. Tồn kho 0 vẫn hiển thị nhưng không mua được.
- Dòng đã lưu có nút Ngừng bán và ô Đang bán để bật lại; không xóa vật lý để giữ liên kết giỏ/đơn hàng. Dòng mới chưa lưu có thể Bỏ dòng.
- Tài khoản quản trị mới được sửa; API vẫn kiểm tra phân quyền và CSRF. Các lời gọi cũ chỉ sửa thông tin chung vẫn giữ nhãn và các dòng size/màu nếu không gửi hai trường này.
- API POST/PUT /api/quan-tri/san-pham nhận thêm tag và variants. Mỗi dòng variants gồm id (null khi mới), size, color, price, stock, isActive. Khi gửi danh sách này, các dòng cũ không còn trong danh sách sẽ ngừng bán, không bị xóa.

## Kiểm tra

Đã kiểm tra build, nghiệp vụ lưu/sửa sản phẩm và biến thể trên SQLite quan hệ, cùng DOM/API mô phỏng cho nhập giá/màu/nhãn, lưu/tải lại, chống trùng, xử lý lỗi và hiển thị thẻ cửa hàng. Bài quan hệ kiểm tra giao dịch rollback, giữ Id, đổi chéo size/màu và bật lại dòng cũ.

```powershell
dotnet build Backend/Backend.csproj
dotnet run --project tests/ProductChecks/ProductChecks.csproj
cd tests
npm install
npm run test:products
```

Chưa chạy cập nhật schema hoặc nghiệp vụ với SQL Server thật trong môi trường biên soạn. File Backend/Sql/UpdateProducts.sql được thực thi trong giao dịch bởi lệnh cập nhật, chỉ thêm cột Tag khi thiếu.
