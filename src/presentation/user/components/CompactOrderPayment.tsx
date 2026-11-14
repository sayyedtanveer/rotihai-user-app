import React from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {Button,ErrorView,currency} from './UI';
import {PaymentQR} from './PaymentQR';
import {theme as t} from '../theme/theme';

type Props={amount:number;merchant:string;upiId?:string;intent:string;qr:boolean;paid:boolean;busy:boolean;ready:boolean;online:boolean;recorded:boolean;closed:boolean;unsafeRepeat:boolean;gpay:boolean|null;otherUpi:boolean|null;error:unknown;onPaid:(value:boolean)=>void;onQr:()=>void;onPay:(app:'gpay'|'upi')=>void;onConfirm:()=>void;onStatus:()=>void;onRetry:()=>void;onDetails:()=>void};
export function CompactOrderPayment(p:Props){
 const insets=useSafeAreaInsets(),[copied,setCopied]=React.useState(false);
 const unavailable=p.busy||!p.ready||!p.online||!p.intent||p.unsafeRepeat;
 const active=!p.recorded&&!p.closed;
 async function copy(){if(p.upiId){try{await Clipboard.setStringAsync(p.upiId);setCopied(true);}catch{setCopied(false);}}}
 return <View style={s.page}>
  <ScrollView contentContainerStyle={s.content}>
   <Text style={s.eyebrow}>ONE LAST STEP</Text>
   <Text accessibilityRole="header" style={s.title}>{p.closed?'Payment unavailable':p.recorded?'Payment recorded':'Complete payment'}</Text>
   <View style={s.amountCard}>
    <Text style={s.merchant}>Paying {p.merchant}</Text>
    <Text style={s.amount}>{Number.isFinite(p.amount)?currency(p.amount):'Refresh total'}</Text>
    {active&&<Text style={s.caption}>Pay this amount, then confirm below</Text>}
    {!!p.upiId&&<Pressable onPress={()=>void copy()} accessibilityRole="button" accessibilityLabel={'Copy UPI ID '+p.upiId} style={s.upi}><Text selectable style={s.upiText}>{p.upiId}</Text><Text style={s.link}>{copied?'Copied':'Copy'}</Text></Pressable>}
   </View>
   <ErrorView error={p.error}/>
   {active&&<>
    {!p.unsafeRepeat&&<View style={s.card}>
     <Text style={s.section}>Pay using UPI</Text>
     <View style={s.options}>
      {p.gpay!==false&&<Pressable accessibilityRole="button" accessibilityState={{disabled:unavailable||p.gpay!==true}} disabled={unavailable||p.gpay!==true} onPress={()=>p.onPay('gpay')} style={[s.option,(unavailable||p.gpay!==true)&&s.disabled]}><Text style={s.optionMark}>GPay</Text><Text style={s.optionLabel}>Google Pay</Text></Pressable>}
      {!!p.otherUpi&&<Pressable accessibilityRole="button" accessibilityState={{disabled:unavailable}} disabled={unavailable} onPress={()=>p.onPay('upi')} style={[s.option,unavailable&&s.disabled]}><Text style={s.optionMark}>UPI</Text><Text style={s.optionLabel}>Other UPI apps</Text></Pressable>}
     </View>
     {p.gpay===false&&!p.otherUpi&&<Text style={s.caption}>Use the UPI ID above or scan from another device.</Text>}
     {!!p.intent&&<Pressable accessibilityRole="button" accessibilityState={{expanded:p.qr}} onPress={p.onQr} style={s.qrRow}><Text style={s.link}>{p.qr?'Hide QR code':'Show QR code'}</Text><Text style={s.link}>{p.qr?'−':'+'}</Text></Pressable>}
     {p.qr&&<View style={s.qr}><PaymentQR value={p.intent}/><Text style={s.caption}>Scan from another device</Text></View>}
    </View>}
    {p.unsafeRepeat&&<View style={s.card}><Text style={s.section}>Back from your payment app?</Text><Text style={s.caption}>If you paid, check the box below and complete payment. Please avoid paying twice.</Text><Pressable accessibilityRole="button" onPress={p.onStatus} disabled={p.busy||!p.online} style={s.textButton}><Text style={s.link}>Check payment status</Text></Pressable><Pressable accessibilityRole="button" onPress={p.onRetry} disabled={p.busy||!p.online} style={s.textButton}><Text style={s.caption}>Payment failed? Review retry</Text></Pressable></View>}
   </>}
   {(p.recorded||p.closed)&&<Text style={s.caption}>{p.closed?'This order can no longer be paid.':'Your payment declaration has been recorded. View your order for updates.'}</Text>}
  </ScrollView>
  <View style={[s.footer,{paddingBottom:Math.max(insets.bottom,14)}]}>
   {active?<><Pressable accessibilityRole="checkbox" accessibilityState={{checked:p.paid,disabled:p.busy}} disabled={p.busy} onPress={()=>p.onPaid(!p.paid)} style={[s.confirmRow,p.paid&&s.checkedRow]}><View style={[s.checkbox,p.paid&&s.checkedBox]}>{p.paid&&<Text style={s.tick}>✓</Text>}</View><View style={{flex:1,gap:3}}><Text style={s.checkLabel}>I paid {currency(p.amount)}</Text><Text style={s.small}>Check after completing your UPI payment</Text></View></Pressable>
   <Button title={p.busy?'Confirming…':'Complete payment'} disabled={!p.paid||p.busy||!p.ready||!p.online||!Number.isFinite(p.amount)||p.amount<=0} onPress={p.onConfirm}/>
   <Pressable accessibilityRole="button" onPress={p.onDetails} disabled={p.busy} style={s.later}><Text style={s.caption}>Complete later</Text></Pressable></>:<Button title="View order" onPress={p.onDetails}/>}
  </View>
 </View>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:'#fbf5ec'},
 content:{padding:20,gap:14,width:'100%',maxWidth:600,alignSelf:'center'},
 eyebrow:{fontFamily:t.semibold,fontSize:10,letterSpacing:1.7,color:'#9b7050'},
 title:{fontFamily:t.bold,fontSize:25,letterSpacing:-.6,color:t.ink},
 amountCard:{borderRadius:22,backgroundColor:'#fff1db',padding:20,alignItems:'center',gap:8,borderWidth:1,borderColor:'#f0ddbd'},
 merchant:{fontFamily:t.medium,fontSize:13,color:'#765b42'},
 amount:{fontFamily:t.bold,fontSize:38,letterSpacing:-1.2,color:'#493123'},
 caption:{fontFamily:t.font,fontSize:12,lineHeight:18,color:t.muted},
 upi:{flexDirection:'row',alignItems:'center',gap:12,marginTop:6,paddingHorizontal:12,minHeight:44,borderRadius:10,backgroundColor:'#fffaf3',maxWidth:'100%'},
 upiText:{fontFamily:t.medium,fontSize:12,color:t.ink,flexShrink:1},
 link:{fontFamily:t.semibold,fontSize:12,color:t.primary},
 card:{padding:16,gap:12,borderRadius:19,backgroundColor:'#fffdf9',borderWidth:1,borderColor:'#eee2d2'},
 section:{fontFamily:t.semibold,fontSize:14,color:t.ink},
 options:{flexDirection:'row',gap:10},
 option:{flex:1,minHeight:76,padding:12,alignItems:'center',justifyContent:'center',gap:8,borderWidth:1,borderColor:'#e9dfd2',borderRadius:13,backgroundColor:'#fff'},
 optionMark:{fontFamily:t.bold,fontSize:17,color:t.ink},
 optionLabel:{fontFamily:t.medium,fontSize:12,color:t.muted},
 disabled:{opacity:.4},
 qrRow:{minHeight:44,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 qr:{alignItems:'center',gap:10},textButton:{minHeight:44,justifyContent:'center'},
 footer:{backgroundColor:'#fffdf9',paddingHorizontal:20,paddingTop:12,borderTopWidth:1,borderColor:'#eaddcc',gap:10},
 confirmRow:{minHeight:64,padding:12,borderRadius:13,backgroundColor:'#fcf5e9',flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:'#eadcc7'},
 checkedRow:{backgroundColor:'#edf6ee',borderColor:'#c9dfcb'},
 checkbox:{width:23,height:23,borderRadius:6,borderWidth:1.5,borderColor:'#bda98f',backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},
 checkedBox:{backgroundColor:t.success,borderColor:t.success},
 tick:{fontFamily:t.bold,color:'#fff',fontSize:15},
 checkLabel:{fontFamily:t.semibold,fontSize:14,color:t.ink},
 small:{fontFamily:t.font,fontSize:11,lineHeight:16,color:t.muted},
 later:{minHeight:40,alignItems:'center',justifyContent:'center'}
});
