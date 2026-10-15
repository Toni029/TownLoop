/** Disposable local emulator only; exercises the native RSVP patch against real rules. */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { rsvpPatch } from '../src/news/model.ts';
if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
const require = createRequire(process.argv[2]);
const {initializeTestEnvironment, assertSucceeds, assertFails} = require('@firebase/rules-unit-testing');
const {doc, setDoc, getDoc, updateDoc, runTransaction, serverTimestamp} = require('firebase/firestore');
const env = await initializeTestEnvironment({projectId:'demo-townloop-rsvp',firestore:{rules:readFileSync(new URL('../../firestore.rules',import.meta.url),'utf8')}});
const users = Object.fromEntries(['resident','other','crew','admin','vip','pending'].map(id=>[id,{id,name:id,email:id+'@example.invalid',role:id==='other'||id==='pending'?'resident':id,approved:id!=='pending'}]));
const base={title:'Test event',attendees:[],attendeesCount:0,spotsLeft:2};
const dbFor=id=>env.authenticatedContext(id).firestore();
const eventRef=db=>doc(db,'community_events','test');
async function change(id,going){const db=dbFor(id);return runTransaction(db,async tx=>{const ref=eventRef(db);const snap=await tx.get(ref);const patch=rsvpPatch(snap.data(),users[id],going,Date.now());if(patch)tx.update(ref,{...patch,updatedAt:serverTimestamp()});});}
try {
 await env.withSecurityRulesDisabled(async ctx=>{for(const user of Object.values(users))await setDoc(doc(ctx.firestore(),'users',user.id),user);await setDoc(eventRef(ctx.firestore()),base);});
 await assertSucceeds(change('resident',true));
 await assertSucceeds(change('crew',true));
 for(const id of ['admin','vip']) {const snap=await assertSucceeds(getDoc(eventRef(dbFor(id))));assert.deepEqual(snap.data().attendees.map(a=>a.id),['crew','resident']);}
 await assert.rejects(change('other',true),/available spots/);
 await assertFails(updateDoc(eventRef(dbFor('resident')),{title:'Forged event'}));
 const current=(await getDoc(eventRef(dbFor('resident')))).data();
 await assertFails(updateDoc(eventRef(dbFor('resident')),rsvpPatch(current,users.crew,false,1)));
 const own=current.attendees.find(a=>a.id==='resident');
 await assertFails(updateDoc(eventRef(dbFor('resident')),{attendees:[own,...current.attendees],attendeesCount:3,rsvpMembers:current.rsvpMembers,rsvpChange:{going:true,attendee:own},spotsLeft:0}));
 await assertSucceeds(change('resident',false));
 await assertSucceeds(change('resident',true));
 await assertFails(change('pending',true));
 await assertFails(getDoc(eventRef(env.unauthenticatedContext().firestore())));
 await assertSucceeds(updateDoc(eventRef(dbFor('admin')),{title:'Admin update'}));
 await assertSucceeds(updateDoc(eventRef(dbFor('vip')),{title:'VIP update'}));
 const after=(await getDoc(eventRef(dbFor('admin')))).data();assert.equal(after.attendeesCount,2);assert.equal(after.spotsLeft,0);
 console.log('PASS: resident and crew RSVP/cancel, admin/VIP roster, capacity, duplicates, ownership, approval and event-edit restrictions');
} finally {await env.cleanup();}
