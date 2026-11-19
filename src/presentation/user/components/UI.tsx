import {apiOrigin} from '../../../core/api/apiBase';
import {useFoodImage} from '../../../core/storage/foodImageCache';
import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { theme as t,typography } from '../theme/theme';
export const currency=(value:unknown)=>'₹'+Number(value||0).toLocaleString('en-IN',{maximumFractionDigits:2});
export const nice=(value?:string)=>(value||'').replace(/_/g,' ').replace(/\b[a-z]/g,c=>c.toUpperCase());
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

export function Page({children,refreshing,onRefresh,compact=false,scrollRef}:React.PropsWithChildren<{scrollRef?:React.Ref<React.ComponentRef<typeof ScrollView>>;compact?:boolean;refreshing?:boolean;onRefresh?:()=>void}>){
  return (
    <KeyboardAvoidingView style={s.page} behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={90}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="warmth" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.bg} />
              <Stop offset="1" stopColor={t.pale} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#warmth)" />
        </Svg>
      </View>
      <ScrollView ref={scrollRef}
        style={{flex:1}} 
        contentContainerStyle={[s.content,compact&&{gap:14,paddingTop:14}]}
        keyboardShouldPersistTaps="handled" 
        refreshControl={onRefresh?<RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.primary}/>:undefined}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Title({children}:React.PropsWithChildren){return <Text accessibilityRole="header" style={s.title}>{children}</Text>;}
