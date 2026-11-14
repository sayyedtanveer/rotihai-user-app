import type {Address} from '../../../core/api/models';
import {validateAddress} from './cartRules';
export function basketDestination(cartKey:string,address:Address|null){
 return address&&!validateAddress(address)?{name:'Checkout' as const,params:{cartKey}}:{name:'Address' as const,params:{checkoutCartKey:cartKey}};
}
