# Danh mục đã nối backend

## Chạy bản cập nhật

1. Giải nén vào thư mục mới. Nếu đã sửa chuỗi kết nối trên máy, chép giá trị đó sang `Backend/appsettings.json` của bản mới.
2. Dừng website cũ. Sao lưu database hiện có trước khi cập nhật cấu trúc.
3. Nhấp đúp **CapNhat-DanhMuc.cmd**: cập nhật bảng danh mục rồi chạy website. Hoặc mở Terminal trong Backend:

```powershell
dotnet run -- --update-categories
dotnet run --launch-profile https
```

4. Mở https://localhost:7043/, đăng nhập Admin rồi chọn **Danh mục** trên thanh menu.

Nếu bắt đầu từ database mới và chưa có tài khoản, dùng **Tao-5-Admin.cmd**; lệnh tạo admin cũng cập nhật bảng danh mục. Không cần xóa database, tạo lại tài khoản hoặc chạy lại seed sản phẩm. 5 tài khoản quản trị và email/mật khẩu vẫn như bản trước.

## Cập nhật database cũ

Lệnh `--update-categories` dùng `Backend/Sql/UpdateCategories.sql` để thêm Code (60 ký tự), Description (240 ký tự) và IsActive vào bảng Categories nếu còn thiếu. Danh mục cũ giữ nguyên Id/Name; được gán mã `danh-muc-<Id>`, mô tả trống và trạng thái hiển thị. Lệnh tạo chỉ mục mã duy nhất, chạy trong giao dịch có khóa cập nhật cấu trúc. Chạy lại không đặt lại mã/mô tả/trạng thái đã sửa.

Đây là bản cập nhật cụ thể cho schema của dự án, không thay thế hệ thống migrations tổng quát. Không trộn với database được tạo từ dự án web khác. Lệnh báo lỗi nếu không tìm được bảng Categories phù hợp. Không truy cập/xóa dữ liệu tài khoản, sản phẩm, giỏ hoặc đơn hàng.

## Chức năng đã hoàn thiện

- Tạo/sửa tên, mã, mô tả và trạng thái danh mục, lưu vào SQL Server.
- Tìm tên/mã và lọc trạng thái ngay trên trang quản trị.
- Thống kê số danh mục hiển thị/ẩn và số sản phẩm thuộc từng danh mục, gồm cả sản phẩm đã ngừng bán.
- Chặn tên hoặc mã trùng, tên trắng, mã sai định dạng. Mã có thể gồm chữ thường không dấu, số, gạch ngang hoặc khoảng trắng giữa từ.
- Mã danh mục có sản phẩm không được đổi. Tên/mô tả vẫn sửa được; liên kết sản phẩm dùng Id.
- Chỉ xóa danh mục không có sản phẩm. Có hộp xác nhận; backend kiểm tra lại trong giao dịch và giữ khóa ngoại.
- Ẩn/hiện cập nhật qua endpoint riêng, không ghi đè tên/mô tả từ dữ liệu cũ trên trình duyệt.
- Danh mục ẩn không xuất hiện trong bộ lọc cửa hàng. Sản phẩm thuộc danh mục ẩn không xuất hiện ở danh sách/chi tiết, không thêm hoặc tăng số lượng trong giỏ và không đặt hàng được qua API. Đơn đã đặt vẫn giữ nguyên lịch sử; việc ẩn danh mục không tự hủy đơn.
- Trang sản phẩm quản trị lấy danh mục từ API khi mở form. Danh mục ẩn được ghi chú trong ô chọn; quản trị vẫn có thể gán sản phẩm vào đó nhưng sản phẩm không hiển thị ở cửa hàng.
- Mọi API quản trị yêu cầu vai trò Admin; POST/PUT/PATCH/DELETE dùng cookie và CSRF token.
- Giữ nền, menu, hiệu ứng dùng chung với các trang quản trị. Có trạng thái tải/lỗi, ngăn nhấp lặp trong lúc gửi và hỗ trợ giảm chuyển động.

Trang này không còn đọc/ghi localStorage cho danh mục. Dữ liệu thử từ ZIP giao diện thuần không tự nhập vào SQL Server; dùng dữ liệu đang có trong database hoặc tạo danh mục mới tại trang này. Mở web qua backend HTTPS, không dùng Live Server.

## API

| Phương thức | Đường dẫn | Nội dung |
|---|---|---|
| GET | /api/quan-tri/danh-muc | Tất cả danh mục kèm productCount |
| GET | /api/quan-tri/danh-muc/{id} | Chi tiết danh mục |
| POST | /api/quan-tri/danh-muc | name, code, description, isActive |
| PUT | /api/quan-tri/danh-muc/{id} | Sửa thông tin và trạng thái |
| PATCH | /api/quan-tri/danh-muc/{id}/trang-thai | isActive |
| DELETE | /api/quan-tri/danh-muc/{id} | Xóa danh mục trống |
| GET | /api/san-pham/danh-muc | Danh mục đang hiển thị cho cửa hàng |

API POST cũ chỉ gửi name vẫn được hỗ trợ: server tự sinh code. API PUT cũ bỏ code sẽ giữ mã hiện tại; các trường description/isActive nên gửi đầy đủ khi chỉnh sửa.

## Kiểm tra

```powershell
dotnet build Backend/Backend.csproj
dotnet run --project tests/ModelChecks/ModelChecks.csproj
dotnet run --project tests/CategoryChecks/CategoryChecks.csproj
python tests/host_smoke.py
cd tests
npm install
npm run test:categories
npm run test:dom
```

ModelChecks kiểm tra mô hình SQL Server, chỉ mục mã và các cấu hình cũ. CategoryChecks chạy trên SQLite quan hệ để kiểm tra CRUD, trùng dữ liệu, xóa có điều kiện và việc chặn mua qua danh mục ẩn. Các bài DOM dùng API mô phỏng. Host smoke kiểm tra route/phân quyền/CSRF và tệp tĩnh.

Không có SQL Server thật trong môi trường biên soạn nên chưa chạy script nâng cấp hoặc kiểm tra đồng thời trên SQL Server; cần chạy lệnh cập nhật và thử lại trên database của bạn. Không khẳng định SQLite kiểm chứng được DDL, khóa hoặc lỗi đặc thù SQL Server.
