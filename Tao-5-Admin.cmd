@echo off
setlocal
pushd "%~dp0Backend"
dotnet run -- --create-team-admins
if errorlevel 1 (
  echo Khong tao duoc tai khoan. Xem loi SQL Server hoac email trung o tren.
  pause
  popd
  exit /b 1
)
echo Da khoi tao. Xem DANH-SACH-ADMIN.md de dang nhap.
dotnet run --launch-profile https
pause
popd
endlocal
