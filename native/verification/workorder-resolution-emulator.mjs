// Local emulator only.
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase/app';
import {getFirestore,connectFirestoreEmulator,doc,setDoc,getDoc,updateDoc,deleteField,serverTimestamp,terminate} from 'firebase/firestore';
import {resolutionPatch,readWorkOrder} from '../src/workorders/model.ts';
const clients=[];
function client(uid){const app=initializeApp({projectId:'demo-townloop-resolution',apiKey:'fake'},uid);const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8189,{mockUserToken:uid==='owner'?'owner':{sub:uid,user_id:uid}});clients.push({app,db});return db;}
const admin=client('owner'),crew=client('crew'),other=client('other'),resident=client('resident');
const user={id:'crew',name:'Crew',role:'crew',email:'crew@example.invalid'};
const ref=db=>doc(db,'work_orders','revision-test');
const reopen={status:'In Progress',completedAt:deleteField(),completedBy:deleteField(),retentionVersion:deleteField(),resolutionNote:deleteField()};
async function complete(text){return {...resolutionPatch(readWorkOrder('revision-test',(await getDoc(ref(crew))).data()),user,{id:'original',author:'Crew',role:'Maintenance Crew',text,timestamp:'Today',photoUrl:''},new Date().toISOString()),completedAt:serverTimestamp(),retentionVersion:1};}
try{
for(const [id,role,name] of [['crew','crew','Crew'],['other','crew','Other'],['resident','resident','Resident']])await setDoc(doc(admin,'users',id),{role,name,approved:true});
await setDoc(ref(admin),{userId:'resident',status:'Queued',comments:[],createdAt:1});
await updateDoc(ref(crew),await complete('Fixed sink'));
await updateDoc(ref(crew),reopen);
const revision=await complete('Replaced washer');
await assert.rejects(updateDoc(ref(other),{...revision,completedBy:'Other'}),{code:'permission-denied'});
await assert.rejects(updateDoc(ref(resident),revision),{code:'permission-denied'});
await updateDoc(ref(crew),revision);
const result=(await getDoc(ref(crew))).data();assert.equal(result.comments.length,1);assert.equal(result.comments[0].revisions[0].text,'Fixed sink');
await updateDoc(ref(crew),reopen);
const tampered=await complete('Changed');tampered.comments[0].revisions=[];
await assert.rejects(updateDoc(ref(crew),tampered),{code:'permission-denied'});
const legacy={id:'legacy',author:'Crew',role:'Maintenance Crew',text:'Old fix',timestamp:'Yesterday',photoUrl:''};
await setDoc(ref(admin),{userId:'resident',status:'Done',comments:[legacy],resolutionNote:'Old fix',completedBy:'Crew',completedAt:serverTimestamp(),retentionVersion:1});
await updateDoc(ref(crew),{...reopen,resolutionCommentId:'legacy',resolutionCommentIndex:0,resolutionAuthorId:'crew'});
await updateDoc(ref(crew),await complete('Corrected legacy fix'));
assert.equal((await getDoc(ref(crew))).data().comments.length,1);
console.log('PASS: completion, reopen, revision, legacy migration; other crew/resident/history tampering denied.');
}finally{await Promise.all(clients.map(async({app,db})=>{await terminate(db);await deleteApp(app);}));}
