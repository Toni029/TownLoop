const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(platform,flag){
 const calls=[],store=new Map(),n={
  getPermissionsAsync:async()=>{calls.push('permissions');return {granted:true};},
  getExpoPushTokenAsync:async()=>{calls.push('token');throw Error('stop_before_network');},
  setNotificationChannelAsync:async()=>calls.push('channel'),AndroidImportance:{HIGH:4},AndroidNotificationVisibility:{PRIVATE:0}
 };
 const module={exports:{}};
 const source=ts.transpileModule(fs.readFileSync(require.resolve('../src/notifications/device.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{module,exports:module.exports,process:{env:{EXPO_PUBLIC_TOWNLOOP_IOS_SIMULATOR:flag}},setTimeout,clearTimeout,require:id=>{
  if(id==='@react-native-async-storage/async-storage')return {default:{getItem:async key=>store.get(key)||null,setItem:async(key,value)=>store.set(key,value),removeItem:async key=>store.delete(key)}};
  if(id==='react-native')return {Platform:{OS:platform}};
  if(id==='expo')return {requireOptionalNativeModule:()=>({})};
  if(id==='expo-notifications')return n;
  if(id==='expo-secure-store')return {getItemAsync:async key=>store.get(key)||null,setItemAsync:async(key,value)=>store.set(key,value)};
  if(id==='expo-crypto')return {randomUUID:()=> 'fixture'};
  if(id==='expo-constants')return {default:{easConfig:{projectId:'fixture'}}};
  if(id==='firebase/functions')return {getFunctions:()=>null,httpsCallable:()=>()=>{throw Error('No backend registration expected');}};
  if(id==='../lib/firebase')return {app:{},auth:{currentUser:{uid:'fixture'}}};
  if(id==='./protocol')return {serialOperations:()=>operation=>Promise.resolve().then(operation),emptyPreferences:{},notificationCategories:[]};
  throw Error('Unexpected dependency');
 }});
 return {device:module.exports,calls};
}
test('simulator preferences do not wait for APNs, obtain tokens or register devices',async()=>{
 const {device,calls}=load('ios','1');
 assert.equal(await device.syncDevice('fixture',true,true),'simulator');
 assert.equal(await device.syncDevice('fixture',true,true),'simulator');
 assert.equal(await device.syncDevice('fixture',false),'off');
 assert.deepEqual(calls,[]);
});
test('physical iPhone and Android retain their token-registration path',async()=>{
 for(const [platform,flag]of [['ios',undefined],['android','1']]){
  const {device,calls}=load(platform,flag);
  await assert.rejects(device.syncDevice('fixture',true),/stop_before_network/);
  assert(calls.includes('permissions'));assert(calls.includes('token'));
 }
});
