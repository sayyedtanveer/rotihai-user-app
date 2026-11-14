import React,{useEffect,useState} from 'react';
import {Alert,Linking,ScrollView,Text,View} from 'react-native';
import {useCart} from '../../../application/user/cart/CartProvider';
import {lineTotal} from '../../../application/user/cart/cartRules';
import {isKitchenOrderable,matchesCategory} from '../../../application/user/catalog/menuRules';
import {useApi} from '../../../core/providers/CustomerProvider';
import type {Banner} from '../../../core/api/models';
import {useAppNavigation} from '../navigation/types';
import {useDiscovery} from '../hooks/useDiscovery';
import {Page,Title,Heading,Body,Button,Chip,Field,ErrorView,Empty,Card,Photo} from '../components/UI';
import {AppHeader,CategoryCarousel,DishCard,HeroBanner,KitchenCard,LoadingSkeleton,MealPlanBanner,StickyCartBar} from '../components/BrandUI';
import {theme as t} from '../theme/theme';
export function CustomerHomeScreen(){return <DiscoveryScreen/>;}
export function ExploreScreen(){return <DiscoveryScreen explore/>;}
function DiscoveryScreen({explore=false}:{explore?:boolean}){
 const nav=useAppNavigation(),cart=useCart(),d=useDiscovery();
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[category,setCategory]=useState<string>(),[mode,setMode]=useState('all'),[openOnly,setOpenOnly]=useState(false);
 const banners=useApi<Banner[]>('/api/promotional-banners');
 useEffect(()=>{const timer=setTimeout(()=>setQuery(search.trim().toLowerCase()),250);return()=>clearTimeout(timer);},[search]);
 const dishes=d.dishes.filter(p=>(!category||p.categoryId===category)&&(mode==='all'||p.effectiveMode==='both'||p.effectiveMode===mode)&&(!query||(p.name+' '+p.description+' '+p.section+' '+(d.categories.data?.find(c=>c.id===p.categoryId)?.name||'')).toLowerCase().includes(query)));
 const kitchens=d.kitchens.filter(k=>matchesCategory(k,d.dishes,category)&&(!openOnly||isKitchenOrderable(k))&&(mode==='all'||k.fulfillmentMode==='both'||k.fulfillmentMode===mode||dishes.some(p=>p.chefId===k.id))&&(!query||(k.name+' '+k.description).toLowerCase().includes(query)||dishes.some(p=>p.chefId===k.id))).sort((a,b)=>Number(isKitchenOrderable(b))-Number(isKitchenOrderable(a))||(a.distanceFromUser??999)-(b.distanceFromUser??999));
 const selectedCategory=d.categories.data?.find(c=>c.id===category);
 const count=cart.items.reduce((n,i)=>n+i.quantity,0);
 return <View style={{flex:1,backgroundColor:t.bg}}><AppHeader area={d.area?d.area.area+' · '+d.area.pincode:'Choose delivery area'} count={count} onLocation={()=>nav.navigate('DeliveryArea')} onCart={()=>nav.navigate('Cart')} onAccount={()=>nav.navigate('Tabs',{screen:'Account'})}/><Page refreshing={d.chefs.isRefetching} onRefresh={()=>void d.refresh()}>
 {explore?<><Text style={{fontFamily:t.semibold,fontSize:10,color:t.primary,letterSpacing:1.5}}>EXPLORE ROTIHAI</Text><Title>A craving for{ '\n' }something homemade?</Title></>:<HeroBanner/>}
 <Field label={explore?'Find kitchens, dishes or food types':'Find your next favourite'} placeholder="Search roti, thali, biryani…" value={search} onChangeText={setSearch}/>
 {!explore&&<MealPlanBanner onPress={()=>nav.navigate('Subscriptions')}/>}
 <View style={{gap:13}}><Heading>What feels like home?</Heading><CategoryCarousel categories={(d.categories.data||[]).filter(c=>c.name!=='Custom Subscriptions')} selected={category} onSelect={setCategory}/></View>
 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{[['all','All meals'],['instant','Instant'],['preorder','Pre-order']].map(([key,label])=><Chip key={key} title={label} selected={mode===key} onPress={()=>setMode(key)}/>)}<Chip title="Accepting orders" selected={openOnly} onPress={()=>setOpenOnly(!openOnly)}/></ScrollView>
 <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><View style={{gap:4}}><Heading>{selectedCategory?selectedCategory.name+' kitchens':'Kitchens near you'}</Heading><Body muted>{openOnly?'Ready for your next meal':'Browse every local kitchen, including those currently closed.'}</Body></View></View>
 {!d.loading&&!d.error&&<Text style={{fontFamily:t.medium,color:t.muted,fontSize:11}}>{kitchens.length} kitchens · {d.area?.area}</Text>}
 {d.loading?<LoadingSkeleton/>:d.error?<ErrorView error={d.error} retry={()=>void d.refresh()}/>:kitchens.length?kitchens.map(k=><KitchenCard key={k.id} chef={k} count={d.dishes.filter(p=>p.chefId===k.id).length} categoryName={d.categories.data?.find(c=>c.id===k.categoryId)?.name} onPress={()=>nav.navigate('Catalog',{chefId:k.id,title:k.name,categoryId:category})}/>):<><Empty title={query?'No matches for this search':'No kitchens are delivering to this area yet.'} subtitle={query?'Try a dish, kitchen name or another category.':'Change your delivery area or retry for the latest availability.'}/><Button title="Change location" onPress={()=>nav.navigate('DeliveryArea')}/><Button title="Retry" secondary onPress={()=>void d.refresh()}/></>}
 {!d.loading&&!d.error&&explore&&query&&dishes.length>0&&<><Heading>Matching dishes</Heading>{dishes.slice(0,20).map(p=><DishCard key={p.id} product={p} onPress={()=>nav.navigate('Product',{id:p.id})}/>)}</>}
 {!explore&&<>{(banners.data||[]).filter(b=>b.isActive!==false).map(b=><Card key={b.id}><Photo uri={b.imageUrl||b.image}/><Heading>{b.title}</Heading>{b.description&&<Body>{b.description}</Body>}{b.linkUrl?.startsWith('https://')&&<Button secondary title="View offer" onPress={()=>void Linking.openURL(b.linkUrl!).catch(()=>Alert.alert('Unable to open offer'))}/>}</Card>)}<MealPlanBanner subscription onPress={()=>nav.navigate('Subscriptions')}/></>}
 </Page>{count>0&&<StickyCartBar count={count} total={cart.items.reduce((n,i)=>n+lineTotal(i),0)} onPress={()=>nav.navigate('Cart')}/>}</View>;
}
