# Backend website thời trang

**Da sua loi publish va dong bo SQL Server/PostgreSQL:** xem `CAU-HINH-RENDER.md`. Ban nay dung EF Core 10, Npgsql EF 10 va SqlClient; cap nhat nguyen thu muc Backend, khong chi csproj.

**Ban moi: khoi phuc mat khau qua email.** Xem `KHOI-PHUC-MAT-KHAU.md`. Da them trang Quen/DatLaiMatKhau va API Identity; can cau hinh dich vu gui email truoc khi gui that.

**Dang nhap tren Render can database online SQL Server hoac PostgreSQL.** Xem `CAU-HINH-RENDER.md` de dat connection string va (neu database moi/trong) khoi tao role/5 admin. Dua code len GitHub khong tu dua database va tai khoan len theo.

**Them anh tu may tinh:** xem `THEM-ANH-SAN-PHAM.md`. Giu danh sach anh cu, them o chon file, tu tai len va tu chon anh moi. Chay `ChayWeb.cmd`; khong can cap nhat SQL cho chuc nang nay.

**Đã sửa nhập giá/màu/nhãn:** xem `SUA-NHAP-GIA-MAU-NHAN.md`. Chạy `CapNhat-SanPham.cmd` để bổ sung cột nhãn và mở website.

**Bản mới đã hoàn thiện Danh mục:** xem `DANH-MUC-HOAN-THIEN.md`. Nếu đang dùng database cũ, chạy `CapNhat-DanhMuc.cmd` trước khi mở website.

**Tạo 5 tài khoản nhóm:** xem `DANH-SACH-ADMIN.md`, hoặc chạy `Tao-5-Admin.cmd`. Tên: TN Quảng, Công Đạt, Đình Huy, Diệu Thúy, Văn Vượng.

Dự án ASP.NET Core MVC .NET 10 được bổ sung JSON API, EF Core SQL Server và ASP.NET Core Identity. Đã gắn 13 trang HTML/CSS/JS từ GiaoDien.zip vào `Backend/wwwroot/GiaoDien`, giữ thiết kế gốc và chuyển các thao tác hiện có sang API. Các view MVC mặc định vẫn giữ trong mã nguồn, trang gốc chuyển sang giao diện thời trang. Chỉ hỗ trợ thanh toán khi nhận hàng (COD), chưa kết nối cổng thanh toán, vận chuyển hoặc gửi email.

## 1. Chuẩn bị

- Visual Studio có workload ASP.NET, .NET 10 SDK; SQL Server Express LocalDB hoặc SQL Server.
- Mở `Backend/Backend.csproj`.
- Sửa `ConnectionStrings:DefaultConnection` trong `Backend/appsettings.json` nếu không dùng LocalDB. Chỉ dùng `TrustServerCertificate=True` cho máy phát triển.
- Lệnh dưới đây chạy trong thư mục `Backend`, bằng PowerShell trên Windows.

```powershell
dotnet restore
dotnet build
dotnet dev-certs https --trust
dotnet user-secrets init
dotnet user-secrets set "SeedAdmin:Email" "admin@example.com"
dotnet user-secrets set "SeedAdmin:Password" "FashionAdmin!2026"
dotnet run -- --init-db --seed-catalog
dotnet user-secrets remove "SeedAdmin:Password"
dotnet run --launch-profile https
```

Đổi mật khẩu ví dụ trước khi sử dụng thực tế. Không có mật khẩu quản trị hardcode trong ứng dụng. `--init-db` tạo database, các bảng và vai trò Admin/Customer rồi thoát. `--seed-catalog` nhập 6 sản phẩm gốc của giao diện khi database chưa có sản phẩm; giá và màu lấy từ giao diện, size mẫu S/M/L/XL/XXL, tồn kho ban đầu bằng 0. Không tự tạo đánh giá hoặc đơn hàng giả. Bỏ `--seed-catalog` nếu muốn bắt đầu trống; lệnh nhập mẫu từ chối chạy nếu đã có sản phẩm. Nếu bỏ cấu hình quản trị, chỉ tạo database/vai trò. Không dùng email của khách hàng có sẵn để tạo quản trị.

`EnsureCreated` dành cho database mới của đồ án. Không tự nâng cấp bảng đã tồn tại. Khi cần phát triển schema bằng migrations: tạo database mới, bỏ `EnsureCreatedAsync`, tạo migration ban đầu bằng EF CLI 10.x và dùng `dotnet ef database update`. Không trộn EnsureCreated và migrations trên cùng database. Sao lưu trước khi thay schema; không xóa database đang chứa dữ liệu thật.

## 2. Gọi API từ giao diện

