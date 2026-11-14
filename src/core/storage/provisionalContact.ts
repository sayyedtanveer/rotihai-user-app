import AsyncStorage from '@react-native-async-storage/async-storage';
import {normalizeProvisionalPhone} from '../../application/user/auth/entryRules';
const KEY='rotihai.provisional-contact';
export const provisionalContact={
 async read(){try{const raw=await AsyncStorage.getItem(KEY);return raw?normalizeProvisionalPhone(JSON.parse(raw).phone):null;}catch{return null;}},
 async readName(){try{const raw=await AsyncStorage.getItem(KEY);return raw?String(JSON.parse(raw).name||''):'';}catch{return '';}},
 async save(phone:string,name?:string){const normalized=normalizeProvisionalPhone(phone);await AsyncStorage.setItem(KEY,JSON.stringify({phone:normalized,name:name?.trim()||((await this.read())===normalized?await this.readName():''),verified:false}));return normalized;},
 clear:()=>AsyncStorage.removeItem(KEY),
};
