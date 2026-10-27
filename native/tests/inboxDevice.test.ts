// Executes the actual device lifecycle with native/transport boundaries replaced.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import * as protocol from '../src/notifications/protocol.ts';
const require=createRequire(import.meta.url),ts=require('typescript');
function fixture(){
 const storage=new Map<string,string>(),calls:any[]=[];let token='ExpoPushToken[old]',fail=false,granted=true,tokenRequests=0;let tokenHook=()=>{};
 const auth={currentUser:{uid:'b'}},notifications={getPermissionsAsync:async()=>({granted,canAskAgain:false}),getExpoPushTokenAsync:async()=>{tokenRequests++;tokenHook();return {data:token};},setNotificationChannelAsync:async()=>{},AndroidImportance:{DEFAULT:3},AndroidNotificationVisibility:{PRIVATE:0},dismissAllNotificationsAsync:async()=>{},setBadgeCountAsync:async(n:number)=>{calls.push({badge:n});},unregisterForNotificationsAsync:async()=>{},IosAuthorizationStatus:{PROVISIONAL:3}};
 const deps:any={
  'react-native':{Platform:{OS:'android'}},expo:{requireOptionalNativeModule:()=>({})},'expo-secure-store':{AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:1,getItemAsync:async(k:string)=>storage.get(k)||null,setItemAsync:async(k:string,v:string)=>{storage.set(k,v);},deleteItemAsync:async(k:string)=>{storage.delete(k);}},
  'expo-crypto':{randomUUID:()=> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',CryptoDigestAlgorithm:{SHA256:1},digestStringAsync:async()=> 'a'.repeat(64)},'expo-constants':{default:{easConfig:{projectId:'test'}}},
  'firebase/functions':{getFunctions:()=>({}),httpsCallable:(_:any,name:string)=>async(data:any)=>{calls.push({...data,callable:name});if(fail)throw Error('offline');return {data:name==='getNotificationState'?{counts:{inbox:2,marketplace:1,discussion:3,workorders:4}}:{registered:true,protocolVersion:2}};}},'../lib/firebase':{app:{},auth},'./protocol':protocol,'expo-notifications':notifications,
 };
 const output=ts.transpileModule(fs.readFileSync(new URL('../src/notifications/device.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};vm.runInNewContext(output,{module,exports:module.exports,require:(id:string)=>{assert(id in deps,id);return deps[id];},setTimeout,clearTimeout,Promise});
 return {device:module.exports as any,calls,storage,token:(s:string)=>{token=s;},fail:(s:boolean)=>{fail=s;},permission:(s:boolean)=>{granted=s;},tokenRequests:()=>tokenRequests,changeDuringToken:()=>{tokenHook=()=>{auth.currentUser.uid='other';};}};
}
test('failed rotation retains retired-token recovery until registration succeeds',async()=>{
 const h=fixture();await h.device.syncDevice('b',true);h.token('ExpoPushToken[new]');h.fail(true);await assert.rejects(()=>h.device.syncDevice('b',true));
 h.fail(false);await h.device.syncDevice('b',true);assert.deepEqual(Array.from(h.calls.at(-1).previousTokens),['ExpoPushToken[old]']);
 const state=JSON.parse(h.storage.get('townloop.inbox.registration')!);assert.deepEqual(state.previousTokens,[]);
});
test('offline disable suppresses binding locally and retains protected revocation for retry',async()=>{
 const h=fixture();await h.device.syncDevice('b',true);assert(await h.device.binding('b'));h.fail(true);
 await assert.rejects(()=>h.device.syncDevice('b',false));assert.equal(await h.device.binding('b'),'');
 assert.equal(JSON.parse(h.storage.get('townloop.inbox.registration')!).enabled,false);
 h.fail(false);await h.device.revoke();assert.equal(h.storage.has('townloop.inbox.registration'),false);
});
test('denied permission never requests a token; account change before registration cannot enroll old user',async()=>{
 const h=fixture();h.permission(false);assert.equal(await h.device.syncDevice('b',true),'denied');assert.equal(h.tokenRequests(),0);assert.equal(h.calls.length,0);
 const changed=fixture();changed.changeDuringToken();assert.equal(await changed.device.syncDevice('b',true),'off');assert.equal(changed.calls.length,0);
});

test('four categories survive account-scoped storage and badge updates; cleanup removes only the affected account',async()=>{
 const h=fixture();await h.device.setPreference('b',true);await h.device.setCategoryPreference('b','discussion',false);
 assert.equal((await h.device.categoryPreferences('b')).discussion,false);assert.equal((await h.device.categoryPreferences('other')).inbox,false);
 await h.device.syncDevice('b',true);assert.equal(h.calls.find((d:any)=>d.callable==='registerInboxDevice').preferences.workorders,true);
 await h.device.refreshBadge('b');assert.equal(h.calls.at(-1).badge,7);
 await h.device.setPreference('other',true);await h.device.clearPushAccount('b');
 assert.equal((await h.device.categoryPreferences('b')).inbox,false);assert.equal((await h.device.categoryPreferences('other')).inbox,true);
});
test('failed read acknowledgment remains encrypted and retries before count refresh; other accounts cannot consume it',async()=>{
 const h=fixture();await h.device.setPreference('b',true);h.fail(true);
 await assert.rejects(()=>h.device.refreshBadge('b',{category:'discussion',conversationId:'post'}));
 assert.equal(JSON.parse(h.storage.get('townloop.notifications.reads.b')!).length,1);
 const count=h.calls.length;await h.device.refreshBadge('other');assert.equal(h.calls.length,count);
 h.fail(false);await h.device.refreshBadge('b');
 assert.equal(h.calls.filter((v:any)=>v.callable==='getNotificationState').at(-1).ack.conversationId,'post');
 assert.equal(JSON.parse(h.storage.get('townloop.notifications.reads.b')!).length,0);
});