API dùng cookie Identity HttpOnly, chỉ gửi qua HTTPS; frontend nên cùng origin với backend. Chưa bật CORS cho frontend ở tên miền khác.

Mọi POST/PUT/PATCH/DELETE cần CSRF token (kể cả đăng ký/đăng nhập). Gọi GET `/api/tai-khoan/csrf` để lấy `{ token }`, rồi gửi header `X-CSRF-TOKEN`. Lấy token mới sau khi đăng nhập/đăng xuất hoặc đổi mật khẩu. Cơ chế cookie + header theo hướng dẫn ASP.NET Core: https://learn.microsoft.com/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0

```javascript
let csrf;
async function refreshCsrf() {
  const res = await fetch('/api/tai-khoan/csrf', {credentials: 'same-origin'});
  csrf = (await res.json()).token;
}
async function api(url, method='GET', data) {
  if (!csrf && method !== 'GET') await refreshCsrf();
  const res = await fetch(url, {
    method, credentials: 'same-origin',
    headers: {'Content-Type':'application/json', ...(method !== 'GET' ? {'X-CSRF-TOKEN':csrf} : {})},
    body: data === undefined ? undefined : JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}
await api('/api/tai-khoan/dang-nhap', 'POST', {
  email: 'admin@example.com', password: 'YOUR_PASSWORD'
});
await refreshCsrf();
```

Mã trả về: 400 dữ liệu không hợp lệ/CSRF; 401 chưa đăng nhập; 403 thiếu quyền; 404 không tìm thấy hoặc đơn không thuộc tài khoản; 409 xung đột tồn kho/trạng thái; 429 quá nhiều lần gọi đăng nhập/đăng ký. Identity yêu cầu mật khẩu >=8 ký tự, chữ hoa, chữ thường, số và ký tự đặc biệt. Sai 5 lần tạm khóa 10 phút.

## 3. Danh sách API

Các API quản trị yêu cầu vai trò Admin. ID trong bảng là số nguyên, riêng userId là chuỗi Identity.

| Phương thức | Đường dẫn | Nội dung |
|---|---|---|
| GET | /api/tai-khoan/csrf | Lấy CSRF token |
| POST | /api/tai-khoan/dang-ky | email, password, fullName |
| POST | /api/tai-khoan/dang-nhap | email, password |
| POST | /api/tai-khoan/dang-xuat | Đăng xuất |
| GET | /api/tai-khoan/me | Thông tin tài khoản, vai trò |
| PUT | /api/tai-khoan/me | fullName, phone, address |
| PUT | /api/tai-khoan/mat-khau | oldPassword, newPassword |
| GET | /api/san-pham/danh-muc | Danh mục công khai |
| GET | /api/san-pham | search, categoryId, size, color, minPrice, maxPrice, page, pageSize |
| GET | /api/san-pham/{id} | Chi tiết, biến thể đang bán, tối đa 100 đánh giá hiển thị |
| GET | /api/gio-hang | Giỏ riêng của tài khoản |
| POST | /api/gio-hang | variantId, quantity; cộng thêm số lượng |
| PUT | /api/gio-hang/{id} | quantity; đặt lại số lượng dòng giỏ |
| DELETE | /api/gio-hang/{id} | Xóa dòng giỏ |
| POST | /api/don-hang | recipient, phone, address, note; mua toàn bộ giỏ |
| GET | /api/don-hang | Đơn của mình, page (20/trang) |
| GET | /api/don-hang/{id} | Chi tiết đơn của mình |
| POST | /api/don-hang/{id}/huy | Hủy đơn Pending |
| PUT | /api/danh-gia/{productId} | rating (1–5), content; tạo/sửa đánh giá sau khi đã nhận hàng |
| GET | /api/quan-tri/tong-quan | Doanh thu đơn đã giao, tổng đơn, bán chạy |
| GET | /api/quan-tri/khach-hang | search, page; danh sách tài khoản gồm cả quản trị |
| GET/POST | /api/quan-tri/danh-muc | Danh sách / tạo với name |
| PUT/DELETE | /api/quan-tri/danh-muc/{id} | Sửa thông tin / xóa danh mục trống |
| PATCH | /api/quan-tri/danh-muc/{id}/trang-thai | isActive: ẩn/hiện |
| GET/POST | /api/quan-tri/san-pham | page / tạo sản phẩm |
| PUT/DELETE | /api/quan-tri/san-pham/{id} | Sửa / ngừng bán |
| POST | /api/quan-tri/san-pham/{productId}/bien-the | Tạo biến thể |
| PUT/DELETE | /api/quan-tri/bien-the/{id} | Sửa / ngừng bán biến thể |
| GET | /api/quan-tri/don-hang | status, userId, page; đơn của mọi khách |
| GET | /api/quan-tri/don-hang/{id} | Chi tiết mọi đơn |
| PUT | /api/quan-tri/don-hang/{id}/trang-thai | status: tên trạng thái |
| GET | /api/quan-tri/danh-gia | page; gồm cả đánh giá đã ẩn |
| PUT | /api/quan-tri/danh-gia/{id} | isVisible: true/false |

