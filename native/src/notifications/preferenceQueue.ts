import {emptyPreferences,notificationCategories,type NotificationCategory,type NotificationPreferences} from './protocol';
type Phase='loading'|'saving'|'saved'|'pending'|'local-error'|'load-error';
export type PreferenceSnapshot={values:NotificationPreferences;phase:Phase};
type Options={load:()=>Promise<NotificationPreferences>;persist:(values:NotificationPreferences)=>Promise<void>;sync:()=>Promise<void>;changed:(snapshot:PreferenceSnapshot)=>void};
/** Local durability and network sync have separate lanes. Neither blocks a tap. */
export function preferenceQueue(options:Options){
 let values={...emptyPreferences},durable={...emptyPreferences},revision=0,stored=0,requested=0,acknowledged=0;
 let loaded=false,disposed=false,local=false,remote=false,error:''|'local-error'|'load-error'|'pending'='';
 let initialization:Promise<void>|undefined;const touched=new Set<NotificationCategory>();
 const snapshot=():PreferenceSnapshot=>({values:{...values},phase:error||(!loaded?'loading':local||remote||stored<revision||acknowledged<requested?'saving':'saved')});
 const emit=()=>{if(!disposed)options.changed(snapshot());};
 function initialize(){
  if(loaded)return Promise.resolve();
  if(!initialization)initialization=options.load().then(saved=>{
   if(disposed||loaded)return;durable={...saved};for(const key of notificationCategories)if(!touched.has(key))values[key]=saved[key];loaded=true;error='';emit();
  }).catch(cause=>{if(!disposed){values={...durable};touched.clear();stored=revision;error='load-error';emit();}throw cause;}).finally(()=>{initialization=undefined;});
  return initialization;
 }
 async function upload(){
  if(remote||disposed)return;remote=true;emit();
  try{while(!disposed&&acknowledged<requested){
   const version=requested;
   try{await options.sync();if(disposed)return;acknowledged=Math.max(acknowledged,version);if(error==='pending')error='';}
   catch{if(disposed)return;if(version<=acknowledged)continue;if(version===requested){error='pending';break;}}
  }}finally{remote=false;emit();}
 }
 async function save(){
  if(local||disposed)return;local=true;
  try{
   await initialize();
   while(!disposed&&stored<revision){
    const version=revision,next={...values};
    try{await options.persist(next);}
    catch{if(disposed)return;if(version===revision){values={...durable};stored=revision;error='local-error';break;}continue;}
    if(disposed)return;durable=next;stored=version;requested=version;error='';void upload();
   }
  }catch{/* initialize reports the load failure; no unknown preferences are overwritten. */}
  finally{local=false;emit();}
 }
 void initialize().catch(()=>{});
 return {
  snapshot,version:()=>revision,
  set(category:NotificationCategory,on:boolean){if(disposed)return;values={...values,[category]:on};touched.add(category);revision++;error='';emit();void save();},
  // A refresh begun before a tap must never overwrite its newer local intent.
  hydrate(saved:NotificationPreferences,version:number){if(disposed||version!==revision||local)return false;values={...saved};durable={...saved};loaded=true;if(error==='load-error')error='';emit();return true;},
  confirmed(version:number){if(disposed||version!==revision||local)return;acknowledged=requested;if(error==='pending')error='';emit();},
  dispose(){disposed=true;},
 };
}
