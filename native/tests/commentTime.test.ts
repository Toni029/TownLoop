import test from 'node:test';
import assert from 'node:assert/strict';
import {commentTime,commentSubmissionId} from '../src/time/commentTime.ts';
const now=Date.parse('2026-10-29T18:00:00Z'),hour=3_600_000;
test('Discussion comment ages use the existing Marketplace thresholds and requested wording',()=>{
 for(const [age,label]of [[0,'Just now'],[1,'1 hour ago'],[2,'2 hours ago'],[12,'12 hours ago'],[12.1,'today'],[24,'yesterday'],[48,'2 days ago'],[72,'3 days ago'],[168,'a week ago'],[336,'2 weeks ago']]as const){
  const id=commentSubmissionId('fixture',now-age*hour);assert.equal(commentTime({id},now),label);
 }
});
test('submission timestamps survive retries and known dates are used without inventing legacy dates',()=>{
 const id=commentSubmissionId('stable-random-id',now);assert.equal(commentSubmissionId(id,now+hour),id);assert.equal(commentTime({id},now+hour),'1 hour ago');
 assert.equal(commentTime({id:'random',createdAt:now-2*hour},now),'2 hours ago');
 assert.equal(commentTime({id:'random',timeAgo:new Date(now-hour).toISOString()},now),'1 hour ago');
 assert.equal(commentTime({id:'old-random',timeAgo:'Just now'},now),'Date unavailable');
});
