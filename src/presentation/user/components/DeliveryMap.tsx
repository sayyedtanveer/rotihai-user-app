import React,{useEffect,useRef,useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import MapView,{Marker,LatLng} from 'react-native-maps';
import {theme as t} from '../theme/theme';
import {Icon} from './BrandUI';
export function DeliveryMap({coordinate,onChange,disabled=false,height=250}:{coordinate:LatLng;onChange:(point:LatLng)=>void;disabled?:boolean;height?:number}){
 const [loaded,setLoaded]=useState(false),[waited,setWaited]=useState(false),map=useRef<MapView>(null);
 useEffect(()=>{const timer=setTimeout(()=>setWaited(true),12000);return()=>clearTimeout(timer);},[]);
 useEffect(()=>{map.current?.animateToRegion({...coordinate,latitudeDelta:.008,longitudeDelta:.008},0);},[coordinate.latitude,coordinate.longitude]);
 return <View style={{height,borderRadius:17,overflow:'hidden',borderWidth:1,borderColor:t.border}}>
 <MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={{...coordinate,latitudeDelta:.008,longitudeDelta:.008}} onMapLoaded={()=>setLoaded(true)} onPress={e=>{if(!disabled)onChange(e.nativeEvent.coordinate);}}><Marker coordinate={coordinate} draggable={!disabled} onDragEnd={e=>{if(!disabled)onChange(e.nativeEvent.coordinate);}}/></MapView>
 {!loaded&&<View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:'#f4efe7f2',alignItems:'center',justifyContent:'center',padding:25,gap:11}]}><Icon name="pin" color={t.primary} size={30}/><Text style={{fontFamily:t.semibold,color:t.ink,fontSize:13,textAlign:'center'}}>{waited?'Map preview is unavailable':'Loading your map preview'}</Text><Text style={{fontFamily:t.font,color:t.muted,fontSize:11,lineHeight:18,textAlign:'center'}}>You can use GPS or search for your address, then check the delivery details below.</Text></View>}
 </View>;
}
