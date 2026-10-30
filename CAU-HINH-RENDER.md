# Cau hinh database va publish N9 Studio tren Render

## Ban sua loi publish

Ban ZIP truoc da doi sang Npgsql 8.0.10 trong khi Identity/EF Core la 10.0.14, dong thoi van co ma va script SQL Server. Ban nay dong bo Npgsql EF Core 10.0.3 (ho tro EF Core 10), giu SQL Server EF Core 10.0.14 va them Microsoft.Data.SqlClient 6.1.7 ma code dang tham chieu.

Ho tro SQL Server va PostgreSQL theo cau hinh. Chuong trinh tu nhan dien neu `Database:Provider=Auto`, hoac co the chon ro `SqlServer` / `PostgreSql`. Khong tu dong di chuyen du lieu giua hai loai database.

## 1. Cap nhat code

1. Giai nen; mo `N9Studio/backen/Backend`.
2. Cap nhat NGUYEN thu muc Backend nay vao dung thu muc Backend tren GitHub. Can dong bo Backend.csproj, Program.cs, Data, Services, Controllers va Sql; khong chi sua mot dong using.
3. Commit vao nhanh dang ket noi Render. Render se auto-deploy neu da bat, hoac Manual Deploy -> Deploy latest commit.
4. Dockerfile hien dung build context la chinh thu muc Backend, vi `COPY . ./` va `Backend.csproj` o cung cap. Giu Root Directory/Dockerfile path cua dich vu dang dung dung context nay. Khong doi sang `COPY ./Backend/` khi context da la Backend.
5. `.dockerignore` o Backend loai bin/obj tu may Windows va cac tep thu email/secret khoi Docker build context.

Kiem tra tren may co .NET 10 SDK, tai thu muc Backend:

```powershell
dotnet restore Backend.csproj
dotnet publish Backend.csproj -c Release -o out
```

## 2. Neu dung PostgreSQL cua Render

Tao Render Postgres neu chua co, chon cung account/region voi Web Service. Chon goi phu hop tren dashboard; ban code nay khong tu tao dich vu cloud.

Mo trang DATABASE -> Connect, sao chep **Internal Database URL** (khi web va database cung account/region). Tren Web Service N9Studio -> Environment, dat:

| Key | Gia tri |
| --- | --- |
| `Database__Provider` | `PostgreSql` |
| `ConnectionStrings__DefaultConnection` | Dan Internal Database URL that cua database |

Co HAI dau gach duoi trong ten bien. URL co chua mat khau, chi nhap trong Environment, khong dua len GitHub hoac chat. Ban nay nhan dang `postgres://...` / `postgresql://...` va tu chuyen sang chuoi Npgsql; mac dinh bat TLS Require. Cung ho tro chuoi:

```text
Host=THAY_HOST;Port=5432;Database=THAY_DATABASE;Username=THAY_USER;Password=THAY_PASSWORD;SSL Mode=Require
```

Cac chu THAY_... la cho can thay. Khong dung localhost/LocalDB cho database cloud. Neu URL co tham so nang cao ngoai sslmode/connect_timeout, dung chuoi key=value day du theo Npgsql. URL noi bo Render dung sslmode=require; chung chi tu ky noi bo khong ho tro verify-full. Tu may ca nhan ben ngoai Render, dung External Database URL va cau hinh bao mat theo nha cung cap.

### Database PostgreSQL MOI, TRONG

De tao bang, role va 5 admin ban da yeu cau, them trong Environment:

| Key | Gia tri |
| --- | --- |
| `Database__InitializeOnStartup` | `true` |
| `Database__CreateTeamAdmins` | `true` |

Save and deploy. Khi ket noi va quyen database dung, app tao schema bang EF PostgreSQL, chay script PostgreSQL rieng, tao role Admin/Customer va 5 admin trong DANH-SACH-ADMIN.md. Khong chay T-SQL cua SQL Server vao PostgreSQL.

Sau khi khoi tao thanh cong, dat hai bien InitializeOnStartup/CreateTeamAdmins ve `false`, Save and deploy. Mat khau ban dau khong bi in vao deployment logs; doi mat khau truoc khi dung that. Tai khoan Customer trung email khong bi nang quyen, admin da co khong bi doi mat khau.

