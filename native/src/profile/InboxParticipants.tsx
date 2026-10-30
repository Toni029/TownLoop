import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Image,Keyboard,Pressable,ScrollView,Text,useWindowDimensions,View} from 'react-native';
import {ChevronDown,UserPlus,Users} from 'lucide-react-native';
import {groupAction,type GroupRosterMember} from './groupInbox';
import type {Thread} from './model';

export function participantError(error:unknown){
 const code=String((error as {code?:unknown})?.code||'').replace(/^functions\//,'');
 if(code==='unauthenticated')return 'Please sign in again to view this conversation.';
 if(code==='permission-denied')return 'You no longer have permission to manage these group members.';
 if(code==='not-found')return 'Group management is unavailable. Refresh the Inbox and try again.';
 if(code==='unimplemented')return 'Group management needs an Inbox service update. Please contact your community office.';
 if(code==='failed-precondition')return 'This conversation needs community office review before its members can be changed.';
 if(code==='resource-exhausted')return 'This group has reached its member limit.';
 return 'Unable to load or update group members. Please try again.';
}
type Props={thread:Thread;uid:string;open:boolean;onToggle:()=>void;onUpgrade:(id:string,type:string)=>void;dark:boolean;ink:string;muted:string;disabled:boolean};
function MemberAvatar({person}:{person:GroupRosterMember}){
 return <View style={{width:30,height:30,borderRadius:15,backgroundColor:'#05966918',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
  {person.avatar?<Image source={{uri:person.avatar}} style={{width:30,height:30}}/>:<Text style={{fontFamily:'JakartaBold',color:'#047857'}}>{person.name.slice(0,1).toUpperCase()}</Text>}
 </View>;
}
/** A group-only control. All eligibility, joins and history boundaries remain server-owned. */
export function InboxParticipants(props:Props){
 // Do not mount the controller or invoke membership operations for private chats.
 return props.thread.category==='friend'?null:<GroupParticipants {...props}/>;
}
function GroupParticipants({thread,uid,open,onToggle,onUpgrade,dark,ink,muted,disabled}:Props){
 const {height}=useWindowDimensions();
 const [members,setMembers]=useState<GroupRosterMember[]>([]),[candidates,setCandidates]=useState<GroupRosterMember[]>([]);
 const [loading,setLoading]=useState(false),[adding,setAdding]=useState(''),[error,setError]=useState(''),[needsRefresh,setNeedsRefresh]=useState(false);
 const active=useRef(true),epoch=useRef(0),lock=useRef(false),resolvedId=useRef(thread.data.schemaVersion===3?thread.id:'');
 useEffect(()=>{active.current=true;return()=>{active.current=false;epoch.current++;};},[]);
 const current=(version:number)=>active.current&&version===epoch.current;
 function applyRoster(result:{members:GroupRosterMember[];candidates:GroupRosterMember[]}){
  const roster=[...new Map(result.members.filter(p=>p.status==='active').map(p=>[p.uid,p])).values()];
  const ids=new Set(roster.map(p=>p.uid));setMembers(roster);
  setCandidates([...new Map(result.candidates.filter(p=>p.uid!==uid&&!ids.has(p.uid)&&['admin','vip'].includes(p.role)).map(p=>[p.uid,p])).values()]);setNeedsRefresh(false);
 }
 async function load(){
  const version=++epoch.current;setLoading(true);setError('');
  try{
   if(!resolvedId.current){
    const upgraded=await groupAction('upgradeLegacy',{source:thread.category==='office'?'office_chats':'maintenance_chats',legacyId:thread.id});
    if(!active.current)return;
    resolvedId.current=upgraded.conversationId;onUpgrade(upgraded.conversationId,upgraded.type);return;
   }
   const result=await groupAction('roster',{conversationId:resolvedId.current});
   if(!current(version))return;applyRoster(result);
  }catch(e){if(current(version)){setError(participantError(e));setNeedsRefresh(true);}}
  finally{if(current(version))setLoading(false);}
 }
 useEffect(()=>{if(open)void load();return()=>{epoch.current++;};},[open,thread.id,thread.data.sequence,thread.data.conversationStatus]);
 async function add(person:GroupRosterMember){
  if(lock.current||disabled||loading||needsRefresh||thread.category!=='office'||!resolvedId.current||!candidates.some(p=>p.uid===person.uid))return;
  lock.current=true;const version=epoch.current;setAdding(person.uid);setError('');let confirmed=false;
  try{
   await groupAction('add',{conversationId:resolvedId.current,recipientIds:[person.uid]});confirmed=true;
   const result=await groupAction('roster',{conversationId:resolvedId.current});
   if(current(version))applyRoster(result);
  }catch(e){if(current(version)){setError(confirmed?'The member update succeeded, but the list could not refresh. Refresh members to confirm the current roster.':participantError(e));setNeedsRefresh(true);}}
  finally{lock.current=false;if(active.current)setAdding('');}
 }
 const text={fontFamily:'Jakarta',fontSize:13,color:ink};
 const heading={fontFamily:'JakartaBold',fontSize:11,color:muted,letterSpacing:0.5};
 return <View style={{gap:6}}>
  <Pressable accessibilityRole="button" accessibilityLabel="Conversation members" accessibilityState={{expanded:open,disabled}} disabled={disabled} onPress={()=>{if(!open)Keyboard.dismiss();onToggle();}}
   style={({pressed})=>({alignSelf:'flex-end',minHeight:44,paddingHorizontal:12,paddingVertical:8,borderRadius:16,borderWidth:1,borderColor:'#05966933',backgroundColor:'#0596690d',flexDirection:'row',alignItems:'center',gap:6,opacity:pressed?0.7:1})}>
   <Users size={14} color="#059669"/><Text style={{fontFamily:'JakartaBold',fontSize:12,color:dark?'#6ee7b7':'#047857'}}>Members</Text><ChevronDown size={14} color="#059669" style={{transform:[{rotate:open?'180deg':'0deg'}]}}/>
  </Pressable>
  {open&&<View style={{borderWidth:1,borderColor:dark?'#334155':'#d6e5df',borderRadius:14,backgroundColor:dark?'#0f172a':'#fffffff2',padding:10,gap:8}}>
   {loading&&<ActivityIndicator accessibilityLabel="Loading group members" color="#059669"/>}
   {!!error&&<Text accessibilityRole="alert" style={{...text,color:dark?'#fda4af':'#be123c'}}>{error}</Text>}
   {!!error&&<Pressable accessibilityRole="button" accessibilityLabel="Refresh group members" disabled={loading||!!adding} onPress={()=>void load()} style={{minHeight:44,justifyContent:'center'}}><Text style={{...text,color:'#059669',fontFamily:'JakartaBold'}}>Refresh members</Text></Pressable>}
   {!loading&&!needsRefresh&&<ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{maxHeight:Math.min(260,height*0.3)}} contentContainerStyle={{gap:8}}>
    <Text style={heading}>Group Members</Text>
    {members.map(person=><View key={person.uid} style={{flexDirection:'row',gap:8,alignItems:'center',minHeight:44}}><MemberAvatar person={person}/><Text style={{...text,flex:1,flexShrink:1}}>{person.name}{person.uid===uid?' (You)':''}</Text></View>)}
    {thread.category==='office'&&<>
     <Text style={{...heading,marginTop:4}}>Add Members</Text>
     {!candidates.length&&<Text style={{...text,color:muted}}>No additional Office staff available.</Text>}
     {candidates.map(person=><View key={person.uid} style={{flexDirection:'row',gap:8,alignItems:'center'}}>
      <MemberAvatar person={person}/><Text style={{...text,flex:1,flexShrink:1}}>{person.name}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Add ${person.name}`} accessibilityState={{disabled:disabled||!!adding}} disabled={disabled||!!adding} onPress={()=>void add(person)} style={({pressed})=>({width:44,height:44,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#05966914',opacity:pressed?0.65:1})}>
       {adding===person.uid?<ActivityIndicator accessibilityLabel={`Adding ${person.name}`} size="small" color="#059669"/>:<UserPlus size={18} color="#059669"/>}
      </Pressable>
     </View>)}
    </>}
   </ScrollView>}
  </View>}
 </View>;
}
