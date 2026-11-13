import {readProfile} from '../src/lib/profile.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationMessage, registrationRemaining, terminalRegistration, registrationReminderSummary} from '../src/lib/registrationModel.ts';
const day=86400000;
test('legacy intake never invents an automatic expiry',()=>{
 assert.match(registrationMessage({approved:false}),/no automatic expiry/i);
 assert.match(registrationRemaining(null,0,true),/individual review/i);
});
test('staff reminder banner reflects server stages and remaining time uses server expiry',()=>{
 assert.equal(registrationReminderSummary([]),null);
 assert.match(registrationReminderSummary([{reminderStage:'day7'},{reminderStage:'day12'},{reminderStage:'day12'}])!,/1 at day 7 · 2 at day 12/);
 assert.equal(registrationRemaining(15*day,13*day,false),'2 days remaining');
 assert.match(registrationRemaining(15*day,15*day,false),/awaiting server cleanup/);
});
test('terminal states do not grant approved access and explain the result',()=>{
 assert.equal(readProfile({approved:true,registrationStatus:'denied'}).approved,false);
 assert.equal(readProfile({approved:true,registrationStatus:'expired'}).approved,false);
 assert.equal(terminalRegistration({registrationStatus:'denied'}),true);
 assert.equal(terminalRegistration({registrationStatus:'expired'}),true);
 assert.equal(terminalRegistration({registrationStatus:'pending'}),false);
 assert.match(registrationMessage({registrationStatus:'expired'}),/expired/);
});
test('server deadline shows expiration before the scheduled worker runs, without expiring approved profiles',()=>{assert.match(registrationMessage({registrationVersion:1,registrationStatus:'pending',registrationExpiresAt:{toMillis:()=>100}},100),/expired/);assert.doesNotMatch(registrationMessage({registrationVersion:1,registrationStatus:'approved',registrationExpiresAt:{toMillis:()=>100}},101),/expired/);});