export function Heading({children}:React.PropsWithChildren){return <Text accessibilityRole="header" style={s.heading}>{children}</Text>;}
export function Body({children,muted=false}:React.PropsWithChildren<{muted?:boolean}>){return <Text style={[s.body,muted&&{color:t.muted}]}>{children}</Text>;}
export function Card({children}:React.PropsWithChildren){return <View style={s.card}>{children}</View>;}
export function ChoiceRow({children}:React.PropsWithChildren){return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:2}}>{children}</ScrollView>;}
export function Row({children}:React.PropsWithChildren){return <View style={s.row}>{children}</View>;}
export function Button({title,onPress,disabled,secondary,danger}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean;danger?:boolean}){return <Pressable accessibilityRole="button" accessibilityState={{disabled:!!disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>[s.button,secondary&&s.secondary,danger&&{backgroundColor:t.danger},(disabled||pressed)&&{opacity:.45}]}><Text style={[s.buttonText,secondary&&{color:t.primary}]}>{title}</Text></Pressable>;}
export function Field({label,style,onFocus,onBlur,required=false,error,hint,...props}:TextInputProps&{label:string;required?:boolean;error?:string;hint?:string}){
 const [focused,setFocused]=React.useState(false);
 return <View style={{gap:7}}><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Text style={s.label}>{label}</Text>{required&&<Text style={{color:t.danger,fontFamily:t.bold}}>*</Text>}</View>
 <TextInput accessibilityLabel={label+(required?', required':'')} accessibilityHint={error||hint} placeholderTextColor={t.muted} {...props}
 style={[s.input,focused&&{borderColor:t.primary},props.multiline&&{minHeight:86,textAlignVertical:'top'},style,error?{borderColor:t.danger,backgroundColor:'#fff8f6'}:undefined]}
 onFocus={event=>{setFocused(true);onFocus?.(event);}} onBlur={event=>{setFocused(false);onBlur?.(event);}}/>
 {error?<Text accessibilityRole="alert" style={{fontFamily:t.font,fontSize:11,lineHeight:17,color:t.danger}}>{error}</Text>:hint?<Text style={{fontFamily:t.font,fontSize:11,lineHeight:17,color:t.muted}}>{hint}</Text>:null}</View>;
}
export function Chip({title,selected,onPress}:{title:string;selected?:boolean;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityState={{selected:!!selected}} onPress={onPress} style={[s.chip,selected&&{backgroundColor:t.pale,borderColor:t.primary}]}><Text style={{color:selected?t.primary:t.ink,fontFamily:t.semibold,fontSize:12}}>{title}</Text></Pressable>;}
export function Toggle({title,value,onChange,disabled=false}:{title:string;value:boolean;onChange:(v:boolean)=>void;disabled?:boolean}){return <Pressable accessibilityRole="checkbox" accessibilityState={{checked:value,disabled}} disabled={disabled} onPress={()=>onChange(!value)} style={[s.row,{minHeight:48}]}><View style={{width:22,height:22,borderRadius:6,borderWidth:1.5,borderColor:value?t.primary:t.border,backgroundColor:value?t.primary:'white',alignItems:'center',justifyContent:'center'}}>{value&&<Text style={{color:'white',fontSize:14}}>✓</Text>}</View><Text style={[s.body,{flex:1}]}>{title}</Text></Pressable>;}
export function ErrorView({error,retry}:{error:unknown;retry?:()=>void}){if(!error)return null;return <View style={[s.card,{borderColor:'#f0d7d1',backgroundColor:'#fff8f6'}]}><Text accessibilityRole="alert" style={[s.body,{color:t.danger}]}>{error instanceof Error?error.message:String(error)}</Text>{retry&&<Button title="Try again" onPress={retry} secondary/>}</View>;}
export function Loading(){return <View style={{padding:32}}><ActivityIndicator color={t.primary} accessibilityLabel="Loading"/></View>;}
export function Empty({title,subtitle}: {title:string;subtitle?:string}){return <View style={[s.card,{alignItems:'center',paddingVertical:32}]}><View style={{width:44,height:4,borderRadius:2,backgroundColor:t.gold,marginBottom:8}}/><Text style={[s.heading,{textAlign:'center'}]}>{title}</Text>{subtitle&&<Text style={[s.body,{color:t.muted,textAlign:'center'}]}>{subtitle}</Text>}</View>;}
export function Photo({uri,height=140,style,label='Food or kitchen photo'}:{uri?:string|null;height?:number;style?:StyleProp<ViewStyle>;label?:string}){
 const source=useFoodImage(uri);const [failed,setFailed]=React.useState(false);React.useEffect(()=>setFailed(false),[uri,source]);
 if(!uri?.trim()||failed)return null;
 const base=apiOrigin(process.env.EXPO_PUBLIC_API_BASE_URL);
 return <Image accessibilityLabel={label} onError={()=>setFailed(true)} source={{uri:source||uri}} style={[{height,width:'100%',borderRadius:16},style as any]} resizeMode="cover"/>;
}
export function QuantityControl({quantity,onMinus,onPlus,disabled=false,label='dish',minimum=0}:{quantity:number;onMinus:()=>void;onPlus:()=>void;disabled?:boolean;label?:string;minimum?:number}){
 return <View style={s.stepper}><Pressable accessibilityRole="button" accessibilityLabel={'Remove one '+label} accessibilityState={{disabled:quantity<=minimum}} disabled={quantity<=minimum} onPress={onMinus} style={s.step}><Text style={s.stepText}>−</Text></Pressable><Text accessibilityLabel={'Quantity '+quantity} style={{fontFamily:t.bold,color:t.success,fontSize:14}}>{quantity}</Text><Pressable accessibilityRole="button" accessibilityLabel={'Add one '+label} disabled={disabled} onPress={onPlus} style={[s.step,disabled&&{opacity:.4}]}><Text style={s.stepText}>+</Text></Pressable></View>;
}
export function SectionLabel({title,subtitle}:{title:string;subtitle?:string}){return <View style={{gap:5}}><Heading>{title}</Heading>{subtitle&&<Body muted>{subtitle}</Body>}</View>;}
export const s=StyleSheet.create({
 page:{flex:1,backgroundColor:t.bg},content:{padding:20,paddingBottom:32,gap:18,width:'100%',maxWidth:760,alignSelf:'center'},
 card:{backgroundColor:t.surface,borderRadius:19,padding:18,gap:12,borderWidth:1,borderColor:t.border},
 title:{...typography.screenTitle,color:t.ink},
 heading:{...typography.sectionTitle,color:t.ink},
 body:{...typography.body,color:t.ink},
 row:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:10},
 button:{backgroundColor:t.primary,borderRadius:13,paddingHorizontal:18,paddingVertical:14,minHeight:49,alignItems:'center',justifyContent:'center'},
 secondary:{backgroundColor:'white',borderWidth:1,borderColor:t.border},
 buttonText:{...typography.button,color:t.onPrimary,textAlign:'center'},
 chip:{borderRadius:12,backgroundColor:'white',borderWidth:1,borderColor:t.border,paddingHorizontal:13,paddingVertical:11,minHeight:44,justifyContent:'center'},
 label:{...typography.label,color:t.ink},
 input:{borderWidth:1,borderColor:t.inputBorder,backgroundColor:'white',borderRadius:13,padding:14,minHeight:50,fontFamily:t.font,fontSize:15,color:t.ink},
 stepper:{minHeight:48,minWidth:132,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderWidth:1,borderColor:'#c9ded0',borderRadius:11,backgroundColor:'#f5fbf6'},
 step:{width:48,minHeight:48,alignItems:'center',justifyContent:'center'},stepText:{fontFamily:t.bold,color:t.success,fontSize:20},
});
