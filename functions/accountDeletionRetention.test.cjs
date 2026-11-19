const test=require('node:test'),assert=require('node:assert/strict');
const r=require('./accountDeletionRetention.cjs');
test('three local business days skip weekends and preserve local time through DST',()=>{
 assert.equal(new Date(r.businessDays(Date.parse('2026-10-30T14:00:00Z'),3)).toISOString(),'2026-11-04T15:00:00.000Z');
 const d=r.deadlines(Date.parse('2026-10-30T14:00:00Z'),Date.parse('2026-11-01T15:00:00Z'),Date.parse('2026-11-07T15:00:00Z'));
 assert.equal(d.escalateAt,Date.parse('2026-11-06T15:00:00Z'));assert.equal(d.completionDueAt,Date.parse('2026-11-08T15:00:00Z'));
});
test('missing dates and incomplete policies never become executable',()=>{
 assert.equal(r.deadlines(undefined).requiresDeadlineReview,true);assert.equal(r.policyReady({ownerApproved:true,retentionDays:60}),false);
});
test('own social deletion and removal of only own comments use verified UIDs',()=>{
 assert.equal(r.plan('posts',{userId:'a'},'a').action,'delete_parent');
 const other={id:2,authorId:'b',text:'Keep'};
 assert.deepEqual(r.plan('posts',{userId:'b',comments:[{id:1,authorId:'a',text:'Remove'},other]},'a').patch.comments,[other]);
});
test('Work Order anonymization retains maintenance status and permanent ticket identity, drops free text and media',()=>{
 const p=r.plan('work_orders',{userId:'a',code:'1234',ticketNumber:1234,status:'Done',description:'Sensitive',userEmail:'private',photos:['private'],comments:[{text:'private'}]},'a');
 assert.equal(p.data.code,'1234');assert.equal(p.data.status,'Done');assert.equal(p.data.userId,undefined);assert.equal(p.data.photos,undefined);assert.equal(p.data.description,'');
});
test('chat redaction preserves other participant and messages without exposing new data',()=>{
 const other={id:'2',senderId:'b',body:'Keep private',senderName:'Other'};
 const record={identityVersion:2,participantIds:['a','b'],participants:[{id:'a',name:'Private'}, {id:'b',name:'Other'}],messages:[{id:'1',senderId:'a',body:'Remove',senderName:'Private'},other],residentId:'a',residentName:'Private',residentEmail:'secret',lastMessage:'Remove'};
 const patch=r.plan('resident_chats',record,'a').patch;
 assert.equal(patch.messages[1],other);assert.equal(patch.participantIds[1],'b');assert.equal(patch.messages[0].body,'[Removed]');assert.equal(patch.residentEmail,'');assert.equal(patch.lastMessage,'');assert.equal(record.messages[0].body,'Remove');
 assert.equal(r.plan('resident_chats',{participantIds:['legacy']},'a').action,'review');
});
test('removing a resident comment preserves another crew resolution edit index',()=>{
 const record={userId:'b',resolutionAuthorId:'crew',resolutionCommentId:'resolution',resolutionCommentIndex:1,comments:[{id:'resident',authorId:'a',text:'remove'},{id:'resolution',authorId:'crew',text:'keep'}]};
 const result=r.plan('work_orders',record,'a');assert.equal(result.patch.resolutionCommentIndex,0);assert.equal(result.patch.comments[0].id,'resolution');
});

test('secure Marketplace schema supports exact UID sides without inventing identityVersion',()=>{
 const {plan}=require('./accountDeletionRetention.cjs');
 const record={sellerId:'alice',buyerId:'bob',participantIds:['alice','bob'],messages:[{id:'one',senderId:'alice',body:'own'},{id:'two',senderId:'bob',body:'other'}]};
 const result=plan('marketplace_chats',record,'alice');assert.equal(result.action,'patch');assert.equal(result.patch.messages[1],record.messages[1]);assert.equal(result.patch.messages[0].body,'[Removed]');
 assert.equal(plan('marketplace_chats',{...record,participantIds:['legacy-name','bob']},'alice').action,'review');
 assert.equal(plan('marketplace_chats',{...record,messages:[{id:'one',senderId:'unverified-name'}]},'alice').action,'review');
});

