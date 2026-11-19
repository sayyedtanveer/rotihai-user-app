import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Animated,AppState,Easing,KeyboardAvoidingView,Linking,Modal,Platform,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import Svg,{Circle,Defs,Path,RadialGradient,Stop} from 'react-native-svg';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {interpretCraving,matchCraving,broadeningChoices,broadenCraving,type CravingMatches,type CravingIntent} from '../../../application/user/catalog/cravingRules';
import {CravingVoiceSession,type BuddyState} from '../../../core/voice/CravingVoiceSession';
import {deviceVoice,prepareDeviceSpeech} from '../../../core/voice/deviceVoice';
import type {VoiceSupport} from '../../../core/voice/speechProfile';
import {serviceableChefs} from '../../../core/location/discoveryRules';
import {useConnectivity} from '../../../core/api/connectivity';
import {isCachedDelivery} from '../../../core/api/offlineCache';
import {useDiscovery} from '../hooks/useDiscovery';
import {useAppNavigation} from '../navigation/types';
import {useReducedMotion} from '../hooks/useReducedMotion';
import {Body,Button,Chip,Empty,ErrorView,Field,Heading,currency} from './UI';
import {DishCard,Icon} from './BrandUI';
import {theme as t} from '../theme/theme';

export function CravingBuddy({discovery:d}:{discovery:ReturnType<typeof useDiscovery>}){
 const nav=useAppNavigation(),online=useConnectivity(),reducedMotion=useReducedMotion();
 const [open,setOpen]=useState(false),[state,setState]=useState<BuddyState>('IDLE'),[text,setText]=useState(''),[message,setMessage]=useState(''),[language,setLanguage]=useState('hi-IN');
 const [results,setResults]=useState<CravingMatches|null>(null),[error,setError]=useState<string|null>(null);
 const [typing,setTyping]=useState(false),[support,setSupport]=useState<VoiceSupport|null>(null),[voiceHint,setVoiceHint]=useState('');
 const session=useRef<CravingVoiceSession|null>(null),active=useRef(false),requestId=useRef(0);
 const current=useRef({d,online});current.current={d,online};
 const search=useRef<(value:string,approvedIntent?:CravingIntent)=>void>(()=>{});
 useEffect(()=>{prepareDeviceSpeech();},[]);
 const close=React.useCallback(()=>{
  active.current=false;++requestId.current;void session.current?.cancel();session.current=null;setOpen(false);
 },[]);
 useFocusEffect(React.useCallback(()=>()=>close(),[close]));
 const areaKey=d.area?`${d.area.latitude}:${d.area.longitude}:${d.area.pincode}`:'';
 useEffect(()=>{close();},[areaKey,close]);
 // Android permission activities may report background. Delegate the audio
 // transition to the session; leaving the app pauses voice, not the sheet.
 useEffect(()=>{const listener=AppState.addEventListener('change',next=>{if(active.current)session.current?.appStateChanged(next);});return()=>{listener.remove();active.current=false;++requestId.current;void session.current?.cancel();};},[]);

 search.current=(value,approvedIntent)=>{
  const query=value.trim();if(!query||!active.current)return;
  const id=++requestId.current;
  void session.current?.cancel();setText(query);setMessage('');setError(null);setResults(null);setState('PROCESSING');
  void (async()=>{
   const {d:catalog,online:connected}=current.current;
   if(!catalog.area)throw Error('Choose your delivery location to find real nearby food.');
   if(!connected)throw Error('Connect to the internet to check current menus and availability.');
   const [chefs,products,categories]=await catalog.refresh();
   if(!active.current||id!==requestId.current)return;
   // Refetch may resolve with cached data on a network failure. Never present
   // that as current availability; the existing hook exposes cache delivery.
   const latest=current.current;
   if(chefs.error||products.error||categories.error)throw Error('Could not refresh nearby menus. Please retry.');
   const paths=[`/api/chefs/by-location?latitude=${catalog.area.latitude}&longitude=${catalog.area.longitude}&pincode=${catalog.area.pincode}`,'/api/products','/api/categories'];
   if(!latest.online||paths.some(path=>isCachedDelivery(path)))throw Error('Current menus are unavailable. Reconnect and try again.');
   if(!chefs.data||!products.data||!categories.data)throw Error('Menus are still loading. Please retry.');
   const kitchens=serviceableChefs(chefs.data,catalog.area);
   const matched=matchCraving(approvedIntent||interpretCraving(query),products.data,kitchens,categories.data);
   setResults(matched);setState('RESULTS');
  })().catch(e=>{if(active.current&&id===requestId.current){setError(e instanceof Error?e.message:'Unable to search menus. Please retry.');setState('IDLE');}});
 };
 const launch=()=>{
  if(active.current)return;
  active.current=true;setOpen(true);setText('');setError(null);setMessage('');setResults(null);setTyping(false);setVoiceHint('');setSupport(null);
  try{
   const device=deviceVoice(hint=>{if(active.current)setVoiceHint(hint);});setSupport(device.support);
   if(device.support.kind!=='ready')setTyping(true);
   session.current=new CravingVoiceSession(device.port,(next,note,transcript)=>{
    if(!active.current)return;setState(next);setMessage(note||'');if(transcript!==undefined)setText(transcript);
   },value=>search.current(value));
   void session.current.open(language);
  }catch{setState('IDLE');setTyping(true);setMessage('Voice could not start. You can type below and try the microphone again.');}
 };
 const retry=()=>{
  ++requestId.current;setResults(null);setError(null);setMessage('');
  if(session.current)void session.current.retry(language);
  else setMessage('Voice is unavailable in this build. Type your craving below.');
 };
 const edit=()=>{
  void session.current?.cancel();++requestId.current;setState('IDLE');setResults(null);setError(null);setMessage('');
 };
 const rows=results?.exact||[];
 const micReady=support?.kind==='ready',busy=state==='PROCESSING';
 const stopListening=()=>{void session.current?.cancel();if(text.trim())search.current(text);else{setState('IDLE');setMessage('Tap the mic whenever you’re ready.');}};
 const micLabel=state==='LISTENING'?'Finish speaking':state==='SPEAKING'?'Skip greeting and start microphone':'Start microphone';
 const title=state==='SPEAKING'?'क्या खाने का मन है?':state==='LISTENING'?'बोलो, मैं सुन रही हूँ…':state==='PROCESSING'?'कुछ बढ़िया ढूँढते हैं…':'Aaj kya khayenge?';
 return <>
  <Pressable accessibilityRole="button" accessibilityLabel="Open Craving Buddy. Tell us what you feel like eating." onPress={launch} style={({pressed})=>[s.entry,pressed&&{opacity:.8}]}>
   <VoiceOrb size={48} state="IDLE" active={false} spin/>
   <View style={{flex:1,gap:4}}><Text style={s.name}>Craving Buddy <Text style={{color:t.primary}}>✦</Text></Text><Text style={s.caption}>Mann ki craving, bolo na.</Text></View><View style={s.entryMic}><MicGlyph size={19}/></View>
  </Pressable>
  <Modal visible={open} transparent animationType={reducedMotion===false?'slide':'none'} onRequestClose={close}>
   <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS==='ios'?'padding':undefined}>
    <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close Craving Buddy" onPress={close}/>
    <SafeAreaView edges={['bottom']} style={s.sheet} accessibilityViewIsModal>
     <View style={s.handle}/>
     <View style={s.header}><View style={{flex:1,gap:3}}><Text style={s.eyebrow}>YOUR LITTLE FOOD COMPANION</Text><Text style={s.name}>Craving Buddy</Text></View><Pressable style={s.close} accessibilityRole="button" accessibilityLabel="Close Craving Buddy" onPress={close}><Icon name="close" size={20}/></Pressable></View>
     <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      {!results&&<>
       <View style={s.hero}>
        <VoiceOrb size={typing?116:156} state={state} active={open}/>
        <View accessibilityLiveRegion="polite" style={{gap:9,alignItems:'center'}}>
         <Text style={s.stateLabel}>{state==='SPEAKING'?'SAYING HELLO':state==='LISTENING'?'LISTENING TO YOU':busy?'FINDING YOUR FOOD':'GOOD FOOD STARTS WITH A CRAVING'}</Text>
         <Text style={s.heroTitle}>{title}</Text>
         <Text style={[s.caption,{textAlign:'center'}]}>{state==='SPEAKING'?'I’ll say hello, then it’s your turn.':state==='LISTENING'?'Hindi, English, Hinglish — just be you.':busy?'Checking real menus near your delivery location.':'Tell me what sounds good. I’ll find it nearby.'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={micLabel} accessibilityState={{disabled:!micReady||busy,busy}} disabled={!micReady||busy} onPress={()=>state==='LISTENING'?stopListening():retry()} style={({pressed})=>[s.micButton,state==='LISTENING'&&{backgroundColor:t.success},(!micReady||busy)&&{opacity:.55},pressed&&{transform:[{scale:.96}]}]}>
         {busy?<ActivityIndicator color="white"/>:state==='LISTENING'?<View style={s.stopIcon}/>:<MicGlyph size={27}/>}
        </Pressable>
        <Text style={s.micHint}>{support&&support.kind!=='ready'?'Voice needs the RotiHai app':state==='LISTENING'?'Tap when you’re done':busy?'One little moment…':'Tap to talk · no holding needed'}</Text>
       </View>
       {!!text&&!typing&&<View style={s.transcript}><Text style={s.eyebrow}>I HEARD YOU SAY</Text><Text style={s.transcriptText}>{text}</Text></View>}
       {support&&support.kind!=='ready'&&<View style={s.notice}><Text style={s.noticeTitle}>{support.kind==='expo-go'?'You’re previewing in Expo Go':'Let’s get your microphone ready'}</Text><Text style={s.caption}>{support.message}</Text></View>}
       {!!message&&message!==support?.message&&<Text accessibilityLiveRegion="polite" style={s.feedback}>{message}</Text>}
       {/denied|Settings|microphone access/i.test(message)&&support?.kind==='ready'&&<Button title="Open app settings" secondary onPress={()=>void Linking.openSettings().catch(()=>setError('Open RotiHai’s microphone and speech permissions in your phone settings.'))}/>}
       {!typing&&!busy&&<View style={s.examples}><Text style={s.eyebrow}>A LITTLE INSPIRATION</Text><View style={s.exampleRow}>{['Kuch meetha','Veg ghar ka khana','Chicken under ₹150'].map(example=><Pressable accessibilityRole="button" key={example} onPress={()=>search.current(example)} style={s.example}><Text style={s.exampleText}>{example} ↗</Text></Pressable>)}</View></View>}
       <View style={s.languageRow}>{[['hi-IN','हिंदी / Hinglish'],['en-IN','English']].map(([key,label])=><Chip key={key} title={label} selected={language===key} onPress={()=>{edit();setLanguage(key);setMessage('Tap the mic to speak in '+(key==='hi-IN'?'Hindi or Hinglish':'English')+'.');}}/>)}</View>
       {!typing?<Button title="Type instead" secondary onPress={()=>{edit();setTyping(true);}}/>:<View style={{gap:12}}><Field label="Your craving" value={text} onFocus={edit} onChangeText={value=>{edit();setText(value);}} maxLength={300} multiline placeholder="Thoda spicy, kuch meetha, ya ghar ka khana…"/><Button title="Find food" disabled={!text.trim()||busy} onPress={()=>search.current(text)}/></View>}
       {!!voiceHint&&<Text style={s.smallPrint}>{voiceHint}</Text>}
       <Text style={s.smallPrint}>Only listens while you’re here. Audio isn’t saved or sent to RotiHai; your phone’s speech service may use the internet.</Text>
      </>}
      <ErrorView error={error}/>
      {!d.area&&<Button title="Choose delivery location" secondary onPress={()=>{close();nav.navigate('DeliveryArea');}}/>}
      {results&&<>
       <View style={s.resultHeader}><VoiceOrb size={54} state="RESULTS" active={false}/><View style={{flex:1,gap:6}}><Text style={s.eyebrow}>NEARBY MENU SEARCH</Text><Heading>{rows.length?'Matching menu items':results.status==='clarify'?'A quick clarification':results.status==='unverified'?'No verified match yet':'No matching dishes'}</Heading></View></View>
       <View style={s.transcript}><Text style={s.transcriptText}>“{text}”</Text><Text style={s.caption}>{results.intent.labels.join(' · ')||'Available dishes near your delivery location'}</Text></View>
       {!!results.intent.broadened&&<Body muted>{results.intent.broadened}. These are broader menu results, not verified matches for the original craving.</Body>}
       <View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><Button title="Change craving" secondary onPress={()=>{edit();setTyping(true);}}/></View><View style={{flex:1}}><Button title="Talk again" secondary disabled={!micReady} onPress={()=>{setTyping(false);retry();}}/></View></View>
       {results.intent.warnings.map(warning=><Body key={warning} muted>{warning}</Body>)}
       {!rows.length&&<Empty title={results.status==='unverified'?'No verified dishes for this preference':results.status==='clarify'?'Please clarify your craving':'No available dishes matched'} subtitle={results.intent.clarification|| (results.status==='unverified'?'Is preference ko confirm karne ke liye chef ki verified details chahiye.':'Oops! Aapki craving ka exact match abhi nahi mila.')}/>}
       {!rows.length&&broadeningChoices(results.intent).length>0&&<View style={{gap:10}}><Body>Search broaden karein? Budget, dietary flag and delivery location will stay the same.</Body>{broadeningChoices(results.intent).map(choice=><Button key={choice.id} title={choice.label} secondary onPress={()=>{const broader=broadenCraving(results.intent,choice.id);if(broader)search.current(text,broader);}}/>)}</View>}
       {rows.map(({product,chef,price,mode})=><View key={product.id} style={{gap:8}}><Text style={s.chef}>{chef.name} · {mode==='preorder'?'Available for pre-order':'Available now'}{product.hasVariants?' · in-stock sizes from '+currency(price):''}</Text><DishCard product={product} onPress={()=>{close();nav.navigate('Product',{id:product.id});}}/></View>)}
       <Text style={s.smallPrint}>Budget is per item, before delivery and checkout fees. Menu text helps find dishes; it does not verify taste, spice, cuisine or dietary preparation. Open a dish to choose a size and add it to your existing cart. Checkout confirms stock and prices.</Text>
      </>}
     </ScrollView>
    </SafeAreaView>
   </KeyboardAvoidingView>
  </Modal>
 </>;
}

