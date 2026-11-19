import React,{useEffect,useRef,useState} from 'react';
import {View,Text} from 'react-native';
import {apiOrigin} from '../../../core/api/apiBase';
import {validPoint,deliveryMapZoom} from '../../../core/location/addressRules';
type Point={latitude:number;longitude:number};
export function DeliveryMap({coordinate,onChange,disabled=false,height=280,onReady,precision}:{coordinate:Point;onChange:(point:Point)=>void;disabled?:boolean;height?:number;precision?:string;onReady?:(ready:boolean)=>void}){
 const initial=useRef(coordinate),frame=useRef<HTMLIFrameElement>(null),[ready,setReady]=useState(false),origin=apiOrigin(process.env.EXPO_PUBLIC_API_BASE_URL);
 useEffect(()=>{const listener=(event:MessageEvent)=>{if(event.origin!==origin||event.source!==frame.current?.contentWindow)return;const p=event.data;if(p?.type==='ready'){setReady(true);onReady?.(true);}if(p?.type==='error'){setReady(false);onReady?.(false);}if(p?.type==='point'&&ready&&!disabled&&validPoint(p))onChange({latitude:p.latitude,longitude:p.longitude});};window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);},[ready,disabled,onChange,onReady,origin]);
 useEffect(()=>{if(ready&&validPoint(coordinate))frame.current?.contentWindow?.postMessage({type:'set-point',latitude:coordinate.latitude,longitude:coordinate.longitude},origin);},[ready,coordinate.latitude,coordinate.longitude,origin]);
 useEffect(()=>{if(ready)frame.current?.contentWindow?.postMessage({type:'set-interaction',disabled},origin);},[ready,disabled,origin]);
 return <View style={{height,borderRadius:17,overflow:'hidden'}}>{React.createElement('iframe',{ref:frame,title:'Delivery location map',src:origin+'/delivery-map.html?v=2#lat='+initial.current.latitude+'&lon='+initial.current.longitude+'&zoom='+deliveryMapZoom(precision),style:{width:'100%',height:'100%',border:0}})}{!ready&&<Text>Loading map. If it stays blank, check your connection and reload.</Text>}</View>;
}
