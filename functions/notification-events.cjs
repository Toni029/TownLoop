// Event descriptors contain identifiers only; never store comment/message bodies.
const {isDeepStrictEqual}=require('node:util');
const {approved}=require('./inbox-policy.cjs');
const id=value=>typeof value==='string'&&value.length>0&&value.length<=200&&!value.includes('/');
const recent=(event,now)=>Number.isFinite(Date.parse(event.time))&&Math.abs(now-Date.parse(event.time))<=3600000;
function contentEvent(event,collection,sender,now=Date.now()){
 const before=event.data?.before.data(),after=event.data?.after.data();
 if(!before||!after||!approved(sender)||sender.id!==event.authId||!recent(event,now)||['system','unauthenticated','service_account'].includes(event.authType))return null;
 const documentId=event.params.documentId;if(!id(documentId))return null;
 if(collection==='work_orders'){
  if(before.status==='Done'||after.status!=='Done'||!['crew','admin','vip'].includes(sender.role)||!id(after.userId)||after.userId!==before.userId)return null;
  // The completion timestamp is required; one transition has a stable key even on retry.
  const completed=after.completedAt?.toMillis?.()??Date.parse(after.completedAt);
  if(!Number.isFinite(completed)||Math.abs(completed-Date.parse(event.time))>60000)return null;
  return {category:'workorders',collection,documentId,eventId:`done-${completed}`,recipientIds:[after.userId],senderId:sender.id,body:'Your Work Order has been completed.'};
 }
 if(collection!=='discussion_feed'||after.storageDraft!==false||after.userId!==before.userId||!id(after.userId))return null;
 const old=before.comments||[],next=after.comments;
 if(!Array.isArray(old)||!Array.isArray(next)||next.length!==old.length+1||!isDeepStrictEqual(next.slice(0,-1),old))return null;
 const comment=next.at(-1);
 if(!comment||!id(comment.id)||old.some(c=>c.id===comment.id)||comment.authorId!==sender.id||typeof comment.text!=='string'||!comment.text.trim())return null;
 const recipients=new Set([after.userId]);
 if(comment.replyToCommentId){
  const parent=old.find(c=>String(c.id)===comment.replyToCommentId);
  if(!parent||!id(parent.authorId))return null; // Never infer identity from names.
  recipients.add(parent.authorId);
 }
 recipients.delete(sender.id);
 return {category:'discussion',collection,documentId,eventId:comment.id,commentId:comment.id,recipientIds:[...recipients],senderId:sender.id,body:'Someone commented on your discussion.'};
}
const channelFor=category=>category==='marketplace'?'marketplace':category==='discussion'?'discussion':category==='workorders'?'workorders':'inbox';
const defaults={inbox:true,marketplace:true,discussion:false,workorders:false};
function preferences(data){
 if(data===undefined)return {...defaults};
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!Object.hasOwn(defaults,k))||Object.values(data).some(v=>typeof v!=='boolean'))throw Error('invalid-argument');
 return Object.fromEntries(Object.keys(defaults).map(k=>[k,data[k]===true]));
}
module.exports={contentEvent,channelFor,preferences,id,recent};
