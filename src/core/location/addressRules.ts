import type {Address,User} from '../api/models';
export function addressIdentity(a:{building?:string;street?:string;area?:string;city?:string;pincode?:string}){return [a.building,a.street,a.area,a.city,a.pincode].map(v=>(v||'').trim().toLowerCase().replace(/\s+/g,' ')).join('|');}
export function validPoint(p:{latitude:number;longitude:number}){return Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;}
export function reusableAddress<T extends {latitude:number;longitude:number;building:string;street:string;area:string;city:string;pincode:string}>(address:T|null,identity:string,pincode:string):T|null{return address?.pincode===pincode&&addressIdentity(address)===identity&&validPoint(address)?address:null;}

export function addressFieldErrors(fields:{building:string;street:string;area:string}){
 return {building:fields.building.trim()?'':'Enter your flat, house number or building.',street:fields.street.trim()?'':'Enter your street or road name.',area:fields.area.trim()?'':'Choose your delivery area.'};
}
export function assertAddressSaved(profile:Partial<User>,address:Address,owner:string){
 const text=(v:unknown)=>typeof v==='string'?v.trim():'';
 for(const field of ['building','street','area','city','pincode','landmark'] as const){
  const key=('address'+field[0].toUpperCase()+field.slice(1)) as keyof User;
  if(text(profile[key])!==text(address[field]))throw new Error('The server did not save all address fields. Please retry with the updated backend.');
 }
 if(profile.id!==owner||profile.latitude==null||profile.longitude==null||Math.abs(Number(profile.latitude)-address.latitude)>0.00001||Math.abs(Number(profile.longitude)-address.longitude)>0.00001||!Number.isFinite(Number(profile.latitude))||!Number.isFinite(Number(profile.longitude)))throw new Error('Your delivery pin was not saved correctly. Please retry.');
 if(address.locationConfirmed===true&&profile.locationConfirmed!==true)throw new Error('Your delivery pin confirmation was not saved. Please retry with the updated backend.');
}

export function needsMapSelection(precision:string,selected=false){return !selected&&!['rooftop','customer_selected'].includes(precision);}

export function deliveryGpsPin(point:{latitude:number;longitude:number;pincode?:string;accuracyMeters?:number},pincode:string){
 if(!validPoint(point))throw new Error('GPS could not provide a valid location. Move the map pin manually.');
 const detected=point.pincode?.replace(/\s/g,'');
 if(detected&&/^\d{6}$/.test(detected)&&detected!==pincode)throw new Error('GPS is in a different pincode. Change your pincode on Home if you are ordering here, or choose the delivery entrance manually on the map.');
 return {latitude:point.latitude,longitude:point.longitude,accuracyMeters:point.accuracyMeters};
}
export const deliveryMapZoom=(precision?:string)=>precision==='pincode'?14:precision==='area'?15:17;
