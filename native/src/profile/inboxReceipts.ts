export type ReceiptKind='delivered'|'read';
export function receiptStatus(message:{persisted?:boolean;receiptVersion?:number;receiptState?:string;readBy?:string[]}){
 if(message.persisted!==true)return null;
 return message.receiptVersion===1&&['delivered','read'].includes(message.receiptState||'')?message.receiptState as ReceiptKind:'sent';
}
type Timer=ReturnType<typeof setTimeout>;
/** One coalesced foreground queue per conversation/account; no background polling. */
export function createReceiptQueue({send,active,schedule=(fn,ms)=>setTimeout(fn,ms),cancel=clearTimeout,load,save}:{send:(kind:ReceiptKind,ids:string[])=>Promise<{kind:ReceiptKind;acknowledged:string[]}>;active:()=>boolean;schedule?:(fn:()=>void,ms:number)=>Timer;cancel?:(timer:Timer)=>void;load?:()=>Promise<unknown>;save?:(items:[string,number][])=>Promise<void>}){
 const pending=new Map<string,number>(),confirmed=new Map<string,number>();let timer:Timer|undefined,busy=false,disposed=false,attempts=0,hydrated=!load;let saving=Promise.resolve();
 const persist=()=>{if(!save||!hydrated)return;const items=[...pending];saving=saving.catch(()=>{}).then(()=>save(items)).catch(()=>{});};
 const stopTimer=()=>{if(timer!==undefined)cancel(timer);timer=undefined;};
 function scheduleNext(ms=150){if(!hydrated||disposed||busy||timer!==undefined||!pending.size||!active()||attempts>=3)return;timer=schedule(()=>{timer=undefined;void flush();},ms);}
 async function flush(){if(disposed||busy||!active()||!pending.size)return;busy=true;
  const level=[...pending.values()].includes(2)?2:1,kind:ReceiptKind=level===2?'read':'delivered',ids=[...pending].filter(([,n])=>n===level).slice(0,50).map(([id])=>id);
  try{const result=await send(kind,ids);if(disposed)return;if(result.kind!==kind||ids.some(id=>!result.acknowledged?.includes(id)))throw Error('Receipt not confirmed');
   for(const id of ids){confirmed.set(id,Math.max(level,confirmed.get(id)||0));if((pending.get(id)||0)<=level)pending.delete(id);}persist();while(confirmed.size>2000)confirmed.delete(confirmed.keys().next().value!);attempts=0;
  }catch{attempts++;}finally{busy=false;scheduleNext(attempts?5000*attempts:150);}
 }
 if(load)void load().then(stored=>{if(disposed)return;if(Array.isArray(stored))for(const row of stored)if(Array.isArray(row)&&typeof row[0]==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(row[0])&&[1,2].includes(row[1]))pending.set(row[0],Math.max(row[1],pending.get(row[0])||0));}).catch(()=>{}).finally(()=>{if(disposed)return;hydrated=true;persist();scheduleNext();});
 return{add(kind:ReceiptKind,ids:string[]){if(disposed)return;const level=kind==='read'?2:1;let changed=false;for(const id of ids)if((confirmed.get(id)||0)<level&&(pending.get(id)||0)<level){pending.set(id,level);changed=true;}if(changed)persist();scheduleNext();},wake(){attempts=0;scheduleNext();},pause:stopTimer,dispose(){disposed=true;stopTimer();pending.clear();confirmed.clear();}};
}
