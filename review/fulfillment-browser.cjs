// Running Expo app in explicit fixture review mode. All external API traffic is blocked.
const {chromium}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin='http://localhost:8097',out='review/screenshots/fulfillment';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{for(const width of [375,390]){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[],blocked=[];
 page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket(/.*/,ws=>ws.close());
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.pathname.startsWith('/api/')){blocked.push(u.pathname);return route.abort();}
 if(u.pathname==='/delivery-map.html')return route.fulfill({path:path.resolve('../Replitrotihai/client/public/delivery-map.html'),contentType:'text/html'});
 if(u.hostname==='unpkg.com'){const name=path.basename(u.pathname),folder=name.endsWith('.png')?'images/':'';const file=path.resolve('../Replitrotihai/node_modules/leaflet/dist',folder,name);if(fs.existsSync(file))return route.fulfill({path:file,headers:{'Access-Control-Allow-Origin':'*'},contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'image/png'});}
 if(u.hostname==='tile.openstreetmap.org')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=','base64')});
 if(u.origin===origin)return route.continue();return route.abort();});

 for(const [screen,expected,hidden] of [['PreorderLunchChef','Lunch','Dinner'],['PreorderDinnerChef','Dinner','Lunch']]){
  await page.goto(origin+'/?screen='+screen,{waitUntil:'domcontentloaded',timeout:120000});
  await page.getByText('When should we deliver?',{exact:true}).waitFor({timeout:120000});
  const choice=page.getByRole('radio',{name:new RegExp('^'+expected+' ')});await choice.waitFor({timeout:20000});
  assert.equal(await page.getByRole('radio',{name:new RegExp('^'+hidden+' ')}).count(),0,'only the selected chef enabled meal appears');
  assert.equal(await page.getByRole('radio',{name:/Deliver now/}).count(),0,'preorders cannot use regular delivery');
  const place=page.getByRole('button',{name:/Place order ·/});assert.equal(await place.isDisabled(),true,'a meal selection is required');
  await choice.click();await page.waitForFunction(()=>[...document.querySelectorAll('[role=button]')].some(e=>(e.getAttribute('aria-label')||'').startsWith('Place order ·')&&e.getAttribute('aria-disabled')!=='true'));
  await page.getByTestId('delivery-schedule-card').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:`${out}/${screen}-${width}.png`});
  await place.click();await page.getByText('UI review is read-only. No account, order, subscription or payment was submitted.',{exact:true}).waitFor({timeout:15000});
  console.log(`PASS ${width}px ${screen}: correct chef meal only, explicit selection required, closed active chef preorder reaches protected submission.`);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);await context.close();
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
