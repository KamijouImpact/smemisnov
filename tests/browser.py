"""End-to-end checks against an isolated, temporary QA account set.
Set SME_QA_CREDENTIALS to an untracked JSON file of test accounts.
The database owner provisions and removes these accounts; this script sends no mail.
"""
import json,os
from datetime import datetime,timedelta,timezone
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('SME_QA_URL','http://127.0.0.1:3001')
users=json.load(open(os.environ['SME_QA_CREDENTIALS']))
checks=[]
def check(name):
 checks.append(name);print('PASS',name,flush=True)
def form(page,title):
 panel=page.locator('section.panel').filter(has=page.get_by_role('heading',name=title,exact=True))
 details=panel.locator(':scope > details')
 if details.count() and not details.evaluate('(el)=>el.open'):details.locator(':scope > summary').click()
 return panel.locator('form').first
def save(page,title,values):
 f=form(page,title)
 for name,value in values.items():
  control=f.locator('[name="'+name+'"]')
  extra=f.locator('details.extra-fields')
  if extra.count() and not control.is_visible():extra.locator('summary').click()
  if control.evaluate('(el)=>el.tagName')=='SELECT':
   if value=='FIRST':control.select_option(index=1)
   elif isinstance(value,dict):
    if 'contains' in value:control.select_option(value=control.locator('option').filter(has_text=value['contains']).first.get_attribute('value'))
    else:control.select_option(**value)
   else:control.select_option(label=value)
  else:control.fill(str(value))
 f.locator('button[type=submit]').click();expect(f.locator('.notice')).to_be_visible(timeout=20000)
 msg=f.locator('.notice').inner_text()
 assert f.locator('.notice.success').count(),title+': '+msg
 page.wait_for_timeout(900)
 return msg