function MicGlyph({size=24}:{size?:number}){return <Svg accessible={false} width={size} height={size} viewBox="0 0 24 24"><Path d="M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z M5 11v1a7 7 0 0 0 14 0v-1 M12 19v3 M8 22h8" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>;}
function VoiceOrb({size,state,active,spin=false}:{size:number;state:BuddyState;active:boolean;spin?:boolean}){
 const pulse=useRef(new Animated.Value(0)).current,turn=useRef(new Animated.Value(0)).current,breathe=useRef(new Animated.Value(0)).current,reduced=useReducedMotion(),id=React.useId().replace(/:/g,'');
 const animated=active&&reduced===false&&['SPEAKING','LISTENING','PROCESSING'].includes(state);
 useEffect(()=>{pulse.setValue(0);if(!animated)return;const loop=Animated.loop(Animated.sequence([Animated.timing(pulse,{toValue:1,duration:state==='LISTENING'?650:1100,useNativeDriver:true,isInteraction:false}),Animated.timing(pulse,{toValue:0,duration:state==='LISTENING'?650:1100,useNativeDriver:true,isInteraction:false})]));loop.start();return()=>{loop.stop();pulse.stopAnimation();};},[animated,state,pulse]);
 // Siri-like idle orb: the coloured swirls revolve continuously while the glow breathes.
 const spinning=spin&&reduced===false,glow=spinning?breathe:pulse;
 useEffect(()=>{turn.setValue(0);breathe.setValue(0);if(!spinning)return;const revolve=Animated.loop(Animated.timing(turn,{toValue:1,duration:9000,easing:Easing.linear,useNativeDriver:true,isInteraction:false})),breathing=Animated.loop(Animated.sequence([Animated.timing(breathe,{toValue:1,duration:2200,easing:Easing.inOut(Easing.quad),useNativeDriver:true,isInteraction:false}),Animated.timing(breathe,{toValue:0,duration:2200,easing:Easing.inOut(Easing.quad),useNativeDriver:true,isInteraction:false})]));revolve.start();breathing.start();return()=>{revolve.stop();breathing.stop();turn.stopAnimation();breathe.stopAnimation();};},[spinning,turn,breathe]);
 return <View accessible={false} style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}>
  <Animated.View style={{position:'absolute',width:size*.94,height:size*.94,borderRadius:size,backgroundColor:state==='LISTENING'?'#9bdad4':'#f5cbe5',opacity:glow.interpolate({inputRange:[0,1],outputRange:spinning?[.22,.46]:[.16,.4]}),transform:[{scale:glow.interpolate({inputRange:[0,1],outputRange:spinning?[1,1.14]:[1,1.13]})}]}}/>
  <Animated.View style={{width:size*.88,height:size*.88,transform:spinning?[{scale:breathe.interpolate({inputRange:[0,1],outputRange:[1,1.06]})},{rotate:turn.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]:[{scale:pulse.interpolate({inputRange:[0,1],outputRange:[.96,1.03]})},{rotate:pulse.interpolate({inputRange:[0,1],outputRange:['-12deg','12deg']})}]}}>
   <Svg width="100%" height="100%" viewBox="0 0 120 120"><Defs><RadialGradient id={'orb'+id} cx="36%" cy="28%" r="80%"><Stop offset="0" stopColor="#ffeeb0"/><Stop offset="0.38" stopColor="#ffad63"/><Stop offset="0.72" stopColor="#ed76a7"/><Stop offset="1" stopColor="#8b75d9"/></RadialGradient><RadialGradient id={'light'+id} cx="50%" cy="45%" r="65%"><Stop offset="0" stopColor="#fff" stopOpacity=".85"/><Stop offset="1" stopColor="#fff" stopOpacity="0"/></RadialGradient></Defs><Circle cx="60" cy="60" r="55" fill={'url(#orb'+id+')'}/><Circle cx="45" cy="38" r="29" fill={'url(#light'+id+')'}/><Path d="M22 70C34 32 43 95 59 57S85 38 99 58 M24 60C40 89 49 29 65 66S85 65 98 47" fill="none" stroke="#fff" strokeWidth="3.4" strokeOpacity=".85" strokeLinecap="round"/><Circle cx="40" cy="25" r="6" fill="white" opacity=".45"/></Svg>
  </Animated.View>
 </View>;
}
const s=StyleSheet.create({
 entry:{flexDirection:'row',alignItems:'center',gap:11,padding:14,borderRadius:22,backgroundColor:'#fffaf4',borderWidth:1,borderColor:'#ead6c1'},
 entryMic:{width:39,height:39,borderRadius:20,backgroundColor:t.primary,alignItems:'center',justifyContent:'center'},
 name:{fontFamily:t.bold,fontSize:18,letterSpacing:-.45,color:t.ink},caption:{fontFamily:t.font,fontSize:12,lineHeight:19,color:t.muted},
 backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'#22182c88'},sheet:{height:'92%',maxHeight:'94%',backgroundColor:'#fffbf7',borderTopLeftRadius:32,borderTopRightRadius:32,overflow:'hidden'},
 handle:{width:38,height:4,borderRadius:3,backgroundColor:'#d6c5bb',alignSelf:'center',marginTop:10},header:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:22,paddingTop:16,paddingBottom:12},
 close:{width:44,height:44,borderRadius:22,backgroundColor:'#f4ede7',alignItems:'center',justifyContent:'center'},content:{paddingHorizontal:20,paddingTop:8,paddingBottom:26,gap:17},
 eyebrow:{fontFamily:t.semibold,fontSize:9,lineHeight:14,letterSpacing:1.1,color:t.muted},hero:{alignItems:'center',gap:12,paddingTop:4,paddingBottom:4},
 stateLabel:{fontFamily:t.bold,fontSize:9,lineHeight:14,letterSpacing:1.4,color:t.primary,textAlign:'center'},heroTitle:{fontFamily:t.bold,fontSize:26,lineHeight:36,letterSpacing:-.7,color:t.ink,textAlign:'center'},
 micButton:{width:66,height:66,borderRadius:33,backgroundColor:t.primary,alignItems:'center',justifyContent:'center',marginTop:3},stopIcon:{width:19,height:19,borderRadius:5,backgroundColor:'white'},micHint:{fontFamily:t.medium,fontSize:11,lineHeight:17,color:t.muted,textAlign:'center'},
 languageRow:{flexDirection:'row',justifyContent:'center',gap:8,flexWrap:'wrap'},notice:{borderWidth:1,borderColor:'#ead4ba',borderRadius:17,padding:14,gap:7,backgroundColor:'#fff4e5'},noticeTitle:{fontFamily:t.semibold,fontSize:13,color:t.ink},
 feedback:{fontFamily:t.medium,fontSize:12,lineHeight:19,color:t.primary,textAlign:'center'},transcript:{padding:16,borderRadius:18,backgroundColor:'#f4eee8',gap:9},transcriptText:{fontFamily:t.medium,fontSize:16,lineHeight:24,color:t.ink},
 examples:{gap:11},exampleRow:{flexDirection:'row',gap:8,flexWrap:'wrap'},example:{paddingHorizontal:13,paddingVertical:12,minHeight:44,borderRadius:16,borderWidth:1,borderColor:t.border,backgroundColor:'white'},exampleText:{fontFamily:t.medium,fontSize:12,color:t.ink},
 smallPrint:{fontFamily:t.font,fontSize:10,lineHeight:17,color:t.muted,textAlign:'center'},resultHeader:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:8},chef:{fontFamily:t.semibold,fontSize:12,lineHeight:18,color:t.muted},
});
