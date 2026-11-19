const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const cache=new Map();
function load(relative){
 const file=path.resolve(__dirname,'..',relative);if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(name=>name.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(file),name+'.ts'))):require(name),module,module.exports);
 return module.exports;
}
const {interpretCraving,matchCraving,broadeningChoices,broadenCraving}=load('src/application/user/catalog/cravingRules.ts');
const chef={id:'c',name:'Actual kitchen',isActive:true,isCurrentlyOpen:true,distanceFromUser:2};
const chicken={id:'chicken',name:'Spicy chicken',description:'Freshly cooked',section:'Dinner',chefId:'c',categoryId:'food',price:145,stockQuantity:4,isAvailable:true,isVeg:false};
const veg={...chicken,id:'veg',name:'Ghar ka thali',description:'Home style meal',price:100,isVeg:true};
const categories=[{id:'food',name:'Meals'}];
const match=(text,products=[chicken,veg],chefs=[chef])=>matchCraving(interpretCraving(text),products,chefs,categories);
test('Hinglish spicy chicken extracts separate taste, food and budget without claiming verified spice',()=>{const intent=interpretCraving('Mujhe spicy chicken chahiye under 150');assert.equal(intent.budget,150);assert.equal(intent.groups[0][0],'chicken');assert.deepEqual(intent.requirements,[{kind:'taste',value:'spicy'}]);assert.equal(match(intent.text).status,'unverified');assert.deepEqual(match(intent.text).exact,[]);});
test('Hindi script and Devanagari budget preserve spice intent without using menu text as verification',()=>{const result=match('मुझे तीखा चिकन १५० रुपये तक चाहिए');assert.equal(result.intent.budget,150);assert.equal(result.intent.groups[0][0],'chicken');assert.equal(result.intent.requirements[0].value,'spicy');assert.equal(result.status,'unverified');assert.deepEqual(result.exact,[]);});
test('vegetarian home-style craving keeps diet but does not certify home-style from text',()=>{const result=match('Veg ghar ka khana chahiye');assert.equal(result.intent.diet,'veg');assert.equal(result.intent.requirements[0].value,'home-style');assert.equal(result.status,'unverified');assert.deepEqual(result.exact,[]);});
test('dessert category remains useful for ordinary browsing but cannot verify meetha taste',()=>{const sweet={...veg,id:'dessert',name:'Kheer',description:'Rice pudding',categoryId:'sweet'};const cats=[{id:'sweet',name:'Desserts'}];assert.equal(matchCraving(interpretCraving('dessert'),[sweet],[chef],cats).exact.length,1);const strict=matchCraving(interpretCraving('Kuch meetha khana hai'),[sweet],[chef],cats);assert.equal(strict.exact.length,0);assert.equal(strict.status,'unverified');});
test('budget accepts decimal prices, Hindi suffixes and currency notation',()=>{for(const [text,budget]of [['under 149.50',149.5],['₹120',120],['120 se kam',120],['within ₹150',150]])assert.equal(interpretCraving(text).budget,budget);assert.equal(match('chicken under 144').exact.length,0);assert.equal(match('chicken under 145').exact.length,1);});
test('matching uses existing rupees-off discount calculation',()=>{const result=match('chicken under 130',[{...chicken,offerPercentage:20}]);assert.equal(result.exact[0].price,125);});
test('no-match never creates alternatives; explicit browse preserves budget and vegetarian flag',()=>{const result=match('veg pizza under 110');assert.equal(result.exact.length,0);assert.deepEqual(result.alternatives,[]);const broader=broadenCraving(result.intent,'browse');assert.equal(broader.budget,110);assert.equal(broader.diet,'veg');assert.deepEqual(matchCraving(broader,[chicken,veg],[chef],categories).exact.map(r=>r.product.id),['veg']);assert.equal(match('veg pizza under 50').alternatives.length,0);});
test('unknown dietary flags are excluded rather than inferred from names',()=>{assert.equal(match('veg',[{...veg,isVeg:undefined}]).exact.length,0);assert.equal(match('non veg',[{...chicken,isVeg:undefined}]).exact.length,0);});
test('non-veg does not accidentally become vegetarian',()=>{assert.equal(interpretCraving('non-veg chicken').diet,'nonveg');assert.deepEqual(match('non-veg chicken').exact.map(r=>r.product.id),['chicken']);});
test('missing home-style metadata does not claim a home-style match',()=>{assert.equal(match('ghar ka khana',[chicken]).exact.length,0);});
test('serviceable chef list is the search boundary',()=>{assert.equal(match('chicken',[chicken],[]).exact.length,0);assert.equal(match('chicken',[{...chicken,chefId:'outside'}]).exact.length,0);});
test('inactive, closed instant, unavailable and out-of-stock food is excluded',()=>{for(const candidate of [{...chef,isActive:false},{...chef,isCurrentlyOpen:false}])assert.equal(match('chicken',[chicken],[candidate]).exact.length,0);for(const candidate of [{...chicken,isAvailable:false},{...chicken,stockQuantity:0},{...chicken,price:NaN}])assert.equal(match('chicken',[candidate]).exact.length,0);});
test('preorder availability reuses the catalog fulfillment rule',()=>{const result=match('chicken',[{...chicken,effectiveMode:'preorder'}],[{...chef,isCurrentlyOpen:false}]);assert.equal(result.exact[0].mode,'preorder');});
test('variant budget and displayed options use only available in-stock sizes',()=>{const variants=[{id:'empty',price:10,isActive:true,isAvailable:true,stockQuantity:0},{id:'small',price:100,isActive:true,isAvailable:true,stockQuantity:2},{id:'large',price:200,isActive:true,isAvailable:true,stockQuantity:1}];const product={...chicken,hasVariants:true,price:1,stockQuantity:0,variants};const row=match('chicken under 150',[product]).exact[0];assert.equal(row.price,100);assert.deepEqual(row.product.variants.map(v=>v.id),['small','large']);assert.equal(product.variants.length,3);assert.equal(match('chicken under 99',[product]).exact.length,0);});
test('multiple chefs rank ordinary dish relevance then actual distance without mutating inputs',()=>{const far={...chef,id:'far',distanceFromUser:10},products=[{...chicken,id:'far-dish',chefId:'far'},chicken];const result=match('chicken',products,[far,chef]);assert.deepEqual(result.exact.map(r=>r.chef.id),['c','far']);assert.equal(products[0].id,'far-dish');});
test('unsupported exclusions and vegan requirements do not produce misleading alternatives',()=>{for(const text of ['not spicy','chicken nahi','vegan khana']){const result=match(text);assert.equal(result.exact.length,0);assert.equal(result.alternatives.length,0);assert.ok(result.intent.warnings.length);}});
test('less spicy is parsed once as mild',()=>{const intent=interpretCraving('less spicy chicken');assert.ok(intent.labels.includes('mild'));assert.ok(!intent.labels.includes('spicy'));});

