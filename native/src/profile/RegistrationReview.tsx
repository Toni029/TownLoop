import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,Pressable,Text,View} from 'react-native';
import {TextInput} from '../keyboard/KeyboardScrollView';
import {manageRegistrationLifecycle,registrationError,type DenialReason,type PendingRegistration,type PendingRegistrations,type RegistrationRestriction,type RegistrationRestrictions} from '../lib/registration';
import {registrationRemaining,registrationReminderSummary} from '../lib/registrationModel';
const reasonLabels:Record<DenialReason,string>={incomplete:'Incorrect or incomplete information',residency:'Residency could not be verified',duplicate:'Duplicate or mistaken application',other:'Other eligibility issue',spam:'Spam or malicious submissions',fraud:'Fraud or impersonation',abuse:'Abuse of registration',circumvention:'Circumventing access restrictions'};
const ordinary:DenialReason[]=['incomplete','residency','duplicate','other'];
const abuse:DenialReason[]=['spam','fraud','abuse','circumvention'];
export function RegistrationReview({dark,admin}:{dark:boolean;admin:boolean}) {
 const [items,setItems]=useState<PendingRegistration[]>([]),[restrictions,setRestrictions]=useState<RegistrationRestriction[]>([]);
 const [serverNow,setServerNow]=useState(0),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [choices,setChoices]=useState<Record<string,{category:'ordinary'|'abuse';reason:DenialReason|null}>>({}),[liftReasons,setLiftReasons]=useState<Record<string,string>>({});
 const busyLock=useRef(false),clockBase=useRef({value:0,receivedAt:0});
 const [cleanup,setCleanup]=useState({pending:0,review:0});
 const [nextPending,setNextPending]=useState<string|null>(null),[nextRestriction,setNextRestriction]=useState<{id:string;expiresAt:number}|null>(null);
 const [showRestrictions,setShowRestrictions]=useState(false),[restrictionsLoaded,setRestrictionsLoaded]=useState(false);
 const ink=dark?'#f1f5f9':'#1c1917',muted=dark?'#94a3b8':'#78716c';
 const panel={borderWidth:1,borderColor:dark?'#475569':'#d6d3d1',borderRadius:14,padding:12,gap:8} as const;
 const copy={color:ink,fontFamily:'Jakarta',fontSize:13};
 async function refresh(more=false){const list=await manageRegistrationLifecycle<PendingRegistrations>({action:'listPending',...(more&&nextPending?{after:nextPending}:{})});setItems(previous=>more?[...previous,...list.items.filter(item=>!previous.some(old=>old.uid===item.uid))]:list.items);setNextPending(list.next||null);setServerNow(list.serverNow);clockBase.current={value:list.serverNow,receivedAt:Date.now()};setCleanup({pending:list.cleanupPendingCount||0,review:list.cleanupNeedsReviewCount||0});setLoaded(true);}
 async function loadRestrictions(more=false){const list=await manageRegistrationLifecycle<RegistrationRestrictions>({action:'listRestrictions',...(more&&nextRestriction?{after:nextRestriction}:{})});setRestrictions(previous=>more?[...previous,...list.items.filter(item=>!previous.some(old=>old.id===item.id))]:list.items);setNextRestriction(list.next||null);setServerNow(list.serverNow);setRestrictionsLoaded(true);}
 async function run(action:()=>Promise<unknown>){if(busyLock.current)return;busyLock.current=true;setBusy(true);setError('');try{await action();}catch(e){setError(registrationError(e));}finally{busyLock.current=false;setBusy(false);}}
 useEffect(()=>{void run(refresh);},[]);
 useEffect(()=>{if(!loaded)return;const update=()=>{if(AppState.currentState==='active')setServerNow(clockBase.current.value+Date.now()-clockBase.current.receivedAt);};const timer=setInterval(update,60000),listener=AppState.addEventListener('change',state=>{if(state==='active')update();});return()=>{clearInterval(timer);listener.remove();};},[loaded]);
 const button=(label:string,onPress:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={busy||disabled} onPress={onPress} style={{padding:10,minHeight:44,borderRadius:9,backgroundColor:dark?'#334155':'#e7e5e4',opacity:busy||disabled?0.5:1}}><Text style={copy}>{label}</Text></Pressable>;
 function deny(item:PendingRegistration){
  const choice=choices[item.uid]||{category:'ordinary' as const,reason:null};
  if(!choice.reason){setError('Select a specific denial reason first.');return;}
  const reason=choice.reason;
  Alert.alert('Deny registration?',`${item.name}\nReason: ${reasonLabels[reason]}. ${choice.category==='ordinary'?'They may reapply immediately after account cleanup completes.':'This is an abuse-related denial. The 7-day restriction starts when this denial is confirmed. They may reapply once the restriction expires and account cleanup has completed.'} The account will be queued for cleanup.`,[{text:'Cancel',style:'cancel'},{text:'Deny registration',style:'destructive',onPress:()=>void run(async()=>{await manageRegistrationLifecycle({action:'deny',uid:item.uid,category:choice.category,reason,confirmed:true});await refresh();})}]);
 }
 return <View style={panel}>
  <Text style={{...copy,fontFamily:'JakartaBold',fontSize:15}}>Registration review</Text>
  <Text style={{...copy,color:muted}}>The server list is authoritative. Review each application individually.</Text>
  {!!registrationReminderSummary(items)&&<View accessibilityRole="alert" style={{...panel,backgroundColor:dark?'#422006':'#fef3c7'}}><Text style={copy}>{registrationReminderSummary(items)}</Text></View>}
  {!!error&&<Text accessibilityRole="alert" style={{...copy,color:'#e11d48'}}>{error}</Text>}
  {busy&&<ActivityIndicator/>}
  {button('Refresh registrations',()=>void run(refresh))}
  {(cleanup.pending>0||cleanup.review>0)&&<Text accessibilityRole="alert" style={copy}>Registration account cleanup: {cleanup.pending} queued or retrying · {cleanup.review} require Admin review. Cleanup is not complete for these accounts.</Text>}
  {loaded&&!items.length&&<Text style={copy}>No registrations awaiting approval.</Text>}
  {items.map(item=>{
   const choice=choices[item.uid]||{category:'ordinary' as const,reason:null};
   return <View key={item.uid} style={panel}>
    <Text style={{...copy,fontFamily:'JakartaBold'}}>{item.name}</Text><Text style={copy}>{item.email}</Text>
    <Text style={{...copy,color:muted}}>Submitted: {item.submittedAt===null?'Unknown (legacy registration)':new Date(item.submittedAt).toLocaleString()}</Text>
    <Text style={copy}>{registrationRemaining(item.expiresAt,serverNow,item.legacy)}</Text>
    {!!item.reminderStage&&<Text style={copy}>Reminder: {item.reminderStage==='day12'?'Day 12':'Day 7'}</Text>}
    <Text style={copy}>Status: {item.status==='expired'?'Expired · cleanup pending':'Pending approval'}</Text>
    {button('Approve registration',()=>Alert.alert('Approve registration?',`Grant ${item.name} resident access?`,[{text:'Cancel',style:'cancel'},{text:'Approve',onPress:()=>void run(async()=>{await manageRegistrationLifecycle({action:'approve',uid:item.uid});await refresh();})}]),item.status!=='pending'||(item.expiresAt!==null&&item.expiresAt<=serverNow))}
    {item.legacy?<Text style={{...copy,color:muted}}>Legacy registration: no automatic expiry. Denial requires individual migration and cleanup review; contact an administrator before proceeding.</Text>:<>
     <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{(['ordinary','abuse'] as const).map(category=><View key={category}>{button(`${choice.category===category?'✓ ':''}${category==='ordinary'?'Ordinary denial':'Abuse denial'}`,()=>setChoices({...choices,[item.uid]:{category,reason:null}}))}</View>)}</View>
     <Text style={copy}>Denial reason</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{(choice.category==='ordinary'?ordinary:abuse).map(reason=><View key={reason}>{button(`${choice.reason===reason?'✓ ':''}${reasonLabels[reason]}`,()=>setChoices({...choices,[item.uid]:{...choice,reason}}))}</View>)}</View>
     {button('Deny registration…',()=>deny(item),!choice.reason||item.status!=='pending'||(item.expiresAt!==null&&item.expiresAt<=serverNow))}
    </>}
   </View>;
  })}
  {nextPending&&button('Load more registrations',()=>void run(()=>refresh(true)))}
  {admin&&<>
   {button(showRestrictions?'Hide registration restrictions':'View registration restrictions',()=>{setShowRestrictions(!showRestrictions);if(!showRestrictions)void run(loadRestrictions);})}
   {showRestrictions&&<View style={panel}>
    <Text style={{...copy,fontFamily:'JakartaBold'}}>Active restrictions</Text><Text style={{...copy,color:muted}}>Opaque restriction references only. Lifting a restriction does not restore an account.</Text>
    {button('Refresh restrictions',()=>void run(loadRestrictions))}
    {restrictionsLoaded&&!restrictions.length&&<Text style={copy}>No active restrictions.</Text>}
    {restrictions.map(item=><View key={item.id} style={panel}>
     <Text style={copy}>Reference: {item.id}</Text><Text style={copy}>Reason: {item.reason}</Text><Text style={copy}>Denied: {new Date(item.deniedAt).toLocaleString()}</Text><Text style={copy}>Ends: {new Date(item.expiresAt).toLocaleString()}</Text>
     <TextInput accessibilityLabel={`Reason to lift restriction ${item.id}`} placeholder="Reason for early lift" placeholderTextColor={muted} value={liftReasons[item.id]||''} onChangeText={reason=>setLiftReasons({...liftReasons,[item.id]:reason})} editable={!busy} maxLength={500} style={{...copy,borderWidth:1,borderColor:muted,borderRadius:8,padding:10}}/>
     {button('Lift restriction early…',()=>Alert.alert('Lift registration restriction?',`Reference: ${item.id}\nReason: ${liftReasons[item.id]?.trim()}\nThis permits reapplication before the 7-day restriction ends, once cleanup has completed.`,[{text:'Cancel',style:'cancel'},{text:'Lift restriction',onPress:()=>void run(async()=>{await manageRegistrationLifecycle({action:'liftRestriction',restrictionId:item.id,reason:liftReasons[item.id].trim(),confirmed:true});await loadRestrictions();})}]),!liftReasons[item.id]?.trim())}
    </View>)}
    {nextRestriction&&button('Load more restrictions',()=>void run(()=>loadRestrictions(true)))}
   </View>}
  </>}
 </View>;
}
