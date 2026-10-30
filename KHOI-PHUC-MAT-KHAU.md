# Khoi phuc mat khau N9 Studio

## Chuc nang da them

- Trang dang nhap co lien ket **Quen mat khau?**.
- Nhap email da dang ky, nhan email huong dan, mo lien ket de dat mat khau moi.
- Nhap lai mat khau xac nhan. Mat khau can 8-100 ky tu, co chu hoa, chu thuong, so va ky tu dac biet.
- Lien ket het han sau 30 phut. Sau mot lan dat lai thanh cong, khong the dung lai lien ket.
- Mat khau cu khong dang nhap duoc nua. Tai khoan va quyen Admin/Customer duoc giu nguyen.
- Mo khoa dang nhap tam thoi khi dat lai thanh cong. Cac phien cu bi vo hieu khi Identity kiem tra security stamp, trong vong khoang 1 phut o lan truy cap tiep theo.
- Khong tra token/link qua API, khong luu token trong localStorage/sessionStorage, khong ghi token vao log.
- API tra thong bao chung cho email ton tai va khong ton tai. Gui lai toi da mot lan moi 60 giay/email; HTTP limiter toi da 10 yeu cau/15 phut/IP cho cac API khoi phuc.

Tinh nang dung cac cot Identity da co; khong can them bang/cot SQL rieng cho viec dat lai mat khau.

## Cau hinh de gui email THAT tren Render

Web dang dung Render Free. Cac cong SMTP pho bien 25/465/587 bi chan tren goi nay, vi vay ban nay dung **Resend HTTPS API**, khong dung SMTP Gmail.

1. Tao tai khoan tai https://resend.com va tao API key co quyen gui email.
2. Neu chi thu voi chinh email da dang ky tai khoan Resend, co the dung `N9 Studio <onboarding@resend.dev>`. Dia chi nay **chi gui thu den email chu tai khoan Resend**, khong gui cho tat ca khach hang hay ca 5 admin.
3. De gui cho cac dia chi khac, them va xac minh ten mien GUI THU cua ban trong Resend, sau do dung mot dia chi thuoc ten mien da xac minh. Khong dien tuy y dia chi Gmail hay `n9studio.onrender.com` vao From. Ten mien website va ten mien gui email co the khac nhau.
4. Vao Render -> dich vu N9Studio -> Environment, them:

| Key | Gia tri |
| --- | --- |
| `Email__Provider` | `Resend` |
| `Email__ApiKey` | API key that cua ban; chi nhap trong Environment |
| `Email__From` | `N9 Studio <dia-chi@ten-mien-gui-thu-da-xac-minh>` |
| `PasswordReset__PublicUrl` | `https://n9studio.onrender.com` |

5. Save and deploy. Mo trang dang nhap -> Quen mat khau, nhap email tai khoan da co trong DATABASE ONLINE.
6. Kiem tra ca Spam. Neu khong nhan thu, mo Resend dashboard de xem trang thai gui va log cua Render. Loi provider 401/403 thuong lien quan API key/ten mien From/quyen nguoi nhan o che do thu.

Khong gui API key hoac mat khau email vao GitHub hay chat. `appsettings.json` de trong cac thong tin nhay cam. Email lien he cua cua hang khong tu dong tro thanh tai khoan gui thu. Tinh nang khong tu tao tai khoan cho email chua dang ky.

Neu Email/From/PublicUrl chua cau hinh, API tra 503 voi thong bao chua the gui huong dan. Neu nha cung cap tu choi gui, log ghi loai loi va ma HTTP, con nguoi dung van nhan thong bao chung de tranh lo dia chi nao co tai khoan. Thong bao chung khong phai xac nhan email da den hop thu.

## Thu tren may ca nhan ma khong gui email

Chi dung khi `ASPNETCORE_ENVIRONMENT=Development` va khong chay tren Render. Mo Terminal tai `Backend`:

```powershell
dotnet user-secrets init
dotnet user-secrets set "Email:Provider" "DevelopmentFile"
dotnet user-secrets set "PasswordReset:PublicUrl" "https://localhost:7043"
dotnet run --launch-profile https
```

Nhac lai: phai ket noi SQL Server/PostgreSQL va co tai khoan that trong database truoc. Vao Quen mat khau va gui yeu cau. Mo file `.eml` moi nhat trong `Backend/App_Data/ThuThuNghiem`, sao chep lien ket vao trinh duyet, dat lai mat khau, roi dang nhap. Day la thu thu cuc bo, KHONG phai email da gui toi Gmail.

Thu muc nay nam ngoai wwwroot, bi bo qua trong Git va khong duoc dong goi vao ZIP. Khong upload len GitHub. `DevelopmentFile` bi tu choi trong Production/Render. Khi dung lai email that tren may, dat `Email:Provider=Resend` va cau hinh ApiKey/From.

## Lien ket sau khi khoi dong lai

Identity bao ve token bang Data Protection keys. Neu container bi tao lai va mat keys, lien ket cu co the khong con hieu luc; yeu cau mot lien ket moi. De giu keys qua cac lan restart/deploy, cau hinh `DataProtection__KeysPath` tro den thu muc RIENG NGOAI wwwroot tren persistent disk, vi du `/var/data/n9studio-keys` khi disk that duoc mount tai `/var/data`.

Render Free khong co persistent disk; chi tao thu muc voi ten nay khong lam du lieu ben vung. Khi chay nhieu instance, can chia se key ring va cooldown/rate-limit phu hop. Ban nay dung mot instance; cooldown email nam trong bo nho va dat lai sau restart.

## Ma nguon va kiem thu

- `Backend/Controllers/PasswordRecoveryController.cs`: POST `/api/tai-khoan/quen-mat-khau`, POST `/api/tai-khoan/dat-lai-mat-khau`.
- `Backend/Services/PasswordRecoveryService.cs`: token Identity, link tin cay, cooldown, dat mat khau.
- `Backend/Services/PasswordResetEmailSender.cs`: Resend HTTPS va thu DevelopmentFile.
- `Backend/wwwroot/GiaoDien/NguoiDung/QuenMatKhau`, `DatLaiMatKhau`: giao dien moi.
- `Backend/wwwroot/GiaoDien/DungChung/recovery.js`, `recovery.css`: xu ly form va chu de dung chung.

Tai thu muc `backen`:

```powershell
dotnet build Backend/Backend.csproj
dotnet run --project tests/PasswordRecoveryChecks/PasswordRecoveryChecks.csproj
dotnet build Backend/Backend.csproj -c Release
python tests/recovery-host.py
```

Tai `backen/tests`:

```powershell
npm install
npm run test:recovery
npm run test:dom
```

Test HTTP dung HTTPS, Identity that va SQLite relational, kiem tra token sai/het han/sai tai khoan/da dung, mat khau xac nhan, CSRF, rate limit, dang nhap cu/moi, quyen Admin, khoa tai khoan va phien cu. Email duoc thu giu trong test; HTTP adapter gui thu duoc kiem tra bang handler gia, khong gui email ra ngoai. Kiem tra DOM dung API mo phong; chua thay the thu truc quan va SQL Server that tren Render.

Nguon: https://learn.microsoft.com/aspnet/core/security/authentication/accconfirm ; https://render.com/docs/free ; https://resend.com/docs/api-reference/emails/send-email ; https://resend.com/docs/knowledge-base/403-error-resend-dev-domain
