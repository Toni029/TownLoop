export type InboxTarget={category:'friend'|'office'|'maintenance'|'marketplace';conversationId:string;deviceBinding:string};
export function inboxTarget(data:Record<string,unknown>|undefined):InboxTarget|null {
 if(!data||data.type!=='inbox'||!['friend','office','maintenance','marketplace'].includes(String(data.category))||
  typeof data.conversationId!=='string'||!data.conversationId||data.conversationId.length>512||data.conversationId.includes('/')||
  typeof data.deviceBinding!=='string'||!/^[a-f0-9]{64}$/.test(data.deviceBinding))return null;
 return {category:data.category as InboxTarget['category'],conversationId:data.conversationId,deviceBinding:data.deviceBinding};
}
export const collectionFor={friend:'resident_chats',office:'office_chats',maintenance:'maintenance_chats',marketplace:'marketplace_chats'} as const;
/** Only one async registration/revocation may own the installation at a time. */
export function serialOperations(){let tail=Promise.resolve();return <T>(work:()=>Promise<T>):Promise<T>=>{const result=tail.then(work);tail=result.then(()=>{},()=>{});return result;};}
/** Captures an account epoch across asynchronous server authorization. */
export async function authorizeTarget(target:InboxTarget,dependencies:{
 session:()=>{uid:string;ready:boolean};binding:(uid:string)=>Promise<string>;
 authorize:(target:InboxTarget,uid:string)=>Promise<boolean>;
}):Promise<boolean>{
 const current=dependencies.session();if(!current.ready||!current.uid)return false;
 if(await dependencies.binding(current.uid)!==target.deviceBinding)return false;
 if(!await dependencies.authorize(target,current.uid))return false;
 const next=dependencies.session();return next.ready&&next.uid===current.uid;
}
