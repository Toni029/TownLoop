import test from 'node:test';
import assert from 'node:assert/strict';
import {relativePostedTime} from '../src/time/relativePostedTime.ts';
const now=Date.parse('2026-10-26T18:00:00Z'),hour=3_600_000;
test('submission ages follow the requested hour/day/week thresholds',()=>{
 for(const [age,label] of [[0,'Just listed'],[0.99,'Just listed'],[1,'1 hour ago'],[2,'2 hours ago'],[12,'12 hours ago'],[12.01,'Posted today'],[23.99,'Posted today'],[24,'Posted yesterday'],[47.99,'Posted yesterday'],[48,'Posted 2 days ago'],[144,'Posted 6 days ago'],[168,'Posted a week ago'],[336,'Posted 2 weeks ago'],[720,'Posted a month ago'],[8760,'Posted a year ago']] as const){assert.equal(relativePostedTime(now-age*hour,now),label);}
});
test('unknown dates stay unknown, pending work orders use request language, and labels advance',()=>{
 assert.equal(relativePostedTime(0,now),'Date unavailable');assert.equal(relativePostedTime(NaN,now),'Date unavailable');
 assert.equal(relativePostedTime(now,now,'Just requested'),'Just requested');
 assert.equal(relativePostedTime(now,now+2*hour),'2 hours ago');
 assert.equal(relativePostedTime(now+hour,now),'Just listed');
});
