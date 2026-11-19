import {apiOrigin} from '../api/apiBase';
import {useEffect,useState} from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import {isConnected} from '../api/connectivity';
const active=new Map<string,Promise<string>>();
function filename(url:string){let a=2166136261,b=5381;for(const c of url){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}return (a>>>0).toString(16)+(b>>>0).toString(16)+'-'+url.length;}
async function cachedImage(url:string):Promise<string>{
 if(!/^https?:\/\//.test(url)||!FileSystem.cacheDirectory)return url;
 if(active.has(url))return active.get(url)!;
 const promise=(async()=>{const folder=FileSystem.cacheDirectory+'rotihai-food/';const key=filename(url),file=folder+key+'.image',metadata=folder+key+'.json';
 try{const info=await FileSystem.getInfoAsync(file);if(info.exists){const saved=JSON.parse(await FileSystem.readAsStringAsync(metadata));if(saved.url===url)return file;}
 if(!await isConnected())return url;
 await FileSystem.makeDirectoryAsync(folder,{intermediates:true});
 const result=await FileSystem.downloadAsync(url,file);if(result.status>=200&&result.status<300){await FileSystem.writeAsStringAsync(metadata,JSON.stringify({url,at:Date.now()}));return result.uri;}return url;
 }catch{return url;}})();active.set(url,promise);try{return await promise;}finally{active.delete(url);}
}
export function useFoodImage(uri?:string|null){
 const base=apiOrigin(process.env.EXPO_PUBLIC_API_BASE_URL);
 const full=uri?.trim()?(uri.startsWith('http')||uri.startsWith('file:')?uri:base+(uri.startsWith('/')?uri:'/'+uri)):null;
 const [resolved,setResolved]=useState({url:full,source:full});
 useEffect(()=>{let alive=true;setResolved({url:full,source:full});if(full)void cachedImage(full).then(value=>{if(alive)setResolved({url:full,source:value});});return()=>{alive=false;};},[full]);
 return resolved.url===full?resolved.source:full;
}
