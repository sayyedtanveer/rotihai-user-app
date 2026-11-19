import React,{useRef,useState,useEffect} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {WebView} from 'react-native-webview';
import {apiOrigin} from '../../../core/api/apiBase';
import {validPoint,deliveryMapZoom} from '../../../core/location/addressRules';
import {theme as t} from '../theme/theme';
type Point={latitude:number;longitude:number};
// Reuses the web app's existing Leaflet / OSM provider. No Google key or GPS permission.
export function DeliveryMap({coordinate,onChange,disabled=false,height=280,onReady,precision}:{coordinate:Point;onChange:(point:Point)=>void;disabled?:boolean;height?:number;precision?:string;onReady?:(ready:boolean)=>void}){
 const webview=useRef<WebView<unknown>>(null),lastPoint=useRef(coordinate),initial=useRef(coordinate),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
 const origin=apiOrigin(process.env.EXPO_PUBLIC_API_BASE_URL),uri=origin+'/delivery-map.html?v=2#lat='+initial.current.latitude+'&lon='+initial.current.longitude+'&zoom='+deliveryMapZoom(precision);
 useEffect(()=>{if(ready)return;const timer=setTimeout(()=>{setFailed(true);onReady?.(false);},15000);return()=>clearTimeout(timer);},[ready]);
 useEffect(()=>{if(!ready||!validPoint(coordinate))return;if(lastPoint.current.latitude!==coordinate.latitude||lastPoint.current.longitude!==coordinate.longitude){lastPoint.current=coordinate;webview.current?.injectJavaScript(`window.setDeliveryPin?.(${coordinate.latitude},${coordinate.longitude});true;`);}},[ready,coordinate.latitude,coordinate.longitude]);
 useEffect(()=>{if(ready)webview.current?.injectJavaScript(`window.setDeliveryMapDisabled?.(${disabled});true;`);},[ready,disabled]);
 return <View pointerEvents={disabled?'none':'auto'} style={{height,borderRadius:17,overflow:'hidden',borderWidth:1,borderColor:t.border}}>
 <WebView<unknown> ref={webview} source={{uri}} style={StyleSheet.absoluteFill} originWhitelist={[origin]} javaScriptEnabled geolocationEnabled={false} scrollEnabled={false} nestedScrollEnabled onShouldStartLoadWithRequest={r=>r.url.startsWith(origin+'/delivery-map.html')} onMessage={e=>{try{const value=JSON.parse(e.nativeEvent.data);if(value.type==='ready'){setReady(true);setFailed(false);onReady?.(true);}else if(value.type==='error'){setFailed(true);onReady?.(false);}else if(value.type==='point'&&ready&&!failed&&!disabled&&validPoint(value)){lastPoint.current={latitude:value.latitude,longitude:value.longitude};onChange(lastPoint.current);}}catch{}}} onError={()=>{setFailed(true);onReady?.(false);}}/>
 {(!ready||failed)&&<View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:'#fff8eff5',alignItems:'center',justifyContent:'center',padding:24}]}><Text style={{fontFamily:t.semibold,color:t.ink,textAlign:'center'}}>{failed?'Map unavailable. Check your connection and tap Reload map.':'Finding your place on the map…'}</Text></View>}
 </View>;
}
