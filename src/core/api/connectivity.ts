import * as Network from 'expo-network';
import {useEffect,useState} from 'react';
export async function isConnected(){try{const state=await Network.getNetworkStateAsync();return state.isConnected!==false&&state.isInternetReachable!==false;}catch{return true;}}
export async function requireConnection(){if(!await isConnected())throw new Error('You are offline. Reconnect before continuing.');}
export function useConnectivity(){const [online,setOnline]=useState(true);useEffect(()=>{void isConnected().then(setOnline);const listener=Network.addNetworkStateListener(s=>setOnline(s.isConnected!==false&&s.isInternetReachable!==false));return()=>listener.remove();},[]);return online;}
