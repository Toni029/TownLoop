import type {KeyValueStorage} from './chunkedStorage';
export type CleanupCredential={deviceId:string;secret:string;uid:string;expiresAt:number};
const KEY='townloop_cleanup_proofs_v1';
const valid=(v:CleanupCredential)=>v&&typeof v.uid==='string'&&v.uid.length>0&&v.uid.length<=128&&!v.uid.includes('/')&&/^[a-f0-9]{32}$/.test(v.deviceId)&&/^[a-f0-9]{64}$/.test(v.secret)&&Number.isFinite(v.expiresAt);
export function createCleanupProofClient(storage:KeyValueStorage,remote:{register:(uid:string,previous?:CleanupCredential)=>Promise<CleanupCredential>;check:(proof:CleanupCredential)=>Promise<{confirmed:boolean;uid?:string;unavailable?:boolean}>},clear:(uid:string)=>Promise<void>) {
 let tail:Promise<unknown>=Promise.resolve();
 const pending=new Map<string,Promise<void>>();
 return (currentUid?:string)=>{
  const key=currentUid||'';if(pending.has(key))return pending.get(key)!;
  const action=async()=>{
   const raw=await storage.getItem(KEY),proofs:CleanupCredential[]=raw?JSON.parse(raw):[];
   if(!Array.isArray(proofs)||proofs.length>10||!proofs.every(valid))throw Error('Cleanup proof storage needs recovery.');
   let failure:unknown;const confirmed=new Set<string>();
   const save=()=>proofs.length?storage.setItem(KEY,JSON.stringify(proofs)):storage.removeItem(KEY);
   // Proof failure/expiry is NOT deletion evidence. Never erase local records on a timeout.
   for(const proof of [...proofs]) {
    if(proof.expiresAt<=Date.now()){proofs.splice(proofs.indexOf(proof),1);await save();continue;}
    let result;try{result=await remote.check(proof);}catch{continue;}
    if(result.confirmed&&result.uid===proof.uid){confirmed.add(proof.uid);try{await clear(proof.uid);}catch(error){failure??=error;continue;}proofs.splice(proofs.indexOf(proof),1);await save();}
    // An unknown/temporarily unavailable server must not destroy a recoverable credential.
    // The known local expiry still bounds retention.
    else if(result.unavailable){continue;}
   }
   if(!currentUid||confirmed.has(currentUid)){if(failure)throw failure;return;}
   const previous=proofs.find(p=>p.uid===currentUid);
   if(previous&&previous.expiresAt>Date.now()+59*86400000){if(failure)throw failure;return;}
   const next=await remote.register(currentUid,previous);
   if(!valid(next)||next.uid!==currentUid)throw Error('Cleanup registration identity mismatch.');
   const index=proofs.findIndex(p=>p.uid===currentUid);
   if(index>=0)proofs[index]=next;else {if(proofs.length>=10)throw Error('Cleanup proof capacity reached.');proofs.push(next);}
   await save();if(failure)throw failure;
  };
  const next=tail.then(action,action);tail=next.catch(()=>{});pending.set(key,next);void next.finally(()=>{if(pending.get(key)===next)pending.delete(key);}).catch(()=>{});return next;
 };
}
