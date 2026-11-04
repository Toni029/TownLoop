import {auth} from '../lib/firebase';
export type AnalysisProgress={state:string;completedBatches:number;totalBatches:number;attempt:number;error?:string};
export async function analyzeInBackground(base:string,body:Record<string,unknown>,owner:string,options:{signal?:AbortSignal;onProgress?:(progress:AnalysisProgress)=>void;fetcher?:typeof fetch;wait?:(ms:number)=>Promise<void>;polls?:number}={}) {
 const check=()=>{if(auth.currentUser?.uid!==owner)throw Error('Your account changed. Reopen News.');if(options.signal?.aborted)throw Error('Analysis continues securely on the server. Reopen News to resume its progress.');};
 const wait=options.wait||(ms=>new Promise<void>(resolve=>setTimeout(resolve,ms)));
 async function request(path:string,input?:Record<string,unknown>){
  for(let attempt=0;attempt<3;attempt++){
   check();const token=await auth.currentUser?.getIdToken(attempt>0);check();if(!token)throw Error('Please sign in again.');
   const controller=new AbortController(),stop=()=>controller.abort(),timer=setTimeout(stop,20000);options.signal?.addEventListener('abort',stop,{once:true});
   try{
    const response=await(options.fetcher||fetch)(`${base}/api/newsletter/native${path}`,{method:input?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},redirect:'error',signal:controller.signal,...(input?{body:JSON.stringify(input)}:{})});check();
    const value=await response.json().catch(()=>null);
    if(!response.ok){if(response.status>=500||response.status===429)throw Error(value?.error||'Analysis service is temporarily unavailable.');throw Object.assign(Error(value?.error||'Analysis access could not be verified.'),{permanent:true});}
    if(!value)throw Error('Analysis progress could not be read.');return value;
   }catch(error){check();if((error as any)?.permanent||attempt===2)throw error;await wait(1000*2**attempt);}
   finally{clearTimeout(timer);options.signal?.removeEventListener('abort',stop);}
  }
 }
 let job=await request('/analysis-jobs',body);
 if(!/^[a-f0-9]{64}$/.test(job?.jobId))throw Error('Background analysis needs its backend update. The uploaded PDF is retained.');
 for(let poll=0;poll<(options.polls||600);poll++){
  check();options.onProgress?.(job);
  if(job.state==='succeeded')return job.result;
  if(job.state==='failed')throw Error(job.error||'Analysis paused. Retry to resume saved progress.');
  if(!['queued','running','retrying'].includes(job.state))throw Error('Unexpected analysis state. Reopen News to reconnect.');
  await wait(2000);check();job=await request(`/analysis-jobs/${job.jobId}`);
 }
 throw Error('Analysis is still running on the server. Reopen News to resume progress; completed batches are saved.');
}
