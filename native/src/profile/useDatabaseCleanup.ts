import {useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {randomUUID} from 'expo-crypto';
import type {UserProfile} from '../../../src/types';
import {manageDatabaseCleanup,type CleanupRequest} from '../lib/databaseCleanup';
import {canConfirmCleanup,canUseDatabaseCleanup,cleanupCanCancel,cleanupIsActive,toggleCleanupCategory,type CleanupCategory,type CleanupJob} from './databaseCleanupModel';

/** Retained by AdminMenu across tab changes; only an explicit action starts or resumes work. */
export function useDatabaseCleanup(user:UserProfile,active:boolean) {
  const allowed=canUseDatabaseCleanup(user), accountKey=allowed?String(user.id):'';
  const [selected,setSelected]=useState<CleanupCategory[]>([]),[job,setJob]=useState<CleanupJob|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[phrase,setPhrase]=useState('');
  const [step,setStep]=useState<'inventory'|'confirmation'>('inventory'),[needsStatus,setNeedsStatus]=useState(false);
  const [foreground,setForeground]=useState(AppState.currentState==='active');
  const mounted=useRef(false),operation=useRef(false),epoch=useRef(0);
  const previewRequest=useRef<{signature:string;id:string}|null>(null);
  const scope=useRef({accountKey,active,foreground});
  useEffect(()=>{scope.current={accountKey,active,foreground};},[accountKey,active,foreground]);
  useEffect(()=>{
    mounted.current=true;
    const lifecycle=epoch;
    const listener=AppState.addEventListener('change',state=>{
      scope.current.foreground=state==='active';
      setForeground(state==='active');
    });
    return()=>{mounted.current=false;lifecycle.current++;listener.remove();};
  },[]);
  useEffect(()=>{
    epoch.current++;operation.current=false;previewRequest.current=null;
    // Discard another account's inventory and typed authorization when the session changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected([]);setJob(null);setBusy(false);setError('');setPhrase('');setStep('inventory');setNeedsStatus(false);
  },[accountKey]);

  async function run(input:CleanupRequest) {
    const current=epoch.current;
    if(!allowed||!active||!foreground||operation.current||!mounted.current||scope.current.accountKey!==accountKey||!scope.current.active||!scope.current.foreground)return;
    operation.current=true;setBusy(true);setError('');
    try {
      const next=await manageDatabaseCleanup(input);
      if(!mounted.current||current!==epoch.current)return;
      if(input.action!=='preview'&&next.id!==input.jobId)throw Error('The cleanup job could not be verified. Refresh status before continuing.');
      const expected=input.action==='preview'?input.categories:job?.categories;
      if(!expected||expected.length!==next.categories.length||!expected.every(category=>next.categories.includes(category)))throw Error('The selected cleanup inventory changed unexpectedly. Refresh status before continuing.');
      setJob(next);setNeedsStatus(false);
      if(next.state!=='review'||(job&&next.planHash!==job.planHash)){setStep('inventory');setPhrase('');}
    } catch(failure) {
      if(mounted.current&&current===epoch.current) {
        setError(failure instanceof Error?failure.message:'Unable to contact the cleanup service. Refresh status before continuing.');
        if(input.action!=='preview')setNeedsStatus(true);
      }
    } finally {
      if(mounted.current&&current===epoch.current){operation.current=false;setBusy(false);}
    }
  }
  function toggle(category:CleanupCategory) {
    if(!allowed||busy||operation.current||job)return;
    setSelected(previous=>toggleCleanupCategory(previous,category));setError('');previewRequest.current=null;
  }
  async function preview() {
    if(!selected.length||job||!allowed||busy||operation.current)return;
    const signature=selected.join(',');
    if(previewRequest.current?.signature!==signature)previewRequest.current={signature,id:randomUUID()};
    await run({action:'preview',categories:selected,requestId:previewRequest.current.id});
  }
  async function refresh() {if(job)await run({action:'status',jobId:job.id});}
  async function confirm() {
    if(step!=='confirmation'||needsStatus||!canConfirmCleanup(job,phrase,busy)||!job?.planHash)return;
    await run({action:'confirm',jobId:job.id,planHash:job.planHash,confirmation:phrase});
  }
  async function resume() {
    if(job&&['paused','failed'].includes(job.state)&&job.enabled&&!needsStatus)await run({action:'resume',jobId:job.id});
  }
  async function cancel() {if(job&&cleanupCanCancel(job))await run({action:'cancel',jobId:job.id});}
  function showConfirmation() {
    if(job?.state==='review'&&job.enabled&&job.completeInventory&&job.planHash&&!busy&&!needsStatus){setPhrase('');setStep('confirmation');}
  }
  function backToInventory() {if(!busy){setPhrase('');setStep('inventory');}}
  function newSelection() {
    if(!job||!['completed','completed_with_holds','cancelled'].includes(job.state)||busy)return;
    previewRequest.current=null;setJob(null);setSelected([]);setPhrase('');setStep('inventory');setError('');setNeedsStatus(false);
  }
  useEffect(()=>{
    if(!allowed||!active||!foreground||!cleanupIsActive(job)||busy||error)return;
    const timer=setTimeout(()=>void refresh(),4000);
    return()=>clearTimeout(timer);
    // A new timeout follows each completed status request, preventing overlapping polls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[accountKey,allowed,active,foreground,job,busy,error]);
  return {allowed,selected,job,busy,error,phrase,setPhrase,step,needsStatus,toggle,preview,refresh,confirm,resume,cancel,showConfirmation,backToInventory,newSelection};
}
export type DatabaseCleanupController=ReturnType<typeof useDatabaseCleanup>;
