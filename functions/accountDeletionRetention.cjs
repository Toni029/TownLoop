const { createHash } = require('node:crypto');
const DAY = 86400000;
const POLICY_ID = 'townloop-request-deletion-2026-10-25';
const ZONE = 'America/New_York';
const SOCIAL = new Set(['discussion_feed', 'posts', 'marketplace_posts', 'marketItems']);
const CHATS = new Set(['resident_chats', 'office_chats', 'maintenance_chats', 'marketplace_chats']);
const REASONS = new Set(['identity_verification', 'legal_obligation', 'security_investigation', 'requester_withdrawal']);
const millis = value => typeof value?.toMillis === 'function' ? value.toMillis() : value instanceof Date ? value.getTime() : typeof value === 'number' ? value : NaN;
function parts(ms) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: ZONE, year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric',hourCycle:'h23' }).formatToParts(ms).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
function calendarDays(ms, count) {
  const p=parts(ms), desired=Date.UTC(p.year,p.month-1,p.day+count,p.hour,p.minute,p.second);
  let guess=desired;
  for(let i=0;i<4;i++) { const a=parts(guess);guess+=desired-Date.UTC(a.year,a.month-1,a.day,a.hour,a.minute,a.second); }
  return guess;
}
function businessDays(ms, count) {
  let next=ms;
  while(count) { next=calendarDays(next,1);const p=parts(next);const day=new Date(Date.UTC(p.year,p.month-1,p.day)).getUTCDay();if(day!==0&&day!==6)count--; }
  return next;
}
function deadlines(createdAt, approvedAt, now=Date.now()) {
  const created=millis(createdAt), approved=millis(approvedAt);
  if(!Number.isFinite(created)) return { requiresDeadlineReview:true };
  const reviewDueAt=businessDays(created,3), escalateAt=calendarDays(created,7), retentionDueAt=calendarDays(created,60);
  const completionDueAt=Number.isFinite(approved)?Math.min(calendarDays(approved,7),retentionDueAt):null;
  return { reviewDueAt, escalateAt, retentionDueAt, completionDueAt,
    reviewOverdue:!Number.isFinite(approved)&&now>reviewDueAt, escalated:!Number.isFinite(approved)&&now>=escalateAt,
    processingOverdue:completionDueAt!==null&&now>completionDueAt, retentionOverdue:now>retentionDueAt };
}
function policyReady(policy) {
  return policy?.ownerApproved===true && policy.policyVersion===2 && policy.approvalReference===POLICY_ID &&
    policy.identityCoverageVerified===true && policy.mediaCoverageVerified===true && policy.databaseScopeVerified===true &&
    policy.retentionDays===60 && policy.reviewBusinessDays===3 && policy.escalationCalendarDays===7 && policy.completionCalendarDays===7;
}
const pseudonym = uid => `deleted_${createHash('sha256').update(uid).digest('hex').slice(0,24)}`;
const own = (record,uid) => record.userId===uid && (record.authorId==null||record.authorId===uid) || record.userId==null&&record.authorId===uid;
const authored = (value,uid) => value?.authorId===uid||value?.senderId===uid||value?.userId===uid;
function withoutOwnComments(record,uid) {
  if(!Array.isArray(record.comments))return {};
  return {comments:record.comments.filter(c=>!authored(c,uid))};
}
/** Return a minimal explicit patch, never recursively erase another person's text. */
function plan(collection, record, uid) {
  if(SOCIAL.has(collection)) {
    if(own(record,uid))return {action:'delete_parent'};
    const patch=withoutOwnComments(record,uid);
    if(record.likedBy&&typeof record.likedBy==='object')patch.likedBy=Object.fromEntries(Object.entries(record.likedBy).filter(([id])=>id!==uid));
    if(patch.likedBy&&typeof record.likes==='number'&&record.likedBy[uid]===true)patch.likes=Math.max(0,record.likes-1);
    return {action:'patch',patch};
  }
  if(collection==='work_orders') {
    if(record.userId===uid) {
      const keep=['code','ticketNumber','category','categoryEmoji','status','createdAt','completedAt','retentionVersion'];
      return {action:'replace',data:{...Object.fromEntries(keep.filter(k=>record[k]!==undefined).map(k=>[k,record[k]])),title:'Maintenance record',description:'',unit:'',comments:[],userName:'Deleted resident'}};
    }
    const patch=withoutOwnComments(record,uid);
    if(patch.comments && record.resolutionCommentId != null && record.resolutionAuthorId !== uid) {
      const index=patch.comments.findIndex(c=>c.id===record.resolutionCommentId);
      if(index>=0)patch.resolutionCommentIndex=index;else return {action:'review',reason:'resolution_identity_requires_review'};
    }
    if(record.resolutionAuthorId===uid) Object.assign(patch,{resolutionAuthorId:'',resolutionCommentId:'',resolutionCommentIndex:-1,resolutionNote:'',completedBy:'Deleted staff member'});
    return {action:'patch',patch};
  }
  if(CHATS.has(collection)) {
    // Marketplace's secure protocol uses exact seller/buyer UIDs, not identityVersion.
    const sides = [record.sellerId, record.buyerId];
    const canonicalMarketplace = collection === 'marketplace_chats' &&
      sides.every(id=>typeof id==='string' && id.length>0 && !id.includes('/')) && sides[0]!==sides[1] &&
      Array.isArray(record.participantIds) && record.participantIds.length===2 &&
      record.participantIds.every(id=>sides.includes(id)) && new Set(record.participantIds).size===2 &&
      Array.isArray(record.messages) && record.messages.every(message=>sides.includes(message.senderId));
    if(record.identityVersion!==2 && !canonicalMarketplace) return {action:'review',reason:'legacy_chat_identity'};
    const alias=pseudonym(uid), patch={lastMessage:'',subject:'Conversation'};
    if(Array.isArray(record.messages)) patch.messages=record.messages.map(message=>message.senderId===uid
      ? {id:message.id,senderId:alias,senderName:'Deleted resident',senderAvatar:'',...(message.body!==undefined?{body:'[Removed]'}:{text:'[Removed]'}),...(message.timestamp!==undefined?{timestamp:message.timestamp}:{}),...(message.createdAt!==undefined?{createdAt:message.createdAt}:{}),...(message.time!==undefined?{time:message.time}:{})}
      : message);
    if(Array.isArray(record.participantIds))patch.participantIds=record.participantIds.map(id=>id===uid?alias:id);
    if(Array.isArray(record.participants))patch.participants=record.participants.map(p=>p.id===uid?{id:alias,name:'Deleted resident',avatar:''}:p);
    for(const side of ['seller','buyer','resident'])if(record[`${side}Id`]===uid) {
      patch[`${side}Id`]=alias;
      for(const field of ['Name','Avatar','Apt','Email','Phone','Address'])if(`${side}${field}` in record)patch[`${side}${field}`]=field==='Name'?'Deleted resident':'';
      if(side==='seller')Object.assign(patch,{itemTitle:'Removed listing',itemMediaUrl:''});
    }
    for(const key of ['unreadBy','deletedBy','leftBy'])if(Array.isArray(record[key]))patch[key]=record[key].filter(id=>id!==uid);
    for(const key of ['readBy','readCursors','likedBy'])if(record[key]&&typeof record[key]==='object'&&!Array.isArray(record[key]))patch[key]=Object.fromEntries(Object.entries(record[key]).filter(([id])=>id!==uid));
    return {action:'patch',patch};
  }
  if(collection==='community_events') {
    const patch={};
    if(Array.isArray(record.attendees)) {patch.attendees=record.attendees.filter(a=>a.id!==uid&&a.userId!==uid);patch.attendeesCount=patch.attendees.length;if(typeof record.spotsLeft==='number')patch.spotsLeft=record.spotsLeft+record.attendees.length-patch.attendees.length;}
    if(record.rsvpMembers)patch.rsvpMembers=Object.fromEntries(Object.entries(record.rsvpMembers).filter(([id])=>id!==uid));
    if(record.createdBy===uid)patch.createdBy=pseudonym(uid);
    if(record.rsvpChange?.attendee?.id===uid)patch.rsvpChange={};
    return {action:'patch',patch};
  }
  if(['moderation_reports','moderation_audit','notification_deliveries'].includes(collection)) {
    const keep=['status','kind','action','createdAt','handledAt'];
    return {action:'replace_audit',data:Object.fromEntries(keep.filter(k=>record[k]!==undefined).map(k=>[k,record[k]]))};
  }
  // Free-form audit/newsletter references cannot be safely redacted without a known schema.
  return {action:'review',reason:'category_specific_redaction_required'};
}
module.exports={DAY,POLICY_ID,REASONS,SOCIAL,CHATS,millis,calendarDays,businessDays,deadlines,policyReady,plan};
