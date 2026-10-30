@echo off
setlocal
pushd "%~dp0Backend"
dotnet run -- --update-products
if errorlevel 1 (
  echo Cap nhat san pham that bai. Xem loi SQL Server o tren.
  pause
  popd
  exit /b 1
)
echo Da cap nhat. Dang chay website...
dotnet run --launch-profile https
pause
popd
endlocal
