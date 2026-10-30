"""Run after dotnet build Backend/Backend.csproj -c Release.
Exercises the real production host with isolated unavailable LocalDB and empty email settings.
No remote SQL Server or email provider is contacted.
"""
import http.cookiejar, json, os, pathlib, subprocess, sys, tempfile, time, urllib.request, urllib.error
root = pathlib.Path(__file__).resolve().parents[1]
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs): return None
op = urllib.request.build_opener(NoRedirect(), urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
base = 'http://127.0.0.1:5097'
def check(path, expected, method='GET', body=None, csrf=None, host='n9studio.onrender.com'):
    headers = {'Host': host}
    if body is not None: headers['Content-Type'] = 'application/json'
    if csrf: headers['X-CSRF-TOKEN'] = csrf
    request = urllib.request.Request(base + path, method=method, data=None if body is None else json.dumps(body).encode(), headers=headers)
    try:
        with op.open(request, timeout=5) as r: status, content, headers = r.status, r.read(), r.headers
    except urllib.error.HTTPError as e: status, content, headers = e.code, e.read(), e.headers
    assert status == expected, (path, status, content[:200])
    return content, headers
with tempfile.TemporaryDirectory(prefix='n9-host-check-') as temp:
    env = {**os.environ, 'RENDER': 'true', 'RENDER_EXTERNAL_HOSTNAME': 'n9studio.onrender.com', 'PORT': '5097',
           'ASPNETCORE_ENVIRONMENT': 'Production', 'DOTNET_ENVIRONMENT': 'Production',
           'ConnectionStrings__DefaultConnection': r'Server=(localdb)\MSSQLLocalDB;Database=IsolatedN9RecoveryCheck;Trusted_Connection=True;',
           'Database__InitializeOnStartup': 'false', 'Database__CreateTeamAdmins': 'false',
           'Email__Provider': 'Resend', 'Email__ApiKey': '', 'Email__From': '', 'DataProtection__KeysPath': temp + '/keys'}
    log_path = pathlib.Path(temp) / 'host.log'
    with log_path.open('w') as log:
        proc = subprocess.Popen([sys.argv[1] if len(sys.argv)>1 else 'dotnet', str(root/'Backend/bin/Release/net10.0/Backend.dll')], cwd=root/'Backend', env=env, stdout=log, stderr=log)
        try:
            for _ in range(100):
                try: check('/', 302); break
                except urllib.error.URLError: time.sleep(.1)
            else: raise RuntimeError(log_path.read_text())
            for page in ['DangNhap', 'QuenMatKhau', 'DatLaiMatKhau']:
                check('/GiaoDien/NguoiDung/' + page + '/index.html', 200)
            for name in ['recovery.js', 'recovery.css']:
                check('/GiaoDien/DungChung/' + name, 200)
            token = json.loads(check('/api/tai-khoan/csrf', 200)[0])['token']
            check('/api/tai-khoan/quen-mat-khau', 400, 'POST', {'email':'probe@example.com'})
            data, _ = check('/api/tai-khoan/quen-mat-khau', 503, 'POST', {'email':'probe@example.com'}, token)
            assert json.loads(data)['message']
            data, headers = check('/api/tai-khoan/dang-nhap', 503, 'POST', {'email':'probe@example.com','password':'Probe@2026'}, token)
            assert headers['Content-Type'].startswith('application/json') and 'no-store' in headers['Cache-Control']
            assert 'LocalDB' not in data.decode() and 'Exception' not in data.decode()
            check('/api/quan-tri/anh-san-pham', 401)
            check('/', 400, host='not-allowed.example')
            assert 'ConnectionStrings__DefaultConnection' in log_path.read_text()
            print('PASS real Render-mode host: recovery pages/assets, CSRF, missing email configuration 503, SQL LocalDB failure becomes safe JSON 503, protected admin API and hostname checks. No remote service contacted.')
        finally:
            proc.terminate()
            try: proc.wait(timeout=10)
            except subprocess.TimeoutExpired: proc.kill()
