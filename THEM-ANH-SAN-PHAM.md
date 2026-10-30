# Them anh san pham tu may tinh

## Su dung

1. Tat backend cu neu dang chay (Ctrl + C trong Terminal).
2. Giai nen ban nay vao thu muc moi. Giu lai thong tin ket noi SQL trong `Backend/appsettings.json` theo may cua ban. Neu ban cu co anh tu them, chep them cac anh do vao `Backend/wwwroot/images`, khong xoa anh cu.
3. Chay `ChayWeb.cmd`, hoac mo Terminal tai `Backend` va chay `dotnet run --launch-profile https`.
4. Mo `https://localhost:7043`, dang nhap quan tri, vao San pham. Nhan Ctrl + F5 neu con giao dien cu.
5. Them hoac sua san pham. O `Tai anh tu may tinh`, chon mot anh JPG, PNG hoac WebP, toi da 5 MB.
6. Cho thong bao da tai thanh cong. Anh se duoc them vao danh sach, tu chon san va hien xem truoc.
7. Nhap thong tin san pham va nhan `Luu san pham`.

O chon anh co san van su dung nhu cu. Co the chon lai anh cu bat ky luc nao khi khong dang tai. Anh moi van co trong danh sach sau khi tai lai trang, khoi dong lai web, hoac them san pham khac.

Anh duoc luu tai `Backend/wwwroot/images/san-pham`. Ten file duoc tao rieng de tranh ghi de khi hai anh trung ten. SQL chi luu duong dan anh qua cot ImageUrl da co; khong can tao lai database, chay lenh cap nhat SQL hay tao lai tai khoan.

Neu tai anh thanh cong nhung huy bieu mau, file anh van duoc giu trong danh sach de dung lai. Thao tac tai anh chua tu luu thay doi san pham; can nhan Luu san pham de gan anh. Sao luu ca thu muc anh cung voi database khi chuyen may.

Web that chay tu `Backend/wwwroot/GiaoDien`. Thu muc `GiaoDien` o ngoai Backend la ban thiet ke goc, khong phai thu muc duoc may chu phuc vu.

## Xu ly loi

- Khong tai duoc: kiem tra backend dang chay va dang dang nhap bang tai khoan Admin.
- Loi phien bao ve: tai lai trang, dang nhap lai neu can, roi thu lai.
- Anh qua lon: giam dung luong xuong toi da 5 MB.
- File khong hop le: xuat lai anh thanh JPG, PNG hoac WebP. Chi doi ten duoi file khong chuyen doi dinh dang.
- Khong luu duoc anh: kiem tra dung luong va quyen ghi thu muc `Backend/wwwroot/images/san-pham`.

Trong khi tai anh, nut Luu, o chon anh va nut dong se tam khoa. Neu tai loi, anh dang chon truoc do duoc giu lai va co the thu lai.

## Thay doi ma nguon

- `Backend/Controllers/ProductImagesController.cs`: GET/POST `/api/quan-tri/anh-san-pham`, chi Admin; POST dung bao ve CSRF co san.
- `Backend/Services/ProductImageStore.cs`: danh sach anh, gioi han dung luong, kiem tra duoi va dau hieu dinh dang, tao ten rieng, luu file hoan tat.
- `Backend/Program.cs`: dang ky dich vu luu anh; them header nosniff cho tep tinh.
- `Backend/wwwroot/GiaoDien/DungChung/api.js`: ho tro FormData cung voi JSON, giu cookie va CSRF; trinh duyet tu tao multipart boundary.
- `Backend/wwwroot/GiaoDien/QuanTri/SanPham/index.html`, `app.js`, `style.css`: o tai anh, xem truoc, tu chon, trang thai va khoa nut trong khi tai. Giu hieu ung va thanh menu cu.

## Kiem tra

Chay tai thu muc `backen`:

```powershell
dotnet build Backend/Backend.csproj
dotnet run --project tests/ImageUploadChecks/ImageUploadChecks.csproj
```

Test HTTP dung may chu rieng va cookie phan quyen de kiem tra controller/dich vu that, khong them duong dan dang nhap thu vao web. Kiem tra quyen, CSRF, JPG/PNG/WebP, file sai/qua lon, ten trung, duong dan an toan, tai anh qua URL va danh sach luu tren dia. Khong can ket noi SQL Server cho test anh.

```powershell
cd tests
npm install
npm run test:images
npm run test:products
npm run test:dom
```

Kiem tra DOM dung API mo phong; khong thay the kiem thu truc quan bang trinh duyet va luong san pham voi SQL Server that tren may ban.
