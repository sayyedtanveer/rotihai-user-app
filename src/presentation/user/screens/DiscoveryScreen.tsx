import {activeBanners,bannerAction,groupPlans} from '../../../application/user/catalog/contentRules';
import {useConnectivity} from '../../../core/api/connectivity';
import {SavedPaymentCard} from '../components/SavedPaymentCard';
import React,{useEffect,useState} from 'react';
import {Alert,Linking,ScrollView,Text,View,useWindowDimensions} from 'react-native';
import {useCart} from '../../../application/user/cart/CartProvider';
import {lineTotal} from '../../../application/user/cart/cartRules';
import {cartItemFromProduct,isKitchenOrderable,matchesCategory} from '../../../application/user/catalog/menuRules';
import {useApi} from '../../../core/providers/CustomerProvider';
import type {Banner,Plan,Product} from '../../../core/api/models';
import {useAppNavigation} from '../navigation/types';
import {useDiscovery} from '../hooks/useDiscovery';
import {Page,Title,Heading,Body,Button,Chip,Field,ErrorView,Empty,Card,Photo} from '../components/UI';
import {AppHeader,CategoryCarousel,DishCard,KitchenCard,LoadingSkeleton,MealPlanBanner,StickyCartBar} from '../components/BrandUI';
import {theme as t} from '../theme/theme';
export function CustomerHomeScreen(){return <DiscoveryScreen/>;}
export function ExploreScreen(){return <DiscoveryScreen explore/>;}
function DiscoveryScreen({explore=false}:{explore?:boolean}){
 const nav=useAppNavigation(),cart=useCart(),d=useDiscovery(),online=useConnectivity(),{width}=useWindowDimensions();
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[category,setCategory]=useState<string>(),[mode,setMode]=useState('all'),[openOnly,setOpenOnly]=useState(false);
 const banners=useApi<Banner[]>('/api/promotional-banners',{interval:60000}),plans=useApi<Plan[]>('/api/subscription-plans',{interval:60000});
 const [showAll,setShowAll]=useState(false),[addError,setAddError]=useState<string|null>(null);
 function add(p:Product){if(p.hasVariants){nav.navigate('Product',{id:p.id});return;}try{const chef=d.kitchens.find(c=>c.id===p.chefId);if(!isKitchenOrderable(chef)||!p.isAvailable)throw new Error('This dish is not available to order.');cart.add(cartItemFromProduct(p,chef,d.categories.data?.find(c=>c.id===p.categoryId)));setAddError(null);}catch(e){setAddError((e as Error).message);}}
 const savedContent=!online||banners.isCached||plans.isCached||d.chefs.isCached||d.products.isCached;
 const promotions=activeBanners(banners.data),featuredPlan=groupPlans(plans.data,d.categories.data)[0]?.plans[0];
 const openPromotion=(banner:Banner)=>{const action=bannerAction(banner,process.env.EXPO_PUBLIC_WEB_BASE_URL);if(action?.kind==='subscriptions')nav.navigate('Subscriptions');else if(action?.kind==='category'){setCategory(action.id);setShowAll(true);}else if(action?.kind==='url')void Linking.openURL(action.url).catch(()=>Alert.alert('Unable to open offer'));};
 useEffect(()=>{const timer=setTimeout(()=>setQuery(search.trim().toLowerCase()),250);return()=>clearTimeout(timer);},[search]);
 const dishes=d.dishes.filter(p=>(!category||p.categoryId===category)&&(mode==='all'||p.effectiveMode==='both'||p.effectiveMode===mode)&&(!query||(p.name+' '+p.description+' '+p.section+' '+(d.categories.data?.find(c=>c.id===p.categoryId)?.name||'')).toLowerCase().includes(query)));
 const kitchens=d.kitchens.filter(k=>matchesCategory(k,d.dishes,category)&&(!openOnly||isKitchenOrderable(k))&&(mode==='all'||k.fulfillmentMode==='both'||k.fulfillmentMode===mode||dishes.some(p=>p.chefId===k.id))&&(!query||(k.name+' '+k.description).toLowerCase().includes(query)||dishes.some(p=>p.chefId===k.id))).sort((a,b)=>Number(isKitchenOrderable(b))-Number(isKitchenOrderable(a))||(a.distanceFromUser??999)-(b.distanceFromUser??999));
 const selectedCategory=d.categories.data?.find(c=>c.id===category);
 const count=cart.items.reduce((n,i)=>n+i.quantity,0);
 return <View style={{flex:1,backgroundColor:t.bg}}><AppHeader area={d.area?d.area.area+' · '+d.area.pincode:'Choose delivery area'} count={count} onLocation={()=>nav.navigate('DeliveryArea')} onCart={()=>nav.navigate('Cart')} onAccount={()=>nav.navigate('Tabs',{screen:'Account'})}/><Page refreshing={d.chefs.isRefetching} onRefresh={()=>{void d.refresh();void banners.refetch();void plans.refetch();}}>
 {explore&&<><Text style={{fontFamily:t.semibold,fontSize:10,color:t.primary,letterSpacing:1.5}}>EXPLORE ROTIHAI</Text><Title>A craving for{ '\n' }something homemade?</Title></>}
  {!explore&&featuredPlan&&<MealPlanBanner plan={featuredPlan} offline={savedContent} onPress={()=>nav.navigate('Subscribe',{planId:featuredPlan.id})}/>}
  {!explore&&promotions.length>0&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:12}}>{promotions.map(banner=><View key={banner.id} style={{width:width-40}}><MealPlanBanner banner={banner} disabled={!bannerAction(banner,process.env.EXPO_PUBLIC_WEB_BASE_URL)} offline={savedContent} onPress={()=>openPromotion(banner)}/></View>)}</ScrollView>}
  {!explore&&banners.error&&!banners.data&&<ErrorView error={banners.error} retry={()=>void banners.refetch()}/>}
  {cart.error&&<ErrorView error={cart.error}/>}
  {savedContent&&<Body muted>Saved catalog · prices, offers and availability need refreshing before ordering.</Body>}
  {explore&&<Field label={explore?'Find kitchens, dishes or food types':'Find your next favourite'} placeholder="Search roti, thali, biryani…" value={search} onChangeText={setSearch}/>}
  {!d.area&&<Card><Heading>Where should we deliver?</Heading><Body muted>Choose your area to see local kitchens and their menus.</Body><Button title="Choose delivery location" onPress={()=>nav.navigate('DeliveryArea')}/></Card>}
 <View style={{gap:13}}><Heading>What feels like home?</Heading><CategoryCarousel categories={(d.categories.data||[]).filter(c=>c.name!=='Custom Subscriptions')} selected={category} onSelect={setCategory}/></View>
 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{[['all','All meals'],['instant','Instant'],['preorder','Pre-order']].map(([key,label])=><Chip key={key} title={label} selected={mode===key} onPress={()=>setMode(key)}/>)}<Chip title="Accepting orders" selected={openOnly} onPress={()=>setOpenOnly(!openOnly)}/></ScrollView>
 <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><View style={{gap:4}}><Heading>{selectedCategory?selectedCategory.name+' kitchens':'Kitchens near you'}</Heading><Body muted>{openOnly?'Ready for your next meal':'Browse every local kitchen, including those currently closed.'}</Body></View></View>
 {!d.loading&&!d.error&&<Text style={{fontFamily:t.medium,color:t.muted,fontSize:11}}>{kitchens.length} kitchens · {d.area?.area}</Text>}
 {!d.area?null:d.loading?<LoadingSkeleton/>:d.error?<ErrorView error={d.error} retry={()=>void d.refresh()}/>:kitchens.length?(showAll||category?kitchens:kitchens.slice(0,3)).map(k=><KitchenCard key={k.id} chef={k} count={d.dishes.filter(p=>p.chefId===k.id).length} categoryName={d.categories.data?.find(c=>c.id===k.categoryId)?.name} onPress={()=>nav.navigate('Catalog',{chefId:k.id,title:k.name,categoryId:category})}/>):<><Empty title={query?'No matches for this search':'No kitchens are delivering to this area yet.'} subtitle={query?'Try a dish, kitchen name or another category.':'Change your delivery area or retry for the latest availability.'}/><Button title="Change location" onPress={()=>nav.navigate('DeliveryArea')}/><Button title="Retry" secondary onPress={()=>void d.refresh()}/></>}
 {!d.loading&&!d.error&&explore&&query&&dishes.length>0&&<><Heading>Matching dishes</Heading>{dishes.slice(0,20).map(p=><DishCard key={p.id} product={p} onPress={()=>nav.navigate('Product',{id:p.id})}/>)}</>}
 {!showAll&&!category&&kitchens.length>3&&<Button title={'View all '+kitchens.length+' kitchens'} secondary onPress={()=>setShowAll(true)}/>}
 {!explore&&!d.loading&&!d.error&&dishes.some(p=>p.isAvailable&&isKitchenOrderable(d.kitchens.find(c=>c.id===p.chefId)))&&<><Heading>From nearby kitchens</Heading><ErrorView error={addError}/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:12}}>{dishes.filter(p=>p.isAvailable&&isKitchenOrderable(d.kitchens.find(c=>c.id===p.chefId))).slice(0,6).map(p=>{const selected=cart.items.find(item=>item.id===p.id&&!item.variantId);return <View key={p.id} style={{width:Math.min(300,width-64),borderRadius:18,borderWidth:1,borderColor:t.border,overflow:'hidden',backgroundColor:t.surface}}><Text style={{paddingHorizontal:17,paddingTop:13,fontFamily:t.semibold,fontSize:10,color:t.primary}}>{d.kitchens.find(c=>c.id===p.chefId)?.name}</Text><DishCard product={p} quantity={selected?.quantity} onPress={()=>nav.navigate('Product',{id:p.id})} onAdd={()=>add(p)} onMinus={selected?()=>{try{cart.quantity(selected.key,selected.quantity-1);}catch(e){setAddError((e as Error).message);}}:undefined}/></View>;})}</ScrollView></>}
 {!explore&&plans.error&&!plans.data&&<ErrorView error={plans.error} retry={()=>void plans.refetch()}/>}
 </Page>{count>0&&<StickyCartBar count={count} total={cart.items.reduce((n,i)=>n+lineTotal(i),0)} onPress={()=>nav.navigate('Cart')}/>}{!explore&&<SavedPaymentCard/>}</View>;
}
