import Constants from 'expo-constants';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {createCleanupProofClient,type CleanupCredential} from '../localData/cleanupProofClient';
import {authPersistenceStorage,hasProtectedStorage} from '../localData/nativeStorage';
import {app,auth} from './firebase';
let sync:((uid?:string)=>Promise<void>)|undefined;
export async function syncCleanupProofs(uid:string|undefined,clear:(uid:string)=>Promise<void>) {
 // Explicit coordinated release gate: older/current clients have no unpublished backend dependency.
 if(Constants.expoConfig?.extra?.accountCleanupProofProtocol!==1||!hasProtectedStorage)return;
 sync??=createCleanupProofClient(authPersistenceStorage,{
  async register(currentUid,previous) {
   if(auth.currentUser?.uid!==currentUid)throw Error('session_changed');
   const call=httpsCallable<Partial<CleanupCredential>,CleanupCredential>(getFunctions(app,'us-central1'),'registerAccountCleanupDevice',{timeout:15000});
   const result=(await call(previous?{deviceId:previous.deviceId,secret:previous.secret}:{})).data;
   if(auth.currentUser?.uid!==currentUid)throw Error('session_changed');return result;
  },
  async check(proof) {
   // Deliberately omit Auth: a revoked Firebase session must not block cleanup-only proof.
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
   try {
    const response=await fetch('https://us-central1-cc-livingcommunity-app.cloudfunctions.net/checkAccountCleanupProof',{
     method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
     body:JSON.stringify({data:{deviceId:proof.deviceId,secret:proof.secret}}),
    });
    if(!response.ok)throw Error('cleanup_proof_unavailable');
    const data=await response.json();if(data.error||!data.result)throw Error('cleanup_proof_unavailable');return data.result;
   }finally{clearTimeout(timeout);}
  },
 },clear);
 await sync(uid);
}
