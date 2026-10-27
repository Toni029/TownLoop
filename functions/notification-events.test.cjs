const test=require('node:test'),assert=require('node:assert/strict');
const {contentEvent,preferences}=require('./notification-events.cjs');
function fixture(collection='discussion_feed'){
 const now=Date.now(),sender={id:'author',role:'resident',approved:true};
 const before={userId:'owner',storageDraft:false,comments:[{id:'parent',authorId:'other',text:'private'}],status:'In Progress'};
 const after={...before,comments:[...before.comments,{id:'new',authorId:'author',text:'private',replyToCommentId:'parent'}],status:'Done',completedAt:new Date(now)};
 const event={authId:'author',authType:'unknown',time:new Date(now).toISOString(),params:{documentId:'document'},data:{before:{data:()=>before},after:{data:()=>after}}};
 return {now,sender,before,after,event,run:()=>contentEvent(event,collection,sender,now)};
}
test('new discussion comment/reply notifies post owner and proven parent author, never sender; no content in descriptor',()=>{
 const h=fixture();assert.deepEqual(h.run().recipientIds,['owner','other']);assert(!JSON.stringify(h.run()).includes('private'));
 h.after.userId=h.before.userId='author';assert.deepEqual(h.run().recipientIds,['other']);
});
test('creation, edits, removal, forged authors, ambiguous reply identities and stale events produce no notification',()=>{
 for(const mode of ['creation','edit','delete','forged','legacy','stale','draft']){const h=fixture();
 if(mode==='creation')h.event.data.before.data=()=>undefined;
 if(mode==='edit')h.after.comments[0]={...h.after.comments[0],text:'changed'};
 if(mode==='delete')h.after.comments=[];
 if(mode==='forged')h.after.comments.at(-1).authorId='other';
 if(mode==='legacy')h.before.comments[0].authorId='';
 if(mode==='stale')h.event.time=new Date(h.now-3600001).toISOString();
 if(mode==='draft')h.after.storageDraft=true;
 assert.equal(h.run(),null,mode);}
});
test('Work Order only a fresh authorized completion transition; repeated Done updates and residents denied',()=>{
 const h=fixture('work_orders');assert.equal(h.run(),null);h.sender.role='crew';assert.equal(h.run().category,'workorders');
 h.before.status='Done';assert.equal(h.run(),null);h.before.status='Queued';h.after.userId='different';assert.equal(h.run(),null);
});
test('explicit four-category preferences; older devices opt into no new categories',()=>{
 assert.deepEqual(preferences(),{inbox:true,marketplace:true,discussion:false,workorders:false});
 assert.throws(()=>preferences({discussion:'true'}),/invalid-argument/);
 assert.equal(preferences({discussion:true}).discussion,true);assert.equal(preferences({discussion:true}).inbox,false);
});