test('sweet and sour are explicit AND by default; ya/or represent taste-only OR',()=>{
 for(const text of ['meetha khatta','meetha aur khatta','sweet and sour']){const i=interpretCraving(text);assert.equal(i.tasteOperator,'and');assert.deepEqual(i.requirements.map(r=>r.value).sort(),['sour','sweet']);assert.deepEqual(i.groups,[]);assert.equal(match(text).status,'unverified');}
 for(const text of ['meetha ya khatta','sweet or tangy','मीठा या खट्टा']){const i=interpretCraving(text);assert.equal(i.tasteOperator,'or');assert.deepEqual(i.requirements.map(r=>r.value).sort(),['sour','sweet']);assert.equal(i.clarification,undefined);assert.deepEqual(i.groups,[]);assert.equal(match(text).exact.length,0);}
});
test('Hindi and Hinglish equivalent tastes have the same requirements and no category-certified matches',()=>{
 const p={...veg,name:'Kala Khatta Sweet',description:'Sweet and sour',categoryId:'dessert'};
 for(const text of ['meetha khatta','मीठा खट्टा']){const i=interpretCraving(text);assert.deepEqual(i.requirements.map(r=>r.value).sort(),['sour','sweet']);const r=matchCraving(i,[p],[{...chef,chefType:'home'}],[{id:'dessert',name:'Sweets and Desserts'}]);assert.equal(r.status,'unverified');assert.deepEqual(r.exact,[]);assert.deepEqual(r.alternatives,[]);}
});
test('sour synonyms including standalone khatta are recognized without literal food keywords',()=>{for(const text of ['kuch khatta chahiye','कुछ खट्टा चाहिए','tangy','sour','khata']){const i=interpretCraving(text);assert.equal(i.requirements[0].value,'sour');assert.deepEqual(i.groups,[]);}});
test('sirf/only/के अंदर are fillers; veg and INR are real constraints',()=>{
 for(const text of ['Sirf veg chahiye','Only vegetarian','सिर्फ शाकाहारी चाहिए']){const r=match(text);assert.equal(r.intent.diet,'veg');assert.deepEqual(r.intent.groups,[]);assert.deepEqual(r.exact.map(r=>r.product.id),['veg']);}
 for(const text of ['₹150 ke andar','150 ke andar','१५० के अंदर','under 150','150 tak']){const i=interpretCraving(text);assert.equal(i.budget,150);assert.deepEqual(i.groups,[]);assert.ok(match(text).exact.length);}
});
test('mild paneer and spicy chicken cannot certify spice from product names or descriptions',()=>{for(const text of ['mild paneer','halka teekha paneer','हल्का तीखा पनीर','spicy chicken']){const r=match(text,[{...veg,name:'Mild paneer',description:'Verified mild spicy home food'},{...chicken,tasteTags:['spicy']}]);assert.equal(r.status,'unverified');assert.equal(r.exact.length,0);}});
test('medium portion size and hot soup temperature never prove a spice level',()=>{const products=[{...veg,name:'Paneer Medium',description:'Hot food served fresh'}];for(const text of ['medium spice','hot spice','medium paneer','hot paneer']){const r=match(text,products);assert.equal(r.exact.length,0);assert.ok(['clarify','unverified'].includes(r.status));}});
test('cuisine/meal and home-style intents remain separate from category and chef type',()=>{
 const i=interpretCraving('South Indian breakfast');assert.deepEqual(i.requirements,[{kind:'cuisine',value:'South Indian'}]);assert.equal(i.groups[0][0],'breakfast');assert.equal(match(i.text).status,'unverified');
 const r=match('ghar jaisa khana',[{...veg,name:'Home style thali'}],[{...chef,chefType:'home'}]);assert.equal(r.status,'unverified');assert.equal(r.exact.length,0);
});
test('low/no-added/less/free sugar salt and oil remain unverified and cannot be broadened away',()=>{
 const products=[{...veg,name:'Low salt Low sugar Low oil Sugar free No added oil',description:'healthy low sodium high protein'}];
 for(const text of ['low sugar','no added sugar','sugar free','low salt','no added salt','less salt','low sodium','low oil','no added oil','less oil','bina chini','कम नमक','kam tel','high protein']){const r=match(text,products);assert.equal(r.status,'unverified',text);assert.equal(r.exact.length,0,text);assert.deepEqual(r.alternatives,[]);assert.ok(r.intent.requirements.some(r=>r.kind==='dietary'));assert.deepEqual(broadeningChoices(r.intent),[]);assert.equal(broadenCraving(r.intent,'without-unverified'),undefined);}
 const noAdded=interpretCraving('no added sugar');assert.equal(noAdded.requirements[0].value,'no added sugar');assert.ok(!noAdded.labels.includes('sugar-free'));
});
test('vegan stays unverified even when every product is vegetarian',()=>{const r=match('vegan food',[veg]);assert.equal(r.status,'unverified');assert.equal(r.exact.length,0);assert.deepEqual(broadeningChoices(r.intent),[]);});
test('explicit taste relaxation is the only way to show ordinary food for a strict craving',()=>{
 const i=interpretCraving('veg mild paneer under 150'),products=[{...veg,name:'Paneer thali'}];const before=matchCraving(i,products,[chef],categories);assert.equal(before.exact.length,0);assert.deepEqual(before.alternatives,[]);
 assert.equal(broadenCraving(i,'browse'),undefined);const options=broadeningChoices(i);assert.equal(options.length,1);assert.match(options[0].label,/without mild/);
 const approved=broadenCraving(i,options[0].id);assert.equal(approved.budget,150);assert.equal(approved.diet,'veg');assert.equal(approved.groups[0][0],'paneer');assert.ok(approved.broadened);assert.equal(i.requirements[0].value,'mild');assert.equal(matchCraving(approved,products,[chef],categories).exact.length,1);
});
test('explicit browse retains location stock diet budget and variant pricing guards',()=>{
 const i=broadenCraving(interpretCraving('veg mild paneer under 150'),'without-unverified');
 const variant={id:'s',price:140,isActive:true,isAvailable:true,stockQuantity:2};
 const good={...veg,name:'Paneer',id:'good',hasVariants:true,price:1,variants:[{...variant,id:'zero',price:1,stockQuantity:0},variant]};
 const rows=matchCraving(i,[good,{...good,id:'far',chefId:'outside'},{...good,id:'costly',variants:[{...variant,price:151}]},{...good,id:'empty',variants:[]},{...good,id:'nonveg',isVeg:false},{...good,id:'unavailable',isAvailable:false}],[chef],categories).exact;
 assert.deepEqual(rows.map(r=>r.product.id),['good']);assert.equal(rows[0].price,140);assert.equal(rows[0].product.variants.length,1);
});
test('ordinary paneer roti biryani and dish-only Hindi searches retain relevance',()=>{
 const products=[{...veg,id:'paneer',name:'Paneer bhurji'},{...veg,id:'roti',name:'Phulka'},{...veg,id:'biryani',name:'Veg biryani'},{...veg,id:'unrelated',name:'Chocolate pudding'}];
 for(const [query,id]of [['paneer','paneer'],['पनीर','paneer'],['roti','roti'],['biryani','biryani']])assert.deepEqual(match(query,products).exact.map(r=>r.product.id),[id]);
 assert.deepEqual(match('unfindable food',products).exact,[]);assert.deepEqual(match('unfindable food',products).alternatives,[]);
});
test('mixed or ambiguous conjunctions request clarification rather than silently weaken identity',()=>{for(const text of ['paneer ya chicken','sweet and sour or spicy','veg non veg','medium','hot soup']){const i=interpretCraving(text);assert.ok(i.clarification,text);assert.equal(match(text).exact.length,0);assert.deepEqual(broadeningChoices(i),[]);}});

