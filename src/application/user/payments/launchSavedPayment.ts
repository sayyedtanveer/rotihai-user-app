import type {PendingPayment} from './paymentRules';
// Persist before crossing the app boundary. The launcher result carries no
// authority to update payment/order status.
export async function launchSavedPayment(
 payment:PendingPayment,
 dependencies:{save:(value:PendingPayment)=>Promise<void>;markInitiated:()=>Promise<void>;open:()=>Promise<unknown>}
){
 const prepared={...payment,phase:'launching' as const};
 await dependencies.save(prepared);
 try{await dependencies.markInitiated();await dependencies.open();return prepared;}
 catch(error){await dependencies.save({...prepared,phase:'launch_failed'});throw error;}
}
