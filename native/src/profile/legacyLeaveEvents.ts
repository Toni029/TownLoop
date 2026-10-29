type Listener = (source:string,id:string)=>void;
const listeners=new Map<string,Set<Listener>>();
/** Ephemeral invalidation only after a matching, authenticated server acknowledgement. */
export function onConfirmedLegacyLeave(uid:string,listener:Listener){
 const owned=listeners.get(uid)||new Set<Listener>();owned.add(listener);listeners.set(uid,owned);
 return()=>{owned.delete(listener);if(!owned.size&&listeners.get(uid)===owned)listeners.delete(uid);};
}
export function confirmedLegacyLeave(uid:string,op:string,input:Record<string,unknown>,response:unknown){
 if(op!=='leaveLegacy'||(response as {left?:boolean})?.left!==true||typeof input.source!=='string'||typeof input.legacyId!=='string')return;
 for(const listener of listeners.get(uid)||[])try{listener(input.source,input.legacyId);}catch{/* A detached view cannot invalidate server success. */}
}