const {CravingVoiceSession,greeting}=load('src/core/voice/CravingVoiceSession.ts');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(options={}){
 const listeners=new Map(),changes=[],submitted=[],calls={start:0,abort:0,stop:0,permission:0,speak:0};let done,error;
 const port={speak:(text,onDone,onError)=>{assert.equal(text,greeting);calls.speak++;done=onDone;error=onError;},stopSpeaking:async()=>{calls.stop++;},available:()=>options.available!==false,permission:async()=>{calls.permission++;return options.permission?options.permission():options.granted!==false;},start:language=>{calls.start++;calls.language=language;if(options.startError)throw Error('No microphone');},abort:()=>{calls.abort++;},on:(event,callback)=>{listeners.set(event,callback);return()=>listeners.delete(event);}};
 const session=new CravingVoiceSession(port,(state,message,text)=>changes.push({state,message,text}),text=>submitted.push(text),options.timeouts||{speech:1000,listen:1000});
 return {session,changes,submitted,calls,listeners,captureDone:()=>done,done:()=>done(),error:()=>error(),emit:(event,data)=>listeners.get(event)?.(data)};
}
test('opening speaks first, then requests permission and starts one listener set',async()=>{const h=harness();await h.session.open('hi-IN');assert.equal(h.calls.start,0);assert.equal(h.calls.permission,0);assert.equal(h.changes.at(-1).state,'SPEAKING');h.done();await flush();assert.equal(h.calls.start,1);assert.equal(h.calls.language,'hi-IN');assert.equal(h.changes.at(-1).state,'LISTENING');assert.equal(h.listeners.size,3);await h.session.cancel();assert.equal(h.listeners.size,0);});
test('final recognition submits once and releases native listeners',async()=>{const h=harness();await h.session.retry('en-IN');const oldEnd=h.listeners.get('end'),oldResult=h.listeners.get('result');h.emit('result',{isFinal:true,results:[{transcript:'spicy chicken'}]});oldEnd();oldResult({isFinal:true,results:[{transcript:'duplicate'}]});assert.deepEqual(h.submitted,['spicy chicken']);assert.equal(h.listeners.size,0);assert.equal(h.changes.at(-1).state,'PROCESSING');await h.session.cancel();});
test('interim transcript becomes search only after recognition ends',async()=>{const h=harness();await h.session.retry('hi-IN');h.emit('result',{isFinal:false,results:[{transcript:'veg thali'}]});assert.equal(h.submitted.length,0);h.emit('end');assert.deepEqual(h.submitted,['veg thali']);await h.session.cancel();});
test('permission denied and missing recognizer keep manual fallback',async()=>{for(const options of [{granted:false},{available:false},{startError:true}]){const h=harness(options);await h.session.retry('hi-IN');assert.equal(h.changes.at(-1).state,'IDLE');assert.ok(h.changes.at(-1).message);assert.equal(h.listeners.size,0);await h.session.cancel();}});
test('closing while permission is pending never starts the microphone',async()=>{let grant;const h=harness({permission:()=>new Promise(resolve=>grant=resolve)});const pending=h.session.retry('hi-IN');await flush();await h.session.cancel();grant(true);await pending;assert.equal(h.calls.start,0);});
test('closing during greeting prevents the onDone callback from listening',async()=>{const h=harness();await h.session.open('hi-IN');await h.session.cancel();h.done();await flush();assert.equal(h.calls.start,0);});
test('closing or typing during listening rejects late native events',async()=>{const h=harness();await h.session.retry('hi-IN');const old=h.listeners.get('result');await h.session.cancel();old({isFinal:true,results:[{transcript:'late'}]});assert.equal(h.submitted.length,0);assert.equal(h.listeners.size,0);});
test('silence, recognizer failure and timeout release microphone and offer text',async()=>{for(const reason of ['end','error','timeout']){const h=harness({timeouts:{speech:20,listen:10}});await h.session.retry('hi-IN');if(reason==='end')h.emit('end');else if(reason==='error')h.emit('error',{error:'network'});else await new Promise(resolve=>setTimeout(resolve,25));assert.equal(h.changes.at(-1).state,'IDLE');assert.equal(h.listeners.size,0);assert.equal(h.submitted.length,0);await h.session.cancel();}});
test('greeting failure or timeout never starts recognition',async()=>{for(const timeout of [false,true]){const h=harness({timeouts:{speech:10,listen:10}});await h.session.open('hi-IN');if(timeout)await new Promise(resolve=>setTimeout(resolve,25));else h.error();assert.equal(h.calls.start,0);assert.equal(h.changes.at(-1).state,'IDLE');await h.session.cancel();}});
test('repeated opens invalidate the previous greeting callback',async()=>{const h=harness();await h.session.open('hi-IN');const oldDone=h.captureDone();await h.session.open('en-IN');oldDone();await flush();assert.equal(h.calls.start,0);assert.equal(h.calls.speak,2);h.done();await flush();assert.equal(h.calls.start,1);assert.equal(h.calls.language,'en-IN');await h.session.cancel();});

