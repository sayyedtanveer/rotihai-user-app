// Running Expo app in explicit fixture review mode. All external API traffic is blocked.
const {chromium}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin='http://localhost:8097',out='review/screenshots/schedule-pin';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{for(const width of [375,390]){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[],blocked=[];
 page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket(/.*/,ws=>ws.close());
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.pathname.startsWith('/api/')){blocked.push(u.pathname);return route.abort();}
 if(u.pathname==='/delivery-map.html')return route.fulfill({path:path.resolve('../Replitrotihai/client/public/delivery-map.html'),contentType:'text/html'});
 if(u.hostname==='unpkg.com'){const name=path.basename(u.pathname),folder=name.endsWith('.png')?'images/':'';const file=path.resolve('../Replitrotihai/node_modules/leaflet/dist',folder,name);if(fs.existsSync(file))return route.fulfill({path:file,headers:{'Access-Control-Allow-Origin':'*'},contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'image/png'});}
 if(u.hostname==='tile.openstreetmap.org')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=','base64')});
 if(u.origin===origin)return route.continue();return route.abort();});
 await page.goto(origin+'/?screen=ScheduledCheckout',{waitUntil:'domcontentloaded',timeout:120000});await page.getByText('When should we deliver?',{exact:true}).waitFor({timeout:120000});
 await page.getByTestId('delivery-schedule-card').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:`${out}/schedule-now-${width}.png`});
 const place=page.getByRole('button',{name:/Place order ·/});await place.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('[role=button]')].some(e=>(e.getAttribute('aria-label')||'').startsWith('Place order ·')&&e.getAttribute('aria-disabled')!=='true'));
 await page.getByRole('button',{name:/Schedule for later/}).click();await page.getByRole('radio',{name:/Tomorrow/}).click();await page.getByRole('radio').filter({hasText:/AM|PM/}).first().click();
 await page.getByTestId('delivery-schedule-card').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:`${out}/schedule-later-${width}.png`});
 await page.getByRole('radio',{name:/Deliver now/}).click();await place.click();
 await page.getByText('UI review is read-only. No account, order, subscription or payment was submitted.',{exact:true}).waitFor({timeout:15000});
 assert.equal(await page.getByText('Select a delivery slot.',{exact:true}).count(),0);
 console.log(`PASS ${width}px: actual checkout reached protected order submission with Deliver now, no slot selected.`);
 await page.goto(origin+'/?screen=GuestAddress',{waitUntil:'domcontentloaded'});await page.getByText('Where should we deliver?',{exact:true}).waitFor({timeout:30000});
 await page.getByRole('button',{name:'Find my delivery pin',exact:true}).click();await page.getByText('Enter your street or road name.',{exact:true}).waitFor();await page.screenshot({path:`${out}/required-address-${width}.png`});
 await page.getByRole('textbox',{name:'Flat / house / building, required',exact:true}).fill('Fixture Flat 12');await page.getByRole('textbox',{name:'Street / road, required',exact:true}).fill('Fixture Road');await page.getByRole('button',{name:'Find my delivery pin',exact:true}).click();
 await page.getByRole('button',{name:'Use my current location',exact:true}).waitFor();const marker=page.frameLocator('iframe').locator('.leaflet-marker-icon');await marker.waitFor();await marker.click();
 await page.getByRole('button',{name:'Confirm pin & save address',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Confirm pin & save address',exact:true}).isDisabled(),false);await page.screenshot({path:`${out}/correctable-pin-${width}.png`});
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);console.log(`PASS ${width}px: required field errors, map review, GPS option and selecting unchanged correct pin; no live APIs.`);await context.close();
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
