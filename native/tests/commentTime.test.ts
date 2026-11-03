import test from 'node:test';
import assert from 'node:assert/strict';
import {commentTime,commentSubmissionId} from '../src/time/commentTime.ts';
const now=new Date(2026,9,29,18,0).getTime(),hour=3_600_000;
test('Discussion comment ages use calendar days and requested wording',()=>{
 for(const [age,label]of [[0,'today'],[1,'today'],[2,'today'],[12,'today'],[12.1,'today'],[24,'yesterday'],[48,'2 days ago'],[72,'3 days ago'],[168,'a week ago'],[336,'2 weeks ago']]as const){
  const id=commentSubmissionId('fixture',now-age*hour);assert.equal(commentTime({id},now),label);
 }
});
test('submission timestamps survive retries and known dates are used without inventing legacy dates',()=>{
 const id=commentSubmissionId('stable-random-id',now);assert.equal(commentSubmissionId(id,now+hour),id);assert.equal(commentTime({id},now+hour),'today');
 assert.equal(commentTime({id:'random',createdAt:now-2*hour},now),'today');
 assert.equal(commentTime({id:'random',timeAgo:new Date(now-hour).toISOString()},now),'today');
 assert.equal(commentTime({id:'old-random',timeAgo:'Just now'},now),'');
});

test('calendar labels respect midnight and daylight-saving boundaries',()=>{
 const current=new Date(2026,10,2,0,5).getTime();
 assert.equal(commentTime({id:'fixture',createdAt:new Date(2026,10,1,23,55).getTime()},current),'yesterday');
 assert.equal(commentTime({id:'fixture',createdAt:new Date(2026,9,31,23,55).getTime()},current),'2 days ago');
});