Tạo/sửa sản phẩm: `{ "name":"Áo thun", "description":"Cotton", "imageUrl":"/images/ao.jpg", "categoryId":1, "isActive":true }`.
Tạo/sửa biến thể: `{ "size":"M", "color":"Đen", "price":199000, "stock":10, "isActive":true }`.

Ảnh hiện lưu URL/đường dẫn, chưa có upload file hoặc album nhiều ảnh. Đặt ảnh trong `wwwroot/images` hoặc dùng URL HTTPS. Mỗi sản phẩm có nhiều biến thể; giá và tồn kho nằm ở biến thể. Có thể nhập 6 sản phẩm gốc bằng lệnh `--init-db --seed-catalog` nêu trên. Tồn kho mẫu bằng 0: cần cập nhật tồn kho qua API trước khi mua thử. Khi tạo sản phẩm qua giao diện, nhập thông tin chung và ít nhất một dòng size/màu đang bán để hiển thị trên cửa hàng.

## 4. Quy tắc đơn hàng

- `Pending` (chờ xác nhận) → `Confirmed` → `Shipping` → `Delivered`.
- Khách chỉ hủy từ Pending. Quản trị hủy từ Pending hoặc Confirmed.
- Cancelled/Delivered kết thúc, không chuyển ngược. Không xóa đơn đã hủy.
- Lấy userId từ phiên đăng nhập, không nhận userId từ dữ liệu đặt hàng.
- Giá và tổng tiền tính tại server; đơn lưu bản chụp tên, size, màu, giá.
- Đặt hàng/trừ kho/xóa giỏ trong cùng giao dịch Serializable; cập nhật kho có điều kiện. Hủy trạng thái/hoàn kho trong cùng giao dịch; hủy lần hai trả 409.
- Lưu thời gian UTC, giao diện đổi sang giờ Việt Nam khi hiển thị.
- Chưa có phí vận chuyển, giảm giá, hoàn trả, thanh toán online, xác minh email, quên mật khẩu hoặc quản lý nhiều địa chỉ. Đây là phạm vi mở rộng, không phải chức năng đã triển khai.

## 5. Kiểm tra

Đã build .NET 10 thành công; đã chạy kiểm tra mô hình EF SQL Server, route/phân quyền/CSRF trên host thật và các bài kiểm tra DOM với API mô phỏng. Chưa chạy với SQL Server thật hoặc kiểm tra bố cục/hoạt ảnh trong trình duyệt thật. Cần chạy bài smoke test dưới đây trên máy có SQL Server trước khi sử dụng.

Sau khi khởi tạo database, chạy server HTTPS ở cổng 7043, mở terminal thứ hai tại thư mục gốc `backen`:

```powershell
$env:SHOP_ADMIN_EMAIL="admin@example.com"
$env:SHOP_ADMIN_PASSWORD="YOUR_PASSWORD"
python tests/smoke.py
```

Python 3 chỉ dùng thư viện chuẩn. Script tạo dữ liệu thử có tiền tố Smoke và hai khách thử, không xóa lịch sử đơn. Chỉ chạy trên database phát triển. Kiểm tra thiếu CSRF, phân quyền, cách ly đơn giữa hai người, giá server, tồn kho, hủy hai lần, luồng giao hàng, đánh giá và thống kê. Chạy lại mỗi lần tạo bộ dữ liệu mới.

Cho production: tiếp tục duy trì các bản vá .NET 10 và package; cấu hình tên miền AllowedHosts, SQL secret và chứng chỉ hợp lệ; dùng migrations, lưu Data Protection keys bền vững, logging/monitoring, backup và cơ chế retry deadlock/idempotency phù hợp. Bản hiện tại chưa có idempotency key cho checkout; không tự động gửi lại POST đặt hàng nếu chưa kiểm tra lịch sử đơn.


## 6. Mở giao diện đã gắn

Sau khi chạy backend, mở **https://localhost:7043/**. Không mở file HTML bằng cách nhấp đúp hoặc chạy Live Server: giao diện và API phải chung origin để cookie/CSRF hoạt động.

