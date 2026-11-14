import {useReducedMotion} from '../hooks/useReducedMotion';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Alert,Modal,Pressable,ScrollView,SectionList,StyleSheet,Text,View,AccessibilityInfo} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useApi,useCustomer} from '../../../core/providers/CustomerProvider';
import type {Chef,Category,Product,ProductOffer,Variant,CartItem} from '../../../core/api/models';
import {useCart} from '../../../application/user/cart/CartProvider';
import {lineTotal} from '../../../application/user/cart/cartRules';
import {cartItemFromProduct,groupMenu,isKitchenOrderable} from '../../../application/user/catalog/menuRules';
import {useAppNavigation,type Routes} from '../navigation/types';
import {useDiscovery} from '../hooks/useDiscovery';
import {Page,Title,Heading,Body,Button,Field,Chip,Photo,Loading,ErrorView,Empty,currency,QuantityControl} from '../components/UI';
import {DishCard,Icon,LoadingSkeleton,StatusPill,StickyCartBar} from '../components/BrandUI';
import {theme as t} from '../theme/theme';
export {CustomerHomeScreen} from './DiscoveryScreen';
export function CatalogScreen({route}:NativeStackScreenProps<Routes,'Catalog'>){
 const nav=useAppNavigation(),d=useDiscovery(),cart=useCart(),{request}=useCustomer();
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[veg,setVeg]=useState(false),[category,setCategory]=useState<string|undefined>(route.params.categoryId),[collapsed,setCollapsed]=useState<Record<string,boolean>>({}),[menu,setMenu]=useState(false),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState<string|null>(null),[focusedSection,setFocusedSection]=useState<string|null>(null);
 const list=useRef<SectionList<Product>>(null),pendingJump=useRef<number|null>(null),reducedMotion=useReducedMotion();
 const chef=d.kitchens.find(c=>c.id===route.params.chefId);
 useEffect(()=>{const timer=setTimeout(()=>setQuery(search.trim().toLowerCase()),220);return()=>clearTimeout(timer);},[search]);
 const kitchenProducts=d.dishes.filter(p=>!route.params.chefId||p.chefId===route.params.chefId);
 const categories=(d.categories.data||[]).filter(c=>kitchenProducts.some(p=>p.categoryId===c.id)||chef?.categoryId===c.id||chef?.categoryIds?.includes(c.id));
 const filtered=useMemo(()=>kitchenProducts.filter(p=>(!category||p.categoryId===category)&&(!veg||p.isVeg)&&(!query||(p.name+' '+p.description+' '+p.section).toLowerCase().includes(query))),[d.dishes,route.params.chefId,category,veg,query]);
 const groups=groupMenu(filtered,d.categories.data,!category&&categories.length>1);
 const sections=(focusedSection&&!query?groups.filter(g=>g.key===focusedSection):groups).map((g,index)=>({...g,data:query||collapsed[g.key]===false||(!index&&collapsed[g.key]!==true)?g.data:[]}));
 function jump(index:number){const group=groups[index];setFocusedSection(group.key);setCollapsed(previous=>({...previous,[group.key]:false}));setMenu(false);pendingJump.current=0;}
 useEffect(()=>{if(pendingJump.current===null)return;const index=pendingJump.current;pendingJump.current=null;requestAnimationFrame(()=>list.current?.scrollToLocation({sectionIndex:index,itemIndex:0,viewOffset:8,animated:reducedMotion===false}));},[collapsed]);
 async function add(p:Product){
  if(p.hasVariants){nav.navigate('Product',{id:p.id});return;}
  if(busy)return;setBusy(p.id);setError(null);
  try{const c=d.kitchens.find(c=>c.id===p.chefId);if(!isKitchenOrderable(c))throw new Error('This kitchen is not accepting orders right now.');
   // Match web Add: local basket update; fresh validation remains at checkout.
   if(!p.isAvailable||p.stockQuantity<1)throw new Error('This dish is currently unavailable.');
   cart.add(cartItemFromProduct(p,c,d.categories.data?.find(v=>v.id===p.categoryId)));
  }catch(e){setError((e as Error).message);}finally{setBusy(null);}
 }
 const header=<View style={{gap:17,padding:20}}>
  {chef&&<><View style={{flexDirection:'row',gap:14,alignItems:'center'}}><View style={{flex:1,gap:8}}><Text style={{fontFamily:t.semibold,color:t.primary,fontSize:9,letterSpacing:1.4}}>THE KITCHEN MENU</Text><Text accessibilityRole="header" style={{fontFamily:t.display,color:t.ink,fontSize:24,lineHeight:30,letterSpacing:-.6}}>{chef.name}</Text><StatusPill chef={chef}/></View>{chef.image&&<View style={{width:72}}><Photo uri={chef.image} height={72} label={chef.name}/></View>}</View><View style={{gap:9}}><Text style={{fontFamily:t.font,color:t.muted,fontSize:12,lineHeight:19}} numberOfLines={2}>{chef.description}</Text>{!isKitchenOrderable(chef)&&<View style={c.notice}><Body muted>This kitchen is not accepting orders right now. You can still explore the menu.</Body></View>}</View></>}
  {!chef&&<Title>{route.params.title||'Explore the menu'}</Title>}
  {(d.chefs.isCached||d.products.isCached)&&<Body muted>Saved menu · refresh prices and availability before ordering.</Body>}
  <Field label="Search this menu" value={search} onChangeText={setSearch} placeholder="Search dishes or food types…"/>
  {categories.length>1&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}><Chip title="All categories" selected={!category} onPress={()=>{setCategory(undefined);setFocusedSection(null);setCollapsed({});}}/>{categories.map(c=><Chip key={c.id} title={c.name} selected={category===c.id} onPress={()=>{setCategory(c.id);setFocusedSection(null);setCollapsed({});}}/>)}</ScrollView>}
  <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Chip title="Vegetarian" selected={veg} onPress={()=>setVeg(!veg)}/><Text style={{fontFamily:t.medium,color:t.muted,fontSize:12}}>{filtered.length} dishes · {groups.length} sections</Text></View>
  {groups.length>1&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{focusedSection&&<Chip title="All sections" onPress={()=>setFocusedSection(null)}/>}{groups.map((g,i)=><Chip key={g.key} selected={focusedSection===g.key} title={g.title+' ('+g.data.length+')'} onPress={()=>jump(i)}/>)}</ScrollView>}
  <ErrorView error={error||cart.error||d.error} retry={()=>void d.refresh()}/>
  {d.loading&&<LoadingSkeleton/>}
 </View>;
 const count=cart.items.reduce((n,i)=>n+i.quantity,0);
 return <View style={{flex:1,backgroundColor:t.bg}}><SectionList ref={list} sections={sections} keyExtractor={p=>p.id} refreshing={d.chefs.isRefetching} onRefresh={()=>void d.refresh()} keyboardShouldPersistTaps="handled" stickySectionHeadersEnabled ListHeaderComponent={header} contentContainerStyle={{paddingBottom:28}} onScrollToIndexFailed={()=>{list.current?.recordInteraction();}} ListEmptyComponent={!d.loading&&!d.error?<View style={{padding:20}}><Empty title="No dishes found" subtitle={chef?'Try another section or search.':'Choose a kitchen available for your delivery area.'}/></View>:undefined} renderSectionHeader={({section})=><Pressable accessibilityRole="button" accessibilityState={{expanded:section.data.length>0}} onPress={()=>setCollapsed(prev=>({...prev,[section.key]:section.data.length>0}))} style={c.section}><View style={{flex:1,gap:3}}><Text style={c.sectionTitle}>{section.title}</Text><Text style={c.sectionCount}>{groups.find(g=>g.key===section.key)?.data.length||0} dishes</Text></View><Icon name={section.data.length?'down':'chevron'} size={17}/></Pressable>} renderItem={({item:p})=>{const existing=cart.items.find(i=>i.id===p.id&&!i.variantId);const kitchen=d.kitchens.find(k=>k.id===p.chefId);return <DishCard product={p} quantity={existing?.quantity||0} disabled={!isKitchenOrderable(kitchen)||busy===p.id} onPress={()=>nav.navigate('Product',{id:p.id})} onAdd={()=>void add(p)} onMinus={existing?()=>{try{cart.quantity(existing.key,existing.quantity-1);}catch(e){setError((e as Error).message);}}:undefined}/>;}}/>
 <View style={{paddingHorizontal:20,paddingVertical:10,alignItems:'flex-end',backgroundColor:t.bg}}><Pressable accessibilityRole="button" accessibilityLabel="Browse menu sections" onPress={()=>setMenu(true)} style={c.menuButton}><Icon name="menu" color="white" size={17}/><Text style={{fontFamily:t.bold,fontSize:12,color:'white'}}>Browse menu</Text></Pressable></View>
 {count>0&&<StickyCartBar count={count} total={cart.items.reduce((n,i)=>n+lineTotal(i),0)} onPress={()=>nav.navigate('Cart')}/>}
 <Modal visible={menu} transparent animationType={reducedMotion===false?'fade':'none'} onRequestClose={()=>setMenu(false)}><View style={c.modal}><Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close menu sections" onPress={()=>setMenu(false)}/><SafeAreaView edges={['bottom']} style={c.sheet}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:20}}><Heading>What's on the menu?</Heading><Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={()=>setMenu(false)} style={{padding:10}}><Icon name="close"/></Pressable></View><ScrollView>{groups.map((g,i)=><Pressable key={g.key} accessibilityRole="button" onPress={()=>jump(i)} style={c.sheetRow}><Text style={{fontFamily:t.semibold,color:t.ink,fontSize:14,flex:1}}>{g.title}</Text><Text style={{fontFamily:t.font,color:t.muted,fontSize:12}}>{g.data.length}</Text><Icon name="chevron" size={16}/></Pressable>)}</ScrollView></SafeAreaView></View></Modal></View>;
}
export function ProductScreen({route}:NativeStackScreenProps<Routes,'Product'>){
 const nav=useAppNavigation(),cart=useCart(),d=useDiscovery();
 const product=useApi<Product>('/api/products/'+encodeURIComponent(route.params.id),{interval:30000}),p=product.data;
 const chef=useApi<Chef>('/api/chefs/'+encodeURIComponent(p?.chefId||''),{enabled:!!p?.chefId});
 const categories=useApi<Category[]>('/api/categories');
 const [variantId,setVariant]=useState(''),[quantity,setQuantity]=useState(1),[instructions,setInstructions]=useState(''),[error,setError]=useState<string|null>(null);
 const variant:Variant|undefined=p?.variants?.find(v=>v.id===variantId);
 if(product.isPending)return <Loading/>;if(!p)return <Page><ErrorView error={product.error} retry={()=>void product.refetch()}/></Page>;
 const mode=p.effectiveMode||(p.fulfillmentMode!=='inherit'?p.fulfillmentMode:chef.data?.fulfillmentMode)||'both';
 const selected=cartItemFromProduct(p,chef.data,categories.data?.find(c=>c.id===p.categoryId),{variant,quantity,instructions,offer:p.offer});
 const available=d.kitchens.some(c=>c.id===p.chefId)&&chef.data?.isActive!==false&&p.isAvailable&&isKitchenOrderable(chef.data)&&(!p.hasVariants||(variant?.isAvailable&&variant?.isActive))&&selected.stockQuantity>=quantity;
 return <View style={{flex:1,backgroundColor:t.bg}}><Page><Photo uri={p.image} height={240} label={p.name}/><View style={{gap:9}}><Text style={{fontFamily:t.semibold,color:p.isVeg?t.success:t.danger,fontSize:10,letterSpacing:1}}>{p.isVeg?'VEGETARIAN':'NON-VEGETARIAN'}</Text><Title>{p.name}</Title><Body muted>{chef.data?.name}{p.section?' · '+p.section:''}</Body><Body>{p.description}</Body>{chef.data&&<StatusPill chef={chef.data}/>}</View>
 {p.hasVariants&&<View style={{gap:12,paddingVertical:10}}><Heading>Make it your size</Heading>{(p.variants||[]).filter(v=>v.isActive).map(v=><Pressable key={v.id} accessibilityRole="radio" accessibilityState={{checked:variantId===v.id,disabled:!v.isAvailable}} disabled={!v.isAvailable} onPress={()=>{setVariant(v.id);setQuantity(1);}} style={[c.variant,variantId===v.id&&{borderColor:t.primary,backgroundColor:t.pale}]}><View style={{flex:1,gap:4}}><Text style={{fontFamily:t.semibold,color:t.ink,fontSize:14}}>{v.displayName||v.name}</Text>{!v.isAvailable&&<Body muted>Currently unavailable</Body>}</View><Text style={{fontFamily:t.semibold,color:t.ink,fontSize:13}}>{currency(v.price)}</Text><View style={{width:18,height:18,borderRadius:9,borderWidth:1.5,borderColor:variantId===v.id?t.primary:t.border,backgroundColor:variantId===v.id?t.primary:'white'}}/></Pressable>)}</View>}
 {product.isCached&&<Body muted>Saved product information · current price and stock are checked at checkout.</Body>}
 <Field label="Cooking instructions (optional)" placeholder="Anything the kitchen should know?" value={instructions} onChangeText={setInstructions} multiline maxLength={300}/><ErrorView error={error||chef.error}/>
 </Page><SafeAreaView edges={['bottom']} style={c.productBottom}><QuantityControl minimum={1} label={p.name} quantity={quantity} onMinus={()=>setQuantity(Math.max(1,quantity-1))} onPlus={()=>setQuantity(quantity+1)} disabled={quantity>=selected.stockQuantity}/><View style={{flex:1}}><Button title={available?'Add · '+currency(lineTotal(selected)):'Currently unavailable'} disabled={!available||!cart.ready||!selected.categoryName} onPress={()=>{try{cart.add(selected);nav.goBack();}catch(e){setError((e as Error).message);}}}/></View></SafeAreaView></View>;
}
const c=StyleSheet.create({section:{paddingHorizontal:20,paddingVertical:14,backgroundColor:'#f6f1eb',borderTopWidth:1,borderBottomWidth:1,borderColor:t.border,flexDirection:'row',alignItems:'center',gap:12},sectionTitle:{fontFamily:t.bold,color:t.ink,fontSize:17,lineHeight:23},sectionCount:{fontFamily:t.font,color:t.muted,fontSize:10},notice:{padding:13,backgroundColor:'#f3eee7',borderRadius:12},menuButton:{flexDirection:'row',alignItems:'center',gap:9,backgroundColor:t.ink,borderRadius:30,paddingHorizontal:17,paddingVertical:13},modal:{flex:1,justifyContent:'flex-end',backgroundColor:'#00000066'},sheet:{backgroundColor:'white',borderTopLeftRadius:25,borderTopRightRadius:25,maxHeight:'70%'},sheetRow:{paddingHorizontal:22,paddingVertical:18,borderTopWidth:1,borderColor:t.border,flexDirection:'row',alignItems:'center',gap:12},variant:{padding:17,borderRadius:14,borderWidth:1,borderColor:t.border,backgroundColor:'white',flexDirection:'row',alignItems:'center',gap:12},productBottom:{backgroundColor:'white',padding:16,borderTopWidth:1,borderColor:t.border,flexDirection:'row',gap:14,alignItems:'center'}});