test('private-chat leave markers and system notices redact the departed UID while preserving closed state and other residents',()=>{
 const record={identityVersion:2,participantIds:['a','b'],leftBy:{a:true,b:false},messages:[{id:'leave',type:'leave',isSystem:true,actorId:'a',senderId:'system',senderName:'System',senderRole:'system',senderAvatar:'',body:'Private Name left the conversation.',createdAt:1,time:'Now'},{id:'other',senderId:'b',body:'Keep'}]};
 const result=r.plan('resident_chats',record,'a');const alias=result.patch.participantIds[0];
 assert.equal(result.patch.leftBy.a,undefined);assert.equal(result.patch.leftBy[alias],true);assert.equal(result.patch.leftBy.b,false);
 assert.equal(result.patch.messages[0].actorId,alias);assert.equal(result.patch.messages[0].body,'A former participant left the conversation.');assert.equal(result.patch.messages[1],record.messages[1]);assert.equal(record.leftBy.a,true);
});

test('received Inbox receipts erase only the departed positive epoch audience without upgrading status',()=>{
 const record={senderId:'bob',visibility:['alice:2','bob:1','alice:bad'],receipts:{'alice:1':{readAt:1},'alice:2':{deliveredAt:2},'bob:1':{readAt:3},'alice:bad':{deliveredAt:4}},receiptState:'sent',receiptVersion:1};
 const patch=r.plan('inbox_messages',record,'alice').patch;
 assert.deepEqual(patch.visibility,['bob:1','alice:bad']);
 assert.deepEqual(patch.receipts,{'bob:1':{readAt:3},'alice:bad':{deliveredAt:4}});
 assert.equal(patch.receiptState,undefined);assert.equal(patch.receiptVersion,undefined);assert.equal(record.receipts['alice:1'].readAt,1);
 const {referencesUid}=require('./accountDeletionPolicy.cjs');assert.equal(referencesUid({receipts:{'alice:2':{readAt:1}}},'alice'),true);assert.equal(referencesUid({receipts:{'alice:bad':{}}},'alice'),false);
 assert.equal(referencesUid({...record,...patch},'alice'),false);
});
test('shared chat keeps other messages while removing deleted readers and copied peer identity',()=>{
 const other={id:'m',senderId:'bob',body:'Keep',readBy:['alice','bob']};
 const patch=r.plan('resident_chats',{identityVersion:2,messages:[other]},'alice').patch;
 assert.deepEqual(patch.messages[0].readBy,['bob']);assert.equal(patch.messages[0].body,'Keep');assert.deepEqual(other.readBy,['alice','bob']);
 const member=r.plan('inbox_memberships',{uid:'bob',peerId:'alice',name:'Alice',avatar:'data:image/private',peerAvatar:'private',conversationStatus:'open'},'alice').patch;
 assert.equal(member.avatar,'');assert.equal(member.peerAvatar,'');
});
test('notification ownership removes own state and redacts sender only on another recipient notice',()=>{
 assert.equal(r.plan('notification_state',{uid:'alice',preferences:{}},'alice').action,'delete_record');
 assert.equal(r.plan('notification_events',{uid:'alice',senderId:'bob'},'alice').action,'delete_record');
 const other={uid:'bob',senderId:'alice',target:'posts/p',seen:false};const result=r.plan('notification_events',other,'alice');
 assert.equal(result.action,'patch');assert.notEqual(result.patch.senderId,'alice');assert.equal(result.patch.uid,undefined);assert.equal(result.patch.seen,undefined);
});
test('event pending attendance and work completion UID copies are removed without removing other history',()=>{
 assert.deepEqual(r.plan('community_events',{rsvpChange:{attendee:{userId:'alice',name:'Alice'}}},'alice').patch.rsvpChange,{});
 const patch=r.plan('work_orders',{userId:'bob',completedBy:'alice',status:'Done',comments:[]},'alice').patch;assert.equal(patch.completedBy,'Deleted staff member');assert.equal(patch.status,undefined);
});