- Trang chủ: `/GiaoDien/NguoiDung/TrangChu/index.html`.
- Đăng nhập: `/GiaoDien/NguoiDung/DangNhap/index.html`.
- Quản trị: `/GiaoDien/QuanTri/TongQuan/index.html`; tài khoản Admin được chuyển đến đây sau đăng nhập. Server kiểm tra quyền khi tải trang HTML quản trị; API kiểm tra quyền riêng.
- `DungChung/api.js`: gọi API, CSRF, xử lý lỗi, ánh xạ dữ liệu server sang giao diện.
- `DungChung/auth.js`: phiên cookie, đăng ký/đăng nhập/đăng xuất, điều hướng theo quyền.
- `app.js` trong từng trang: các thao tác API tương ứng. Không đọc/ghi localStorage cho tài khoản, mật khẩu, giỏ, đơn, sản phẩm, đánh giá nữa. Dữ liệu demo cũ trong trình duyệt không được nhập tự động.
- Giỏ và đơn yêu cầu đăng nhập. Email trong form đặt hàng lấy từ tài khoản và chỉ xem; backend gắn đơn theo userId phiên đăng nhập, không theo email do người mua nhập.
- Tổng quan tính doanh thu từ đơn Delivered; biểu đồ phân theo ngày đặt, hiển thị 7 hoặc 30 ngày. Thống kê số lượng giỏ là tổng của các tài khoản, không theo thiết bị.
- Nút Xóa sản phẩm đổi thành Ngừng bán để giữ lịch sử. Đánh giá chỉ có Ẩn/Hiện, không xóa vĩnh viễn.

### Các form chờ bạn bổ sung

Chưa tự thiết kế thêm form sửa hồ sơ/đổi mật khẩu, hủy đơn của khách hoặc viết đánh giá. API đã có sẵn. Trong form sản phẩm, giá/màu/size/tồn kho đã nhập được theo từng dòng; nhãn nhập tại thông tin chung. Toàn bộ được lưu cùng sản phẩm.

### API tồn kho tham khảo (có thể sửa trực tiếp trong form sản phẩm)

Đăng nhập Admin, mở trang quản trị, nhấn F12 → Console. Ví dụ lấy ID từ server và cập nhật một biến thể (chỉ dùng trên dữ liệu thử):

```javascript
const rows = await shop.all('/api/quan-tri/san-pham');
console.table(rows.map(p => ({id:p.id, name:p.name})));
const p = rows[0];
const v = p.variants[0];
console.table(p.variants);
await shop.request(`/api/quan-tri/bien-the/${v.id}`, 'PUT', {
  size:v.size, color:v.color, price:v.price, stock:10, isActive:true
});
```

Để tạo danh mục, chọn **Danh mục → Thêm danh mục** trên thanh menu quản trị. Để thêm biến thể cho sản phẩm mới:

```javascript
// Thay 123 bằng ID sản phẩm thực tế ở trang quản trị.
await shop.request('/api/quan-tri/san-pham/123/bien-the','POST',{
  size:'M', color:'Đen', price:199000, stock:10, isActive:true
});
```

### Kiểm tra bổ sung cho bản tích hợp

```powershell
dotnet run --project tests/ModelChecks/ModelChecks.csproj
python tests/host_smoke.py
cd tests
npm install
npm run test:dom
```

`host_smoke.py` khởi động host đã build để kiểm tra route, bảo vệ trang quản trị, API chưa đăng nhập, CSRF và ảnh/tệp tĩnh; không truy cập dữ liệu SQL.

`ModelChecks` kiểm tra sinh schema SQL Server, ràng buộc, khóa duy nhất và độ chính xác tiền; không mở kết nối SQL. Cần Node.js 22 trở lên cho các bài kiểm tra JavaScript (chạy website không cần Node). `test:dom` dùng jsdom với API mô phỏng, kiểm tra 12 trang khởi tạo, đăng ký/đăng nhập/đăng xuất, giỏ và đặt hàng, cập nhật sản phẩm/trạng thái đơn/ẩn đánh giá, escape nội dung, header CSRF và trạng thái lỗi API. Không kiểm tra bố cục/hoạt ảnh WebGL trang chủ.

Có kèm `frontend-smoke.cjs` dành cho Playwright để chạy trong trình duyệt thật trên máy có Chromium; chưa chạy thành công bài này trong môi trường biên soạn. Chạy terminal riêng từ thư mục gốc: `python -m http.server 8765 --directory Backend/wwwroot`; sau đó tại `tests` chạy `npx playwright install chromium` và `npm run test:browser`. Bài này cũng mô phỏng API; bài `smoke.py` ở mục 5 mới dùng backend/SQL Server thật.


**Cập nhật email 5 Admin:** danh sách Gmail mới nằm trong `DANH-SACH-ADMIN.md`. Chạy lại `Tao-5-Admin.cmd` để tạo tài khoản mới hoặc chuyển tài khoản từ email mẫu cũ sang Gmail, giữ nguyên mật khẩu/ID/quyền. Không cần tạo lại database.
