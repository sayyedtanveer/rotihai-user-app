import {CravingBuddy} from '../components/CravingBuddy';
import {activeBanners,bannerAction,orderedCategories} from '../../../application/user/catalog/contentRules';
import {useConnectivity} from '../../../core/api/connectivity';
import {SavedPaymentCard} from '../components/SavedPaymentCard';
import React,{useEffect,useState} from 'react';
import {Alert,Linking,ScrollView,Text,View,useWindowDimensions} from 'react-native';
import {useCart} from '../../../application/user/cart/CartProvider';
import {lineTotal} from '../../../application/user/cart/cartRules';
import {isKitchenOrderable,matchesCategory} from '../../../application/user/catalog/menuRules';
import {useApi} from '../../../core/providers/CustomerProvider';
import type {Banner,ReferralSettings} from '../../../core/api/models';
import {useAppNavigation} from '../navigation/types';
import {useDiscovery} from '../hooks/useDiscovery';
import {Page,Title,Heading,Body,Button,Chip,Field,ErrorView,Empty,Card} from '../components/UI';
import {AppHeader,HeroBanner,CategoryCarousel,DishCard,KitchenCard,LoadingSkeleton,MealPlanBanner,StickyCartBar} from '../components/BrandUI';
import {theme as t} from '../theme/theme';
export function CustomerHomeScreen(){return <DiscoveryScreen/>;}
export function ExploreScreen(){return <DiscoveryScreen explore/>;}
function DiscoveryScreen({explore=false}:{explore?:boolean}){
 const nav=useAppNavigation(),cart=useCart(),d=useDiscovery(),online=useConnectivity(),{width}=useWindowDimensions();
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[category,setCategory]=useState<string>(),[mode,setMode]=useState('all'),[openOnly,setOpenOnly]=useState(false),[vegOnly,setVegOnly]=useState(false);
 const banners=useApi<Banner[]>('/api/promotional-banners',{interval:60000});
 const referral=useApi<ReferralSettings>('/api/referral-settings');
 const savedContent=!online||banners.isCached||d.chefs.isCached||d.products.isCached;
 const categories=orderedCategories(d.categories.data);
 const promotions=activeBanners(banners.data);
 const openPromotion=(banner:Banner)=>{const action=bannerAction(banner,process.env.EXPO_PUBLIC_WEB_BASE_URL);if(action?.kind==='subscriptions')nav.navigate('Subscriptions');else if(action?.kind==='category'){setCategory(action.id);}else if(action?.kind==='url')void Linking.openURL(action.url).catch(()=>Alert.alert('Unable to open offer'));};
 useEffect(()=>{const timer=setTimeout(()=>setQuery(search.trim().toLowerCase()),250);return()=>clearTimeout(timer);},[search]);
 const dishes=d.dishes.filter(p=>(!vegOnly||p.isVeg===true)&&(!category||p.categoryId===category)&&(mode==='all'||p.effectiveMode==='both'||p.effectiveMode===mode)&&(!query||(p.name+' '+p.description+' '+p.section+' '+(d.categories.data?.find(c=>c.id===p.categoryId)?.name||'')).toLowerCase().includes(query)));
 const kitchens=d.kitchens.filter(k=>(!vegOnly||dishes.some(p=>p.chefId===k.id))&&matchesCategory(k,d.dishes,category)&&(!openOnly||isKitchenOrderable(k))&&(mode==='all'||k.fulfillmentMode==='both'||k.fulfillmentMode===mode||dishes.some(p=>p.chefId===k.id))&&(!query||(k.name+' '+k.description).toLowerCase().includes(query)||dishes.some(p=>p.chefId===k.id))).sort((a,b)=>Number(isKitchenOrderable(b))-Number(isKitchenOrderable(a))||(a.distanceFromUser??999)-(b.distanceFromUser??999));
 const featured=!explore&&!category&&categories[0]?kitchens.filter(k=>matchesCategory(k,d.dishes,categories[0].id)):[];
 const nearby=kitchens.filter(k=>!featured.some(f=>f.id===k.id));
 const selectedCategory=d.categories.data?.find(c=>c.id===category);
 const count=cart.items.reduce((n,i)=>n+i.quantity,0);
 return <View style={{flex:1,backgroundColor:t.bg}}><AppHeader area={d.area?d.area.area+' · '+d.area.pincode:'Choose delivery area'} count={count} onLocation={()=>nav.navigate('DeliveryArea')} onCart={()=>nav.navigate('Cart')} onAccount={()=>nav.navigate('Tabs',{screen:'Account'})}/><Page compact={!explore} refreshing={d.chefs.isRefetching} onRefresh={()=>{void d.refresh();void banners.refetch();void referral.refetch();}}>
 {explore&&<><Text style={{fontFamily:t.semibold,fontSize:10,color:t.primary,letterSpacing:1.5}}>EXPLORE ROTIHAI</Text><Title>A craving for{ '\n' }something homemade?</Title></>}
  {!explore&&<HeroBanner/>}
  {!explore&&promotions.length>0&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:12}}>{promotions.map(banner=><View key={banner.id} style={{width:Math.min(360,width-56)}}><MealPlanBanner compact banner={banner} disabled={!bannerAction(banner,process.env.EXPO_PUBLIC_WEB_BASE_URL)} offline={savedContent} onPress={()=>openPromotion(banner)}/></View>)}</ScrollView>}
  {cart.error&&<ErrorView error={cart.error}/>}
  {savedContent&&<Body muted>Saved catalog · prices, offers and availability need refreshing before ordering.</Body>}
  {explore&&<Field label={explore?'Find kitchens, dishes or food types':'Find your next favourite'} placeholder="Search roti, thali, biryani…" value={search} onChangeText={setSearch}/>}
  {!d.area&&<Card><Heading>Where should we deliver?</Heading><Body muted>Choose your area to see local kitchens and their menus.</Body><Button title="Choose delivery location" onPress={()=>nav.navigate('DeliveryArea')}/></Card>}
 <View style={{gap:13}}><Heading>What feels like home?</Heading><CategoryCarousel categories={categories} selected={category} onSelect={setCategory}/></View>
 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{[['all','All meals'],['instant','Instant'],['preorder','Pre-order']].map(([key,label])=><Chip key={key} title={label} selected={mode===key} onPress={()=>setMode(key)}/>)}<Chip title="Vegetarian" selected={vegOnly} onPress={()=>setVegOnly(!vegOnly)}/><Chip title="Accepting orders" selected={openOnly} onPress={()=>setOpenOnly(!openOnly)}/></ScrollView>
 {!explore&&featured.length>0&&!d.loading&&!d.error&&<View style={{gap:12}}><Heading>Featured chefs</Heading><ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={Math.min(300,width-72)+14} decelerationRate="fast" contentContainerStyle={{gap:14,paddingBottom:12}}>{featured.map(k=><View key={k.id} style={{width:Math.min(300,width-72)}}><KitchenCard variant="featured" chef={k} count={d.dishes.filter(p=>p.chefId===k.id).length} categoryName={d.categories.data?.find(c=>c.id===k.categoryId)?.name} onPress={()=>nav.navigate('Catalog',{chefId:k.id,title:k.name,categoryId:category,vegetarian:vegOnly})}/></View>)}</ScrollView></View>}
 {!explore&&referral.data&&Number(referral.data.referrerBonus)>0&&<MealPlanBanner compact referral={referral.data} offline={!online||referral.isCached} onPress={()=>nav.navigate('Referrals')}/>}
 <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><View style={{gap:4}}><Heading>{selectedCategory?selectedCategory.name+' kitchens':'Nearby kitchens'}</Heading><Body muted>{openOnly?'Ready for your next meal':'More homemade favourites in your delivery area.'}</Body></View></View>
 {!d.loading&&!d.error&&kitchens.length>0&&nearby.length===0&&<Body muted>All nearby kitchens are featured above.</Body>}
 {!d.loading&&!d.error&&<Text style={{fontFamily:t.medium,color:t.muted,fontSize:11}}>{nearby.length} nearby kitchens{d.area?' · '+d.area.area:''}</Text>}
 {!d.area?null:d.loading?<LoadingSkeleton/>:d.error?<ErrorView error={d.error} retry={()=>void d.refresh()}/>:kitchens.length?nearby.map(k=><KitchenCard key={k.id} chef={k} count={d.dishes.filter(p=>p.chefId===k.id).length} categoryName={d.categories.data?.find(c=>c.id===k.categoryId)?.name} onPress={()=>nav.navigate('Catalog',{chefId:k.id,title:k.name,categoryId:category,vegetarian:vegOnly})}/>):<><Empty title={query?'No matches for this search':'No kitchens are delivering to this area yet.'} subtitle={query?'Try a dish, kitchen name or another category.':'Change your delivery area or retry for the latest availability.'}/><Button title="Change location" onPress={()=>nav.navigate('DeliveryArea')}/><Button title="Retry" secondary onPress={()=>void d.refresh()}/></>}
 {!d.loading&&!d.error&&explore&&query&&dishes.length>0&&<><Heading>Matching dishes</Heading>{dishes.slice(0,20).map(p=><DishCard key={p.id} product={p} onPress={()=>nav.navigate('Product',{id:p.id})}/>)}</>}
 {!explore&&banners.error&&!banners.data&&<ErrorView error={banners.error} retry={()=>void banners.refetch()}/>}
 </Page>{explore&&count>0&&<StickyCartBar count={count} total={cart.items.reduce((n,i)=>n+lineTotal(i),0)} onPress={()=>nav.navigate('Cart')}/>}{!explore&&<SavedPaymentCard/>}{!explore&&<View style={{paddingHorizontal:16,paddingBottom:4}}><CravingBuddy discovery={d}/></View>}</View>;
}
