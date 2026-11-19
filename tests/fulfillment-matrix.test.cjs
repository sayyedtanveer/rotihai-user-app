const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(file){const absolute=path.resolve(root,file);if(cache.has(absolute))return cache.get(absolute).exports;const m={exports:{}};cache.set(absolute,m);const code=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(name=>name.startsWith('.')?load(path.relative(root,path.resolve(path.dirname(absolute),name+'.ts'))):require(name),m,m.exports);return m.exports;}
const menu=load('src/application/user/catalog/menuRules.ts'),cart=load('src/application/user/cart/cartRules.ts'),checkout=load('src/application/user/cart/checkoutRules.ts'),restore=load('src/application/user/cart/restoreCart.ts');
const category={id:'category',name:'Configured meals',requiresDeliverySlot:true};
const kitchen=(mode='both',overrides={})=>({id:'chef',name:'Fixture chef',fulfillmentMode:mode,isActive:true,isCurrentlyOpen:true,latitude:19.07,longitude:72.88,...overrides});
const dish=(mode='inherit',overrides={})=>({id:'dish',name:'Fixture dish',description:'Fixture',chefId:'chef',categoryId:category.id,fulfillmentMode:mode,price:20,isAvailable:true,stockQuantity:20,...overrides});
function item(mode,id=mode){return menu.cartItemFromProduct(dish('inherit',{id,effectiveMode:mode}),kitchen(),category);}
const reference=path.resolve(root,'../Replitrotihai'),hasReference=fs.existsSync(path.join(reference,'server/routes.ts'));
let backendProductHandler,webSlotsFactory;
if(hasReference){
 const source=fs.readFileSync(path.join(reference,'server/routes.ts'),'utf8'),sf=ts.createSourceFile('routes.ts',source,ts.ScriptTarget.Latest,true);let handler;
 function visit(node){if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='get'&&ts.isStringLiteral(node.arguments[0])&&node.arguments[0].text==='/api/products/:id')handler=node.arguments.at(-1).getText(sf);ts.forEachChild(node,visit);}visit(sf);assert.ok(handler,'existing reference product handler');
 backendProductHandler=async(product,chef)=>{let result,status=200;const storage={getProductById:async()=>product,getAllCategories:async()=>[category],getChefs:async()=>[chef],getVariantsByProductId:async()=>[]},console={error(){},warn(){},log(){}};
 const code=ts.transpileModule('const handler='+handler+';',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return handler;';const fn=new Function('storage','console',code)(storage,console),res={status(value){status=value;return this;},json(value){result=value;}};await fn({params:{id:product.id}},res);assert.equal(status,200);return result;};
 const sourceWeb=fs.readFileSync(path.join(reference,'client/src/components/CheckoutDialog.tsx'),'utf8'),tree=ts.createSourceFile('checkout.tsx',sourceWeb,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let calculator;
 function find(node){if(ts.isVariableDeclaration(node)&&ts.isObjectBindingPattern(node.name)&&node.name.elements.some(e=>e.name.getText(tree)==='preorderSlots')&&ts.isCallExpression(node.initializer))calculator=node.initializer.arguments[0].getText(tree);ts.forEachChild(node,find);}find(tree);assert.ok(calculator,'existing web preorder slot calculator');
 webSlotsFactory=(chef,settings,now)=>{class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const source=fs.readFileSync(path.join(reference,'shared/timeFormatter.ts'),'utf8'),m={exports:{}};new Function('exports','module','Date',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(m.exports,m,FixedDate);
 const code=ts.transpileModule('const calculate='+calculator+';',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return calculate();';return new Function('cartHasPreorder','adminSettings','chefData','Date','getBusinessDateStringFromDate','getBusinessTomorrow',code)(true,settings,chef,FixedDate,m.exports.getBusinessDateStringFromDate,m.exports.getBusinessTomorrow);};
}
for(const chefMode of ['instant','preorder','both'])for(const productMode of ['inherit','instant','preorder']){
 test(`mode matrix: chef ${chefMode}, product ${productMode}, category offers slots`,async()=>{const chef=kitchen(chefMode),product=dish(productMode),expected=productMode==='inherit'?chefMode:productMode;
  assert.equal(menu.cartItemFromProduct(product,chef,category).effectiveMode,expected);assert.equal(menu.effectiveFulfillmentMode(product,chef),expected);
  if(hasReference)assert.equal((await backendProductHandler(product,chef)).effectiveMode,expected,'matches the actual existing backend handler');
 });
}
for(const left of ['instant','preorder','both'])for(const right of ['instant','preorder','both'])test(`basket matrix: ${left} + ${right}`,()=>{
 const a=item(left,'left'),b=item(right,'right'),mixed=left==='instant'&&right==='preorder'||left==='preorder'&&right==='instant';
 assert.equal(cart.cartFulfillment([a,b]).mixed,mixed);if(mixed)assert.throws(()=>cart.assertCanAdd([a],b),/separate checkouts/);else assert.doesNotThrow(()=>cart.assertCanAdd([a],b));
 if(!mixed)assert.equal(cart.cartFulfillment([a,b]).preorder,left==='preorder'||right==='preorder');
});
test('different chefs/categories retain separate instant/preorder checkouts',()=>{const a=item('instant');for(const change of [{chefId:'another-chef'},{categoryId:'another-category'}]){const b={...item('preorder'),...change};assert.doesNotThrow(()=>cart.assertCanAdd([a],b));assert.equal(cart.groupCart([a,b]).length,2);}});
test('closed active chef allows preorder and flexible items in a preorder basket, never instant or inactive orders',()=>{
 const closed=kitchen('both',{isCurrentlyOpen:false});assert.equal(menu.isProductOrderable(closed,dish('preorder')),true);assert.equal(menu.isProductOrderable(closed,dish('instant')),false);assert.equal(menu.isProductOrderable(closed,dish('inherit')),false);assert.equal(menu.isProductOrderable(closed,dish('inherit'),true),true);
 const flexible=item('both');assert.equal(menu.cartItemIssue(flexible,[dish('inherit',{id:flexible.id,effectiveMode:'both'})],[closed],true),null);
 for(const mode of ['instant','preorder','both'])assert.equal(menu.isProductOrderable({...closed,isActive:false},dish(mode),true),false);
});
test('fresh chef mode changes block the old basket while an explicit product override stays valid',()=>{
 const inherited=dish(),old=menu.cartItemFromProduct(inherited,kitchen('preorder'),category);assert.throws(()=>checkout.validateFreshItem(old,inherited,null,kitchen('instant')),/new delivery mode/);
 const override=dish('preorder'),current=menu.cartItemFromProduct(override,kitchen('instant'),category);assert.doesNotThrow(()=>checkout.validateFreshItem(current,override,null,kitchen('instant')));
});
const settings={preorder_lunch_start_time:'11:15',preorder_lunch_end_time:'16:00',preorder_dinner_start_time:'18:30',preorder_dinner_end_time:'22:00'},now=Date.parse('2026-11-18T09:00:00+05:30');
for(const lunchEnabled of [false,true])for(const dinnerEnabled of [false,true])test(`chef slot matrix: Lunch ${lunchEnabled}, Dinner ${dinnerEnabled}`,()=>{
 const chef=kitchen('preorder',{preorderSettings:{lunchEnabled,dinnerEnabled,lunchMinNoticeHours:24,dinnerMinNoticeHours:0,nextDayPreorderOpensAt:'22:00'}});
 for(const clock of [now,Date.parse('2026-11-18T17:00:00+05:30')])for(const offset of [0,1]){const date=cart.businessDate(offset,clock),options=checkout.availablePreorderMeals(chef,settings,date,clock);
  assert.deepEqual(options.map(o=>o.id),[...(lunchEnabled?['preorder-lunch']:[]),...(dinnerEnabled?['preorder-dinner']:[])]);
  if(hasReference){const result=webSlotsFactory(chef,settings,clock),web=[...result.preorderSlots.lunch,...result.preorderSlots.dinner].filter(o=>o.deliveryDate===date).map(o=>({id:o.id,startTime:o.startTime,endTime:o.endTime,expired:o.isExpired}));assert.deepEqual(options.map(o=>({id:o.id,startTime:o.startTime,endTime:o.endTime,expired:o.expired})),web,'matches actual web calculator');}
 }
});
test('missing chef settings preserve the web legacy defaults; unavailable chef data never invents choices',()=>{
 assert.equal(checkout.availablePreorderMeals(undefined,settings,'2026-11-18',now).length,0);assert.equal(checkout.availablePreorderMeals(kitchen(),undefined,'2026-11-18',now).length,0);
 const chef=kitchen('preorder',{preorderSettings:null});assert.equal(checkout.availablePreorderMeals(chef,settings,'2026-11-18',now).length,2);
 if(hasReference){const web=webSlotsFactory(chef,settings,now);assert.equal(web.preorderSlots.lunch.filter(o=>o.deliveryDate==='2026-11-18').length+web.preorderSlots.dinner.filter(o=>o.deliveryDate==='2026-11-18').length,2);}
});
test('selected chef disabled meals, expired times and dates beyond Tomorrow cannot submit',()=>{
 const chef=kitchen('preorder',{preorderSettings:{lunchEnabled:false,dinnerEnabled:true,dinnerMinNoticeHours:0}});
 assert.throws(()=>checkout.selectedPreorderMeal(chef,settings,'2026-11-18','preorder-lunch',now),/not offering/);
 assert.equal(checkout.selectedPreorderMeal(chef,settings,'2026-11-19','preorder-dinner',now).startTime,'18:30');
 assert.throws(()=>checkout.selectedPreorderMeal(chef,settings,'2026-11-20','preorder-dinner',now),/Today or Tomorrow/);
 assert.throws(()=>checkout.selectedPreorderMeal(chef,settings,'2026-11-18','preorder-dinner',Date.parse('2026-11-18T22:00:00+05:30')),/ended/);
 const options=checkout.availablePreorderMeals(chef,settings,'2026-11-18',now);assert.equal(options[0].late,false,'zero notice stays zero');
});
test('chef-specific meal settings do not carry across kitchens, and Tomorrow stays available before the opening-hour setting',()=>{
 const chefA=kitchen('preorder',{id:'a',preorderSettings:{lunchEnabled:true,dinnerEnabled:false}}),chefB=kitchen('preorder',{id:'b',preorderSettings:{lunchEnabled:false,dinnerEnabled:true,nextDayPreorderOpensAt:'22:00'}});
 assert.equal(checkout.availablePreorderMeals(chefA,settings,'2026-11-19',now)[0].id,'preorder-lunch');assert.equal(checkout.availablePreorderMeals(chefB,settings,'2026-11-19',now)[0].id,'preorder-dinner');
 assert.throws(()=>checkout.selectedPreorderMeal(chefB,settings,'2026-11-19','preorder-lunch',now),/not offering/);
});
test('refresh/reorder preserves a valid closed-chef preorder plus flexible dish and rejects a mixed-only basket',async()=>{
 const chef=kitchen('both',{isCurrentlyOpen:false}),products={pre:dish('preorder',{id:'pre'}),flex:dish('inherit',{id:'flex'}),instant:dish('instant',{id:'instant'})};
 const request=async p=>p==='/api/categories'?[category]:p.startsWith('/api/chefs/')?chef:products[p.split('/').pop()];
 const restored=await restore.restoreCartItems({chefId:chef.id,items:[{id:'pre',quantity:1},{id:'flex',quantity:1}]},request);assert.equal(restored.length,2);assert.equal(cart.cartFulfillment(restored).preorder,true);
 await assert.rejects(()=>restore.restoreCartItems({chefId:chef.id,items:[{id:'pre',quantity:1},{id:'instant',quantity:1}]},request),/separate checkouts/);
});