def go(page,section):page.goto(BASE+'/workspace/'+section);expect(page.locator('main.workspace-main')).to_be_visible(timeout=30000)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'],proxy={'server':os.environ.get('HTTPS_PROXY','http://proxy:8080'),'bypass':'127.0.0.1,localhost'})
 contexts=[];pages={};errors=[]
 for user in users:
  context=browser.new_context(ignore_https_errors=True,viewport={'width':1365,'height':1000});contexts.append(context);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE+'/auth/login');page.locator('[name=email]').fill(user['email']);page.locator('[name=password]').fill(user['password']);page.locator('form').get_by_role('button',name='Log in',exact=True).click();page.wait_for_url('**/workspace/**',timeout=30000);expect(page.locator('main.workspace-main')).to_be_visible(timeout=30000);pages[user['role']]=page;check(user['role']+' login and workspace')
 admin=pages['Administrator'];owner=pages['Owner'];customer=pages['Customer']
 go(owner,'stores');save(owner,'Add a store',{'store_name':'QA Browser Store','business_type':'Small retail','address':'QA test address'});check('Owner registers store')
 go(admin,'stores');save(admin,'Approve or pause a store',{'sme_id':'QA Browser Store · Pending','status':{'value':'Active'}});check('Administrator activates store')
 go(admin,'catalog');save(admin,'Categories',{'category_name':'QA Browser Goods','product_type':'Packaged Product'});save(admin,'Brands',{'brand_name':'QA Browser Brand'});save(admin,'Product names',{'category_id':'QA Browser Goods','brand_id':'QA Browser Brand','product_name':'QA Browser Cans'});save(admin,'Product options',{'product_id':{'contains':'QA Browser Cans'},'variation_name':'Original 155g','net_quantity':'155','net_unit':'g','condition':'New','stock_unit':'can','allow_price_reference':{'value':'true'}});save(admin,'Pack sizes',{'variation_id':{'contains':'QA Browser Cans'},'unit_name':'can','stock_units':'1'});save(admin,'Pack sizes',{'variation_id':{'contains':'QA Browser Cans'},'unit_name':'box of 24','stock_units':'24'});check('Shared catalog and fixed packages created')
 go(owner,'products');save(owner,'Add a product',{'sme_id':'QA Browser Store','unit_id':{'contains':'QA Browser Cans · Original 155g · can (1 can)'}});save(owner,'Add a product',{'sme_id':'QA Browser Store','unit_id':{'contains':'QA Browser Cans · Original 155g · box of 24 (24 can)'}});check('Owner selects piece and box of same variation')
 go(owner,'prices');save(owner,'Request a price',{'store_price_id':{'contains':'· can (1 can)'},'proposed_price':'20','owner_reason':'Initial price'});expect(owner.get_by_text('Waiting for review',exact=True).first).to_be_visible();check('Initial price held for review')
 go(admin,'prices');save(admin,'Approve or reject a price',{'price_request_id':'FIRST','decision':'Approved','decision_reason':'Initial review confirms exact can.'});check('Administrator approves selling price')
 go(owner,'stock');owner.locator('.stock-picker select').nth(0).select_option(index=1);owner.locator('.stock-picker select').nth(1).select_option(value='Opening');save(owner,'Update stock',{'unit_id':{'index':2},'entered_quantity':'2','total_purchase_cost':'240'});expect(owner.get_by_text('48 can',exact=True)).to_be_visible();check('Two boxes create 48 stock units')
 owner.locator('.stock-picker select').nth(1).select_option(value='Sale');save(owner,'Update stock',{'unit_id':{'index':1},'entered_quantity':'3'});expect(owner.get_by_text('45 can',exact=True)).to_be_visible();check('Sale reduces shared balance by three')
 guest_context=browser.new_context(ignore_https_errors=True,viewport={'width':390,'height':844});contexts.append(guest_context);guest=guest_context.new_page();guest.goto(BASE);expect(guest.get_by_role('heading',name='QA Browser Cans',exact=True)).to_be_visible(timeout=30000);expect(guest.get_by_text('₱20.00',exact=True)).to_be_visible();assert not guest.locator('.notice.error').count();assert not guest.evaluate('document.documentElement.scrollWidth>innerWidth');guest.screenshot(path='/tmp/smemis-products-mobile.png',full_page=True);check('Guest browses price and availability on phone without login')
 go(admin,'promotions');now=datetime.now(timezone(timedelta(hours=8)));save(admin,'Create a promotion',{'promotion_name':'QA Browser Event','starts_at':(now-timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M'),'ends_at':(now+timedelta(days=1)).strftime('%Y-%m-%dT%H:%M')});go(owner,'promotions');save(owner,'Offer a discount',{'promotion_id':'QA Browser Event','store_price_id':{'contains':'· can (1 can)'},'promotion_price':'18'});go(admin,'promotions');save(admin,'Approve or reject a discount',{'promotion_entry_id':'FIRST','decision':'Approved','decision_reason':'Event discount accepted.'});guest.reload();expect(guest.get_by_text('₱18.00',exact=True)).to_be_visible();check('Approved event discount replaces display price')
 go(customer,'concerns');customer.locator('.standalone-field select').select_option(value=customer.locator('.standalone-field option').filter(has_text='QA Browser Store').first.get_attribute('value'));save(customer,'Report a price problem',{'listed_price':'18','charged_price':'20','description':'QA charged regular price during event','evidence_reference':'QA receipt'});check('Customer reports a listed-price difference')
 go(admin,'concerns');save(admin,'Request an Owner response',{'customer_report_id':{'contains':'QA charged regular price during event'}})
 go(customer,'concerns');expect(customer.get_by_text('Response requested',exact=False).first).to_be_visible()
 go(owner,'concerns');save(owner,'Respond to a report',{'customer_report_id':{'contains':'QA charged regular price during event'},'owner_response':'QA checking receipt.'})
 go(admin,'concerns');save(admin,'Review a price report',{'customer_report_id':{'contains':'QA charged regular price during event'},'status':'Closed','outcome':'Confirmed Discrepancy','outcome_details':'QA receipt and event records confirm difference.'})
 go(customer,'concerns');customer.locator('summary').filter(has_text='My closed price reports').click();expect(customer.get_by_text('Confirmed Discrepancy',exact=True)).to_be_visible();check('Administrator request, Owner response, and closure visible to Customer')
 go(owner,'prices');save(owner,'Request a price',{'store_price_id':{'contains':'· can (1 can)'},'proposed_price':'40','owner_reason':'Higher purchase and transport costs.'});go(admin,'prices');save(admin,'Approve or reject a price',{'price_request_id':'FIRST','decision':'Rejected','decision_reason':'Please correct the proposed amount.'});go(owner,'prices');save(owner,'Request a price',{'store_price_id':{'contains':'· can (1 can)'},'proposed_price':'21','owner_reason':'Corrected proposal.','previous_request_id':'FIRST'});check('Rejected request corrected and resubmitted')
 go(owner,'reports');expect(owner.get_by_text('₱60.00',exact=True)).to_be_visible();expect(owner.get_by_text('₱45.00',exact=True)).to_be_visible();with_download=owner.expect_download()
 with with_download as downloaded:owner.get_by_role('button',name='Export CSV').click()
 assert downloaded.value.suggested_filename.endswith('.csv');owner.screenshot(path='/tmp/smemis-reports-desktop.png',full_page=True);check('Sales, cost, gross profit and CSV report')
 go(admin,'overview');admin.screenshot(path='/tmp/smemis-admin-desktop.png',full_page=True)
 go(customer,'stock');expect(customer).to_have_url(BASE+'/workspace/concerns');check('Customer cannot open Owner stock page')
 assert not errors,errors
 check('No browser JavaScript errors')
 for c in contexts:c.close()
 browser.close()
 print('Completed',len(checks),'browser checks',flush=True)
