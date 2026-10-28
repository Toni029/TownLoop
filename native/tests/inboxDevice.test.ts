// Executes the actual device lifecycle with native/transport boundaries replaced.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import * as protocol from '../src/notifications/protocol.ts';
const require=createRequire(import.meta.url),ts=require('typescript');
function fixture(storage=new Map<string,string>()){
 const installation=new Map<string,string>();
 const calls:any[]=[];let token='ExpoPushToken[old]',fail=false,granted=true,tokenRequests=0,permissionRequests=0,status='denied',canAsk=false;let tokenHook=()=>{};
 const auth={currentUser:{uid:'b'}},notifications={getPermissionsAsync:async()=>({granted,status:granted?'granted':status,canAskAgain:canAsk}),requestPermissionsAsync:async()=>{permissionRequests++;return {granted,status:granted?'granted':status,canAskAgain:false};},getExpoPushTokenAsync:async()=>{tokenRequests++;tokenHook();return {data:token};},setNotificationChannelAsync:async()=>{},AndroidImportance:{DEFAULT:3},AndroidNotificationVisibility:{PRIVATE:0},dismissAllNotificationsAsync:async()=>{},setBadgeCountAsync:async(n:number)=>{calls.push({badge:n});},unregisterForNotificationsAsync:async()=>{},IosAuthorizationStatus:{PROVISIONAL:3}};
 const deps:any={
  '@react-native-async-storage/async-storage':{getItem:async(k:string)=>installation.get(k)||null,setItem:async(k:string,v:string)=>{installation.set(k,v);},removeItem:async(k:string)=>{installation.delete(k);}},
  'react-native':{Platform:{OS:'android',Version:35}},expo:{requireOptionalNativeModule:()=>({})},'expo-secure-store':{AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:1,getItemAsync:async(k:string)=>storage.get(k)||null,setItemAsync:async(k:string,v:string)=>{storage.set(k,v);},deleteItemAsync:async(k:string)=>{storage.delete(k);}},
  'expo-crypto':{randomUUID:()=> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',CryptoDigestAlgorithm:{SHA256:1},digestStringAsync:async()=> 'a'.repeat(64)},'expo-constants':{default:{easConfig:{projectId:'test'}}},
  'firebase/functions':{getFunctions:()=>({}),httpsCallable:(_:any,name:string)=>async(data:any)=>{calls.push({...data,callable:name});if(fail)throw Error('offline');return {data:name==='getNotificationState'?{counts:{inbox:2,marketplace:1,discussion:3,workorders:4}}:{registered:true,protocolVersion:2}};}},'../lib/firebase':{app:{},auth},'./protocol':protocol,'expo-notifications':notifications,
 };
 const output=ts.transpileModule(fs.readFileSync(new URL('../src/notifications/device.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};vm.runInNewContext(output,{module,exports:module.exports,require:(id:string)=>{assert(id in deps,id);return deps[id];},setTimeout,clearTimeout,Promise});
 return {device:module.exports as any,calls,storage,signOut:()=>{(auth as any).currentUser=null;},platform:deps['react-native'].Platform,nativePermission:(value:string,ask=true)=>{granted=value==='granted';status=value;canAsk=ask;},permissionRequests:()=>permissionRequests,token:(s:string)=>{token=s;},fail:(s:boolean)=>{fail=s;},permission:(s:boolean)=>{granted=s;},tokenRequests:()=>tokenRequests,changeDuringToken:()=>{tokenHook=()=>{auth.currentUser.uid='other';};}};
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


test('only the native prompt is requested once, without modifying any account preferences',async()=>{
 const h=fixture();h.nativePermission('undetermined');
 await h.device.setCategoryPreference('b','marketplace',true);
 const before=JSON.stringify(await h.device.categoryPreferences('b'));
 await h.device.requestNativeNotificationPermission('b');
 await h.device.requestNativeNotificationPermission('b');
 assert.equal(h.permissionRequests(),1);
 assert.equal(JSON.stringify(await h.device.categoryPreferences('b')),before);
 assert.equal(h.tokenRequests(),0);
 for(const status of ['denied','granted']){
  const d=fixture();d.nativePermission(status);
  await d.device.requestNativeNotificationPermission('b');
  assert.equal(d.permissionRequests(),0);
 }
});
test('iOS uses native authorization; older Android and the wrong account never request it',async()=>{
 const ios=fixture();ios.platform.OS='ios';ios.nativePermission('undetermined');
 await ios.device.requestNativeNotificationPermission('b');assert.equal(ios.permissionRequests(),1);
 const old=fixture();old.platform.Version=32;old.nativePermission('undetermined');
 await old.device.requestNativeNotificationPermission('b');assert.equal(old.permissionRequests(),0);
 const changed=fixture();changed.nativePermission('undetermined');
 await changed.device.requestNativeNotificationPermission('other');assert.equal(changed.permissionRequests(),0);
});
test('denied OS permission is reported even when every category is disabled; denied users are never re-prompted',async()=>{
 const h=fixture();h.nativePermission('denied',true);
 assert.equal(await h.device.getNotificationAuthorization(),'denied');
 assert.equal(await h.device.syncDevice('b',true,true),'denied');
 assert.equal(h.permissionRequests(),0);
});


test('category choices survive provider/device reload and remain isolated after account switching',async()=>{
 const h=fixture();await h.device.setPreference('b',true);await h.device.setCategoryPreference('b','discussion',false);
 const reloaded=fixture(h.storage);
 assert.equal((await reloaded.device.categoryPreferences('b')).discussion,false);
 assert.equal((await reloaded.device.categoryPreferences('b')).workorders,true);
 assert.equal((await reloaded.device.categoryPreferences('other')).workorders,false);
 assert.equal((await reloaded.device.categoryPreferences('b')).discussion,false);
});


test('native first-launch permission can be requested before login without enrolling any device',async()=>{
 for(const platform of ['android','ios']){
  const h=fixture();h.platform.OS=platform;h.signOut();h.nativePermission('undetermined');
  await h.device.requestNativeNotificationPermission();await h.device.requestNativeNotificationPermission();
  assert.equal(h.permissionRequests(),1);assert.equal(h.tokenRequests(),0);assert.equal(h.calls.length,0);
 }
});
test('allow initializes all four categories; later category choices survive unchanged OS authorization',async()=>{
 const h=fixture();await h.device.applyNotificationPermission('b','granted');
 assert.deepEqual(Object.values(await h.device.categoryPreferences('b')),[true,true,true,true]);
 await h.device.setCategoryPreference('b','discussion',false);
 await h.device.applyNotificationPermission('b','granted');
 assert.equal((await h.device.categoryPreferences('b')).discussion,false);
 assert.equal((await h.device.categoryPreferences('other')).inbox,false);
 const reload=fixture(h.storage);await reload.device.applyNotificationPermission('b','granted');
 assert.equal((await reload.device.categoryPreferences('b')).discussion,false);
});
test('denial switches all four off; a later OS grant switches them back on without re-prompting',async()=>{
 const h=fixture();await h.device.setPreference('b',true);
 await h.device.applyNotificationPermission('b','denied');
 assert.deepEqual(Object.values(await h.device.categoryPreferences('b')),[false,false,false,false]);
 await h.device.applyNotificationPermission('b','granted');
 assert.deepEqual(Object.values(await h.device.categoryPreferences('b')),[true,true,true,true]);
 assert.equal(h.permissionRequests(),0);assert.equal(h.calls.length,0);
});
test('pending or unavailable permissions and another account never change saved choices',async()=>{
 const h=fixture();await h.device.setPreference('b',false);
 for(const state of ['checking','undetermined','unavailable'])await h.device.applyNotificationPermission('b',state);
 await h.device.applyNotificationPermission('other','granted');
 assert.deepEqual(Object.values(await h.device.categoryPreferences('b')),[false,false,false,false]);
 assert.equal(h.storage.has('townloop.notifications.permission.defaults.other'),false);
});


test('a stale Keychain attempt marker cannot suppress the first-install iOS system prompt',async()=>{
 const h=fixture();h.platform.OS='ios';h.nativePermission('undetermined');
 // Request markers now use installation storage, so old Keychain entries are not read.
 h.storage.set('townloop.notifications.permission.requested','yes');
 await h.device.requestNativeNotificationPermission();assert.equal(h.permissionRequests(),1);
});
