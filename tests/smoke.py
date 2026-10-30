"""Integration smoke test against a RUNNING development server and SQL Server."""
import os, json, uuid, urllib.request, urllib.error, http.cookiejar
BASE = os.environ.get('SHOP_BASE_URL', 'https://localhost:7043')
class Client:
    def __init__(self):
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.token=None
    def request(self, method, path, body=None, expected=200, csrf=True):
        headers={'Content-Type':'application/json'}
        if method!='GET' and csrf:
            if not self.token: self.refresh()
            headers['X-CSRF-TOKEN']=self.token
        req=urllib.request.Request(BASE+path, data=None if body is None else json.dumps(body).encode(), headers=headers, method=method)
        try:
            with self.opener.open(req) as r: status, data=r.status,r.read()
        except urllib.error.HTTPError as e: status,data=e.code,e.read()
        assert status==expected, (method,path,status,expected,data.decode())
        return json.loads(data) if data else None
    def refresh(self): self.token=self.request('GET','/api/tai-khoan/csrf')['token']
    def login(self,email,password):
        self.request('POST','/api/tai-khoan/dang-nhap',{'email':email,'password':password})
        self.refresh()
def main():
    tag=uuid.uuid4().hex[:10]
    admin=Client(); admin.login(os.environ['SHOP_ADMIN_EMAIL'],os.environ['SHOP_ADMIN_PASSWORD'])
    a,b=Client(),Client()
    for i,c in enumerate((a,b)):
        email=f'smoke-{tag}-{i}@example.com'
        c.request('POST','/api/tai-khoan/dang-ky',{'email':email,'password':'TestFashion!2026','fullName':'Smoke '+tag})
        c.login(email,'TestFashion!2026')
    a.request('GET','/api/quan-tri/don-hang',expected=403)
    Client().request('GET','/api/don-hang',expected=401)
    a.request('POST','/api/gio-hang',{'variantId':1,'quantity':1},expected=400,csrf=False)
    cat=admin.request('POST','/api/quan-tri/danh-muc',{'name':'Smoke '+tag})['id']
    prod=admin.request('POST','/api/quan-tri/san-pham',{'name':'Smoke '+tag,'description':'Test','imageUrl':'','categoryId':cat,'isActive':True})['id']
    variant=admin.request('POST',f'/api/quan-tri/san-pham/{prod}/bien-the',{'size':'M','color':'Den','price':199000,'stock':3,'isActive':True})['id']
    def stock(): return a.request('GET',f'/api/san-pham/{prod}')['variants'][0]['stock']
    checkout={'recipient':'Smoke','phone':'0901234567','address':'Test address','note':'Smoke test'}
    a.request('POST','/api/gio-hang',{'variantId':variant,'quantity':4},expected=400)
    a.request('POST','/api/gio-hang',{'variantId':variant,'quantity':2},expected=204)
    order=a.request('POST','/api/don-hang',checkout,expected=201)
    oid=order['id']; assert order['total']==398000 and stock()==1
    assert len(a.request('GET','/api/gio-hang'))==0
    b.request('GET',f'/api/don-hang/{oid}',expected=404)
    b.request('POST',f'/api/don-hang/{oid}/huy',expected=404)
    assert admin.request('GET',f'/api/quan-tri/don-hang/{oid}')['total']==398000
    a.request('POST',f'/api/don-hang/{oid}/huy',expected=204)
    assert stock()==3
    a.request('POST',f'/api/don-hang/{oid}/huy',expected=409)
    assert stock()==3
    assert a.request('GET',f'/api/don-hang/{oid}')['status']=='Cancelled'
    a.request('POST','/api/gio-hang',{'variantId':variant,'quantity':1},expected=204)
    oid=a.request('POST','/api/don-hang',checkout,expected=201)['id']
    a.request('PUT',f'/api/danh-gia/{prod}',{'rating':5,'content':'Test'},expected=400)
    admin.request('PUT',f'/api/quan-tri/don-hang/{oid}/trang-thai',{'status':'Delivered'},expected=409)
    for status in ['Confirmed','Shipping','Delivered']:
        admin.request('PUT',f'/api/quan-tri/don-hang/{oid}/trang-thai',{'status':status},expected=204)
    a.request('POST',f'/api/don-hang/{oid}/huy',expected=409)
    review=a.request('PUT',f'/api/danh-gia/{prod}',{'rating':5,'content':'Smoke test'})['id']
    admin.request('PUT',f'/api/quan-tri/danh-gia/{review}',{'isVisible':False},expected=204)
    assert not a.request('GET',f'/api/san-pham/{prod}')['reviews']
    assert admin.request('GET','/api/quan-tri/tong-quan')['revenue']>=199000
    print('PASS: authorization, ownership, stock, cancellation, delivery and reviews.')
if __name__=='__main__': main()