test('Android permission Activity background does not cancel greeting-to-microphone continuation',async()=>{
 let grant;const h=harness({permission:()=>new Promise(resolve=>grant=resolve)});
 await h.session.open('hi-IN');h.done();await flush();
 h.session.appStateChanged('background');assert.equal(h.calls.start,0);
 h.session.appStateChanged('active');grant(true);await flush();
 assert.equal(h.calls.start,1);assert.equal(h.changes.at(-1).state,'LISTENING');await h.session.cancel();
});
test('permission resolved before Activity resume waits for foreground before recording',async()=>{
 let grant;const h=harness({permission:()=>new Promise(resolve=>grant=resolve)});
 const pending=h.session.retry('hi-IN');await flush();h.session.appStateChanged('background');grant(true);await flush();
 assert.equal(h.calls.start,0);h.session.appStateChanged('active');await pending;
 assert.equal(h.calls.start,1);await h.session.cancel();
});
test('closing while waiting for permission Activity resume rejects stale microphone start',async()=>{
 let grant;const h=harness({permission:()=>new Promise(resolve=>grant=resolve)});
 const pending=h.session.retry('hi-IN');await flush();h.session.appStateChanged('background');grant(true);await flush();
 await h.session.cancel();h.session.appStateChanged('active');await pending;assert.equal(h.calls.start,0);
});
test('real background during listening releases microphone and resume never auto-starts',async()=>{
 const h=harness();await h.session.retry('hi-IN');const old=h.listeners.get('result');
 h.session.appStateChanged('background');assert.equal(h.listeners.size,0);assert.equal(h.changes.at(-1).state,'IDLE');
 old({isFinal:true,results:[{transcript:'late'}]});h.session.appStateChanged('active');await flush();
 assert.equal(h.calls.start,1);assert.equal(h.submitted.length,0);await h.session.retry('hi-IN');assert.equal(h.calls.start,2);await h.session.cancel();
});
test('background during greeting invalidates speech completion without starting recognition',async()=>{
 const h=harness();await h.session.open('hi-IN');h.session.appStateChanged('background');h.done();h.session.appStateChanged('active');await flush();assert.equal(h.calls.start,0);assert.equal(h.changes.at(-1).state,'IDLE');await h.session.cancel();
});
test('permission denial after Activity background remains recoverable without recording',async()=>{
 let grant;const h=harness({permission:()=>new Promise(resolve=>grant=resolve)});const pending=h.session.retry('hi-IN');await flush();h.session.appStateChanged('background');grant(false);await pending;assert.equal(h.calls.start,0);assert.match(h.changes.at(-1).message,/denied/);await h.session.cancel();
});
test('permission result during a genuine app switch expires without an automatic restart',async()=>{
 let grant;const h=harness({permission:()=>new Promise(resolve=>grant=resolve)});const pending=h.session.retry('hi-IN');await flush();h.session.appStateChanged('background');grant(true);await pending;h.session.appStateChanged('active');assert.equal(h.calls.start,0);assert.match(h.changes.at(-1).message,/Tap the mic/);await h.session.cancel();
});
