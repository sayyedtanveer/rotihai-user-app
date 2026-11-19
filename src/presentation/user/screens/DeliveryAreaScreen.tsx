import {UnsupportedPincodeError} from '../../../core/location/discoveryRules';
import React,{useRef,useState} from 'react';
import {Text} from 'react-native';
import {useDeliveryArea,validatePincode} from '../../../core/location/DeliveryAreaProvider';
import {Page,Title,Heading,Body,Field,Button,Card,ErrorView} from '../components/UI';
import {Brand} from '../components/BrandUI';
import {theme as t} from '../theme/theme';
export function DeliveryAreaScreen({navigation,onboarding=false}:{navigation?:{goBack:()=>void};onboarding?:boolean}){
 const delivery=useDeliveryArea(),[pin,setPin]=useState(delivery.area?.pincode||''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[unsupported,setUnsupported]=useState(false),lock=useRef(false);
 async function select(){if(lock.current)return;lock.current=true;setBusy(true);setError(null);setUnsupported(false);try{const found=await validatePincode(pin);await delivery.select(found);navigation?.goBack();}catch(e){setUnsupported(e instanceof UnsupportedPincodeError);setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}
 return <Page><Brand/><Text style={{fontFamily:t.bold,fontSize:10,color:t.primary,letterSpacing:1.4}}>HOMEMADE, CLOSE TO YOU</Text><Title>What's your delivery pincode?</Title><Body muted>We'll check availability and show kitchens serving your area.</Body><Card><Field label="Delivery pincode" value={pin} editable={!busy} keyboardType="number-pad" maxLength={6} placeholder="Enter 6-digit pincode" onChangeText={v=>{setPin(v.replace(/\D/g,''));setError(null);setUnsupported(false);}}/><Button title={busy?'Checking delivery…':onboarding?'Continue with this pincode':'Show kitchens in my area'} disabled={busy||!/^\d{6}$/.test(pin)} onPress={()=>void select()}/></Card>{unsupported?<Card><Heading>We're not here yet!</Heading><Body>{error}</Body><Button title="Try another pincode" secondary onPress={()=>{setPin('');setError(null);setUnsupported(false);}}/></Card>:<ErrorView error={error}/>}<Body muted>Your selected pincode will carry through to your delivery address.</Body></Page>;
}