Database moi se chua co cac san pham/don hang tren may tinh. Ban can nhap du lieu hoac them san pham qua quan tri. Tai khoan tren SQL Server local khong tu dong xuat hien tren PostgreSQL.

### PostgreSQL da co du lieu

Sao luu truoc khi cap nhat. Ban nay giu cac Id va quan he khi bo sung Code/Description/IsActive/Tag, khong DROP hay TRUNCATE bang. Neu schema khong dung bang ten PascalCase cua du an (Categories, Products...), chuong trinh dung va bao loi de tranh sua nham database. Can migration/import phu hop neu di tu schema khac.

## 3. Neu van dung SQL Server

Dat `Database__Provider=SqlServer`, va `ConnectionStrings__DefaultConnection` la chuoi SQL Server online, vi du cau truc:

```text
Server=tcp:THAY_SERVER,1433;Database=THAY_DATABASE;User ID=THAY_USER;Password=THAY_PASSWORD;Encrypt=True;TrustServerCertificate=False;MultipleActiveResultSets=True;
```

Khong dan URL PostgreSQL vao SqlServer. LocalDB chi dung tren Windows local. Mac dinh appsettings.json van giu LocalDB cu cho may ca nhan; Environment tren Render se ghi de no.

Neu co database SQL Server cu, sao luu va import dung schema/du lieu, khong tao database rong thay cho du lieu cu. Neu la database SQL Server online MOI va TRONG, cac bien khoi tao o tren cung hoat dong; app tu chon script SQL Server theo provider.

## 4. Khac biet da xu ly

- Package Npgsql cung the he EF Core 10, khong tron EF8 voi EF10.
- Microsoft.Data.SqlClient duoc tham chieu truc tiep cho ma SQL Server.
- Check constraints dung dau ngoac kep ten cot tren PostgreSQL, giu ngoac vuong cho SQL Server/SQLite.
- PostgreSQL dung UpdatePostgreSql.sql va advisory lock; SQL Server dung cac script T-SQL cu.
- Loi ket noi PostgreSQL/SQL Server tra JSON 503; loi giao dich dong thoi tra 409 de kiem tra lai truoc khi thu.
- Provider Auto nhan dien URL PostgreSQL/Host=..., nhung co the chon provider ro rang de tranh nham cau hinh.
- Khong thay doi schema bang/cot cua SQL Server, khong doi vai tro/mat khau admin da ton tai.

## 5. Email, anh va du lieu ben vung

Chuc nang khoi phuc mat khau van can cau hinh Resend API key va From da xac minh, xem KHOI-PHUC-MAT-KHAU.md. SQL Server hay PostgreSQL deu phai co tai khoan truoc khi khoi phuc.

Anh tai len va Data Protection keys can noi luu ben vung neu muon giu qua lan container bi tao lai. Render Free khong co persistent disk; database khong tu luu file anh. Chi dat ten thu muc khong bien no thanh persistent storage.

## 6. Kiem tra da co

- `dotnet publish` tren Linux de kiem tra loi bien dich/gia tri tham chieu.
- `tests/DatabaseProviderChecks`: chon provider, URL, SSL, sinh schema SQL Server/PostgreSQL va dich cau truy van.
- `tests/postgres-schema.cjs`: chay schema EF va script nang cap tren PostgreSQL engine PGlite, kiem tra du lieu cu, rang buoc va giao dich. Khong thay the test ket noi Npgsql toi PostgreSQL server that.
- `tests/PasswordRecoveryChecks`: Identity/SQLite va HTTPS password recovery; email duoc thu giu trong test.

Chua tao database online hay ket noi vao tai khoan Render cua ban. Publish thanh cong chi xac nhan build, khong dam bao chuoi ket noi va dich vu email da duoc dien dung.

Nguon: https://render.com/docs/postgresql-creating-connecting ; https://www.npgsql.org/efcore/ ; https://www.npgsql.org/doc/security.html ; https://learn.microsoft.com/ef/core/providers/sql-server/
