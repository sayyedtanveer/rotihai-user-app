import {orderSteps as steps,orderStage} from '../../../application/user/orders/orderRules';
import React from 'react';
import {Text,View} from 'react-native';
import {theme as t} from '../theme/theme';
import {nice} from './UI';
export function OrderProgress({status}:{status:string}){
 const current=orderStage(status);
 if(current<0&&!['cancelled','rejected','expired'].includes(status))return <Text style={{fontFamily:t.semibold,color:t.ink}}>{nice(status)}</Text>;
 if(['cancelled','rejected','expired'].includes(status))return <View style={{padding:16,backgroundColor:'#fff4ee',borderRadius:13,gap:6}}><Text style={{fontFamily:t.bold,color:t.danger,fontSize:15}}>{nice(status)}</Text><Text style={{fontFamily:t.font,color:t.muted,fontSize:12,lineHeight:19}}>This order has ended. Contact support if you need help.</Text></View>;
 return <View>{steps.map(([key,label],index)=><View key={key} style={{flexDirection:'row',gap:13,minHeight:index===steps.length-1?30:42}}><View style={{width:20,alignItems:'center'}}><View style={{width:16,height:16,borderRadius:8,borderWidth:2,borderColor:index<=current?t.primary:t.border,backgroundColor:index<current?t.primary:index===current?t.pale:'white'}}/>{index<steps.length-1&&<View style={{flex:1,width:2,backgroundColor:index<current?t.primary:t.border,marginVertical:3}}/>}</View><Text style={{fontFamily:index===current?t.bold:t.font,fontSize:12,color:index<=current?t.ink:t.muted,paddingBottom:15}}>{label}</Text></View>)}</View>;
}
