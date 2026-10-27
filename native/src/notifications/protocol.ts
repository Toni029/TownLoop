export type InboxTarget={category:'friend'|'office'|'maintenance'|'marketplace'|'discussion'|'workorders';conversationId:string;deviceBinding:string;commentId?:string;noticeId?:string};
export function inboxTarget(data:Record<string,unknown>|undefined):InboxTarget|null {
 if(data?.type==='notice'){
  if(typeof data.noticeId!=='string'||!/^[a-f0-9]{64}$/.test(data.noticeId))return null;
  const target=inboxTarget({...data,type:'inbox',conversationId:data.noticeId});
  return target?{...target,noticeId:data.noticeId}:null;
 }
 if(!data||data.type!=='inbox'||!['friend','office','maintenance','marketplace','discussion','workorders'].includes(String(data.category))||
  typeof data.conversationId!=='string'||!data.conversationId||data.conversationId.length>512||data.conversationId.includes('/')||
  typeof data.deviceBinding!=='string'||!/^[a-f0-9]{64}$/.test(data.deviceBinding))return null;
 return {category:data.category as InboxTarget['category'],conversationId:data.conversationId,deviceBinding:data.deviceBinding,...(typeof data.commentId==='string'&&data.commentId.length<=200&&!data.commentId.includes('/')?{commentId:data.commentId}:{})};
}
export const collectionFor={friend:'resident_chats',office:'office_chats',maintenance:'maintenance_chats',marketplace:'marketplace_chats',discussion:'discussion_feed',workorders:'work_orders'} as const;
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

export const notificationCategories=['inbox','marketplace','discussion','workorders'] as const;
export type NotificationCategory=typeof notificationCategories[number];
export type NotificationPreferences=Record<NotificationCategory,boolean>;
export const emptyPreferences:NotificationPreferences={inbox:false,marketplace:false,discussion:false,workorders:false};
export const preferenceCategory=(target:InboxTarget):NotificationCategory=>target.category==='friend'||target.category==='office'||target.category==='maintenance'?'inbox':target.category;
export const isPrivateInbox=(target:InboxTarget|null|undefined)=>!!target&&['friend','office','maintenance'].includes(target.category);
