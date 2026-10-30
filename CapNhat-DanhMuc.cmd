@echo off
setlocal
pushd "%~dp0Backend"
dotnet run -- --update-categories
if errorlevel 1 (
  echo Cap nhat danh muc that bai. Xem loi SQL Server o tren.
  pause
  popd
  exit /b 1
)
echo Cap nhat thanh cong. Dang chay website...
dotnet run --launch-profile https
pause
popd
endlocal
