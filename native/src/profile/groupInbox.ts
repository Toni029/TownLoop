import {confirmedLegacyLeave,onConfirmedLegacyLeave} from './legacyLeaveEvents';
import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth, db } from '../lib/firebase';
import type { UserProfile } from '../../../src/types';
import { readThread, type Category, type Message, type Thread } from './model';
const callable = httpsCallable<Record<string, unknown>, any>(getFunctions(app, 'us-central1'), 'manageInboxConversation');
export async function groupAction(op: string, input: Record<string, unknown> = {}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw Error('Please sign in again.');
  const result = await callable({ ...input, op });
  if (auth.currentUser?.uid !== uid) throw Error('Your session changed. Please sign in again.');
  confirmedLegacyLeave(uid,op,input,result.data);
  return result.data;
}
export type GroupRosterMember = { uid: string; name: string; avatar: string; role: string; status: 'active' | 'left' };
const categoryFor = (type: string): Category => type === 'private' ? 'friend' : type as Category;
export function useGroupInbox(user: UserProfile | null) {
  const uid = user ? String(user.id) : '';
  const accountKey = uid && user?.approved===true && ['resident','admin','vip','crew'].includes(user.role||'') ? `${uid}/${user.role}/approved` : '';
  const [state, setState] = useState<{uid:string; enabled:boolean; threads:Thread[]; legacy:Thread[]; error:string}>({uid:'',enabled:false,threads:[],legacy:[],error:''});
  useEffect(() => {
    if (!accountKey || !user) return;
    let active = true, stop = () => {}, timer: ReturnType<typeof setInterval> | undefined;
    const update = (patch: Partial<typeof state>) => { if (active) setState(s => ({ ...(s.uid === accountKey ? s : {uid:accountKey,enabled:false,threads:[],legacy:[],error:''}), ...patch })); };
    const departedLegacy=new Set<string>();
    const stopLeaves=onConfirmedLegacyLeave(uid,(source,id)=>{
      departedLegacy.add(`${source}/${id}`);
      if(active)setState(s=>s.uid===accountKey?{...s,legacy:s.legacy.filter(t=>!(t.id===id&&({friend:'resident_chats',office:'office_chats',maintenance:'maintenance_chats'}[t.category])===source))}:s);
    });
    const legacy = async () => {
      try {
        const result = await groupAction('listLegacy');
        if (!active) return;
        update({legacy:result.rows.filter((row:any)=>!departedLegacy.has(`${row.collection}/${row.id}`)).map((row:any) => readThread(categoryFor(({resident_chats:'private',office_chats:'office',maintenance_chats:'maintenance'} as Record<string,string>)[row.collection] || ''),row.id,row.data,user)).filter(Boolean),error:''});
      } catch { update({error:'Unable to refresh Inbox. Reopen the Inbox to retry.'}); }
    };
    void groupAction('capabilities').then(result => {
      if (!active || !result.enabled || result.protocolVersion !== 3) return;
      update({enabled:true});
      stop = onSnapshot(query(collection(db,'inbox_memberships'),where('uid','==',uid),where('status','==','active'),orderBy('updatedAt','desc'),limit(100)), snapshot => {
        update({threads:snapshot.docs.map(d => {
          const m=d.data(); const category=categoryFor(m.type);
          return {id:m.conversationId,category,name:m.name,subject:m.subject,unread:m.sequence > m.readSequence,messages:[],updatedAt:m.updatedAt,
            data:{...m,schemaVersion:3},recipient:{id:m.peerId||'',name:m.name} as UserProfile,otherLeft:m.conversationStatus==='read_only'};
        })});
        void legacy();
      }, () => update({error:'Unable to load group conversations.'}));
      void legacy(); timer=setInterval(() => void legacy(),30_000);
    }).catch(() => { /* Unpublished backend: keep the current Inbox intact. */ });
    return () => { active=false; stopLeaves(); stop(); if(timer)clearInterval(timer); };
    // Account identity/authorization changes discard all previous projections.
  }, [uid,user?.role,user?.approved]);
  return accountKey && state.uid === accountKey ? state : {uid,enabled:false,threads:[],legacy:[],error:''};
}
export function useGroupConversation(thread: Thread | undefined, uid: string) {
  const id=thread?.data.schemaVersion===3 ? thread.id : '';
  const epoch=thread?.data.epoch;
  const [state,setState]=useState<{key:string;messages:Message[];roster:GroupRosterMember[];candidates:GroupRosterMember[];error:string;hasMore:boolean;loaded:boolean}>({key:'',messages:[],roster:[],candidates:[],error:'',hasMore:false,loaded:false});
  const key=`${uid}/${id}/${epoch}`;
  const [pageSize,setPageSize]=useState({key:'',size:100});
  const count=pageSize.key===key?pageSize.size:100;
  useEffect(() => {
    if (!id || !uid || !epoch) return;
    let active=true;
    const update=(patch:Partial<typeof state>)=>{if(active)setState(s=>({... (s.key===key?s:{key,messages:[],roster:[],candidates:[],error:'',hasMore:false,loaded:false}),...patch}));};
    const stop=onSnapshot(query(collection(db,'inbox_conversations',id,'messages'),where('visibility','array-contains',`${uid}:${epoch}`),orderBy('sequence','desc'),limit(count)),snapshot=>{
      update({messages:snapshot.docs.map(d=>({...d.data(),id:d.id} as Message)).reverse(),error:'',loaded:true,hasMore:snapshot.docs.length===count});
      void groupAction('roster',{conversationId:id}).then(result=>update({roster:result.members,candidates:result.candidates})).catch(()=>update({error:'Unable to refresh participants.'}));
    },()=>update({messages:[],roster:[],candidates:[],loaded:false,error:'This conversation is no longer available.'}));
    const stopRoot=onSnapshot(doc(db,'inbox_conversations',id),snapshot=>{
      if(!snapshot.exists())update({messages:[],roster:[],candidates:[],loaded:false,error:'This conversation is no longer available.'});
    },()=>update({messages:[],roster:[],candidates:[],loaded:false,error:'This conversation is no longer available.'}));
    if(thread.category==='maintenance'&&thread.data.conversationStatus==='open')void groupAction('sync',{conversationId:id}).catch(()=>{});
    return()=>{active=false;stop();stopRoot();};
  },[id,uid,epoch,key,count]);
  const current=state.key===key?state:{messages:[],roster:[],candidates:[],error:'',hasMore:false,loaded:false};
  return {...current,loadMore:()=>setPageSize({key,size:count+100})};
}
