import {doc,getDocFromServer,runTransaction,serverTimestamp,type Firestore,type Transaction} from 'firebase/firestore';
import {advance,classify} from '../../functions/abusePolicy.cjs';
/** Rollout handshake is not authorization: strict Rules independently require counters. */
export async function abuseControls(db:Firestore){
 try {const d=(await getDocFromServer(doc(db,'security_controls','abuse_limits'))).data();return d?.protocolVersion===1?d:null;}
 catch(error){if((error as {code?:string}).code==='permission-denied')return null;throw Error('Could not verify upload/request safeguards. Check your connection and retry.');}
}
export async function runBudgetedTransaction<T>(db:Firestore,uid:string,action:(tx:Transaction)=>Promise<T>):Promise<T>{
 const controls=await abuseControls(db);
 const enabled=controls?.prepareClients===true||controls?.enforceWrites===true;
 return runTransaction(db,async tx=>{
  const reference=doc(db,'safety_limits',uid),prior=enabled?(await tx.get(reference)).data()||{}:{},before=new Map<string,any>(),writes:{method:string;args:any[]}[]=[];
  const wrapped=new Proxy(tx,{get(target,key){
   if(key==='get')return async(ref:any)=>{const result=await target.get(ref);before.set(ref.path,result.exists()?result.data():undefined);return result;};
   if(['set','update','delete'].includes(String(key)))return(...args:any[])=>{writes.push({method:String(key),args});return wrapped;};
   const member=Reflect.get(target,key);return typeof member==='function'?member.bind(target):member;
  }});
  const result=await action(wrapped),activity={...(prior.activity||{})};let scope='';
  for(const write of writes){
   if(write.method==='set'){const priorParent=before.get(write.args[0].path);if(priorParent?.mediaUploadGeneration)write.args[1]={...write.args[1],mediaUploadGeneration:priorParent.mediaUploadGeneration,mediaUploadTickets:priorParent.mediaUploadTickets||{}};}
   if(!enabled)continue;
   if(write.method==='delete'||typeof write.args[1]!=='object')continue;const path=write.args[0].path;const selected=classify(path,before.get(path),write.args[1]);if(!selected)continue;
   // One quota pointer per transaction cannot authorize a second chargeable record.
   if(scope)throw Error('Submit these changes separately so each request can be safely checked.');scope=selected;
   const old=activity[scope],now=Date.now(),next=advance(old,scope,path,now);
   activity[scope]={windowAt:next.windowReset?serverTimestamp():old.windowAt,dayAt:next.dayReset?serverTimestamp():old.dayAt,windowCount:next.windowCount,dayCount:next.dayCount,bytesDay:0,lastAt:serverTimestamp(),target:path};
  }
  for(const write of writes)(tx[write.method as 'set'] as Function)(...write.args);
  if(scope)tx.set(reference,{activity,activityScope:scope},{merge:true});
  return result;
 });
}
