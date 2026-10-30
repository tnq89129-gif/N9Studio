"""Start the compiled host and test routes/auth/CSRF without touching SQL Server.
Usage: python tests/host_smoke.py [absolute-path-to-dotnet]
Run dotnet build Backend/Backend.csproj first.
"""
import json, os, pathlib, subprocess, sys, time, urllib.request, urllib.error
root=pathlib.Path(__file__).resolve().parents[1]
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None
op=urllib.request.build_opener(NoRedirect,urllib.request.ProxyHandler({}))
base='http://localhost:5081'
def check(path,status,method='GET',data=None):
    req=urllib.request.Request(base+path,method=method,data=data,headers={'Content-Type':'application/json'})
    try:
        with op.open(req) as r:code=r.status;headers=r.headers;body=r.read()
    except urllib.error.HTTPError as e:code=e.code;headers=e.headers;body=e.read()
    assert code==status,(path,code,body[:200])
    return headers,body
with open(os.devnull,'w') as log:
    proc=subprocess.Popen([sys.argv[1] if len(sys.argv)>1 else 'dotnet','run','--project',str(root/'Backend/Backend.csproj'),'--no-build','--no-launch-profile','--urls',base],env={**os.environ,'ASPNETCORE_ENVIRONMENT':'Development'},stdout=log,stderr=log)
    try:
        for _ in range(100):
            try:check('/',302);break
            except urllib.error.URLError:time.sleep(.1)
        else:raise RuntimeError('Host did not start. Check build and port 5081.')
        h,_=check('/',302);assert h['Location']=='/GiaoDien/NguoiDung/TrangChu/index.html'
        for page in ['TrangChu','SanPham','DangNhap','DangKy','TaiKhoan','GioHang','DonHang']:
            check('/GiaoDien/NguoiDung/'+page+'/index.html',200)
        for page in ['TongQuan','SanPham','DanhMuc','DonHang','KhachHang','DanhGia']:
            h,_=check('/GiaoDien/QuanTri/'+page+'/index.html',302);assert 'DangNhap' in h['Location']
        for path in ['/api/don-hang','/api/gio-hang','/api/quan-tri/don-hang','/api/quan-tri/danh-muc','/api/tai-khoan/me']:
            check(path,401)
        h,b=check('/api/tai-khoan/csrf',200);assert json.loads(b)['token'];assert 'no-store' in h['Cache-Control']
        check('/api/tai-khoan/dang-nhap',400,'POST',b'{"email":"a@example.com","password":"abc"}')
        check('/GiaoDien/DungChung/api.js',200);check('/images/7.jpg',200)
        print('PASS running ASP.NET host: root route, user pages/admin redirects, anonymous API authorization, CSRF rejection, assets and cache headers. No database operations tested.')
    finally:
        proc.terminate()
        try:proc.wait(timeout=10)
        except subprocess.TimeoutExpired:proc.kill()
