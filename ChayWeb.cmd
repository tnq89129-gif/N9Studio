@echo off
setlocal
pushd "%~dp0Backend"
dotnet run --launch-profile https
if errorlevel 1 echo Khong chay duoc web. Xem thong bao loi o tren.
popd
pause
endlocal
