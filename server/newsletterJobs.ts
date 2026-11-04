import {createHash, randomUUID} from 'node:crypto';
import {retainedNativePdf} from './nativeNewsletter.ts';
import {extractNewsletterContent, type NewsletterAnalysisCheckpoints} from './newsletterExtractor.ts';
import {newsletterAnalysisFailure} from './newsletterAnalysisErrors.ts';
import {NewsletterInputError} from './newsletterPdfSecurity.ts';
import {NewsletterPdfError} from './newsletterPdfText.ts';
const COLLECTION='newsletter_analysis_jobs', DAY=86400000, LEASE=400000;
export const newsletterJobsEnabled=()=>process.env.TOWNLOOP_NEWSLETTER_ANALYSIS_JOBS_ENABLED==='true';
async function adminApp(){const name='firebase-admin/app';return import(name);}
async function database(){const {getApps,initializeApp}=await adminApp();if(!getApps().length)initializeApp();const name='firebase-admin/firestore';return (await import(name)).getFirestore('(default)');}
const validId=(id:unknown)=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
function requestData(input:any){
 if(!validId(input?.newsletterId)||(input.newsletterId==='current'&&input.isNewUpload)||typeof input.isNewUpload!=='boolean')throw new NewsletterInputError('Invalid newsletter analysis reference.');
 const text=(value:unknown,max:number)=>typeof value==='string'?value.slice(0,max):'';
 return {newsletterId:input.newsletterId as string,isNewUpload:input.isNewUpload as boolean,fileName:text(input.fileName,255),editionTitle:text(input.editionTitle,200),monthEdition:text(input.monthEdition,100)};
}
const expired=(d:any)=>!d?.expiresAt?.toMillis||d.expiresAt.toMillis()<=Date.now();
async function pdfRevision(db:any,id:string){
 const chunks=await db.collection('newsletters').doc(id).collection('chunks').select('index','sha256','totalChunks','totalSize').limit(201).get();
 if(!chunks.size||chunks.size>200)throw new NewsletterInputError('The retained PDF is missing or has invalid metadata. Complete the upload before analysis.',409);
 const rows=chunks.docs.map((d:any)=>{const f=d.data();return [d.id,d.updateTime?.seconds,d.updateTime?.nanoseconds,f.index,f.sha256||'',f.totalChunks,f.totalSize];}).sort((a:any,b:any)=>a[0].localeCompare(b[0]));
 return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}
export function publicNewsletterJob(id:string,d:any){
 return {jobId:id,state:d.state,completedBatches:Object.keys(d.checkpoints||{}).length,totalBatches:d.totalBatches||0,attempt:d.attempts||0,
 ...(d.state==='succeeded'?{result:d.result}:{}),...(d.error?{error:d.error,code:d.code,retryable:d.retryable}:{}),
 ...(d.state==='retrying'?{retryNotBefore:d.retryNotBefore?.toMillis?.()}:{}),expiresAt:d.expiresAt?.toMillis?.()};
}
export async function startNewsletterJob(uid:string,input:any,db?:any,enqueue?: (id:string,generation:number)=>Promise<void>,revisionProvider?: (id:string)=>Promise<string>){
 db ||= await database();
 const request=requestData(input),revision=await (revisionProvider||((id:string)=>pdfRevision(db,id)))(request.newsletterId),id=createHash('sha256').update(JSON.stringify([uid,request,revision,'newsletter-job-v1'])).digest('hex'),ref=db.collection(COLLECTION).doc(id);
 const result=await db.runTransaction(async(tx:any)=>{
  const [snap,fence]=await Promise.all([tx.get(ref),tx.get(db.collection('newsletter_draft_cleanup').doc(request.newsletterId))]),old=snap.data(),now=Date.now();
  if(fence.exists)throw new NewsletterInputError('This unpublished PDF was discarded. Select another upload.',409);
  if(old&&old.ownerUid!==uid)throw new NewsletterInputError('Analysis is not available to this account.',403);
  if(old&&!expired(old)&&old.state==='succeeded')return old;
  if(old&&!expired(old)&&['queued','running','retrying'].includes(old.state)&&!(old.state==='running'&&old.leaseUntil?.toMillis?.()<now)&&now-(old.updatedAt?.toMillis?.()||0)<15*60000)return old;
  const reuse=old&&!expired(old)&&old.code!=='analysis-input-changed';
  const next={ownerUid:uid,request,pdfRevision:revision,newsletterId:request.newsletterId,state:'queued',generation:(old?.generation||0)+1,dispatchId:randomUUID(),attempts:0,
    checkpoints:reuse?old.checkpoints||{}:{},...(reuse&&old.inputHash?{inputHash:old.inputHash,totalBatches:old.totalBatches}:{}),createdAt:old?.createdAt||new Date(now),updatedAt:new Date(now),expiresAt:new Date(now+DAY)};
  tx.set(ref,next);return next;
 });
 if(result.state==='queued'){
  const send=enqueue|| (async(jobId:string,generation:number)=>{
   const name='firebase-admin/functions';
   const task=(await import(name)).getFunctions().taskQueue('locations/us-central1/functions/runNewsletterAnalysis');
   try{await task.enqueue({jobId,generation},{id:`${jobId}-${result.dispatchId}`,dispatchDeadlineSeconds:360});}
   catch(error){if((error as any)?.code!=='functions/task-already-exists')throw error;}
  });
  try{await send(id,result.generation);}
  catch{throw new NewsletterInputError('Analysis could not be queued. Retry; the PDF and any saved progress are retained.',503);}
 }
 return publicNewsletterJob(id,result);
}
export async function getNewsletterJob(uid:string,id:string,db?:any){
 db ||= await database();
 if(!/^[a-f0-9]{64}$/.test(id))throw new NewsletterInputError('Invalid analysis job.');
 const snap=await db.collection(COLLECTION).doc(id).get(),d=snap.data();
 if(!d||d.ownerUid!==uid)throw new NewsletterInputError('Analysis is not available to this account.',404);
 if(expired(d))throw new NewsletterInputError('This analysis session expired. Start analysis again using the retained PDF if it is still available.',410);
 if(['queued','running','retrying'].includes(d.state)&&Date.now()-(d.updatedAt?.toMillis?.()||0)>20*60000)return {...publicNewsletterJob(id,d),state:'failed',error:'Analysis stopped making progress. Retry to resume saved batches.',retryable:true};
 return publicNewsletterJob(id,d);
}
/** Trusted task only. No resident ID token or PDF contents are stored in a job. */
export async function runNewsletterJob(task:{jobId:string;generation:number},deps:any={}){
 if(!newsletterJobsEnabled()&&!deps.enabled)return;
 if(!/^[a-f0-9]{64}$/.test(task?.jobId)||!Number.isSafeInteger(task.generation))throw Error('Invalid analysis task.');
 const db=deps.db||await database(),ref=db.collection(COLLECTION).doc(task.jobId),lease=randomUUID();
 const job=await db.runTransaction(async(tx:any)=>{
  const snap=await tx.get(ref),d=snap.data(),now=Date.now();
  if(!d||d.generation!==task.generation||expired(d)||['succeeded','failed'].includes(d.state))return null;
  if(d.state==='running'&&d.leaseUntil?.toMillis?.()>now)throw Error('Analysis is already running.');
  if((d.attempts||0)>=5){tx.update(ref,{state:'failed',error:'Analysis paused after five attempts. Retry to resume saved progress.',code:'analysis-retries-exhausted',retryable:true});return null;}
  const next={...d,attempts:(d.attempts||0)+1};tx.update(ref,{state:'running',attempts:next.attempts,lease,leaseUntil:new Date(now+LEASE),updatedAt:new Date(now)});return next;
 });
 if(!job)return;
 const guard=async(tx:any)=>{
  const [snap,fence,profile,revoked]=await Promise.all([tx.get(ref),tx.get(db.collection('newsletter_draft_cleanup').doc(job.newsletterId)),tx.get(db.collection('users').doc(job.ownerUid)),tx.get(db.collection('account_access_revocations').doc(job.ownerUid))]);
  const d=snap.data(),p=profile.data();
  if(!d||d.lease!==lease||d.generation!==task.generation||expired(d))throw new NewsletterInputError('Analysis session changed or expired.',409);
  if(fence.exists)throw new NewsletterInputError('This unpublished PDF was discarded. Analysis stopped.',409);
  if(revoked.exists||p?.approved!==true||p.deletionPending===true||!['admin','vip'].includes(p.role))throw new NewsletterInputError('The account is no longer authorized for newsletter analysis.',403);
  return d;
 };
 let stage='authorization';
 try{
  await db.runTransaction(async(tx:any)=>{await guard(tx);});
  const account=await (deps.account||(async(uid:string)=>{const name='firebase-admin/auth';try{return await (await import(name)).getAuth().getUser(uid);}catch(error){if((error as any)?.code==='auth/user-not-found')return null;throw error;}}))(job.ownerUid);
  if(!account||account.disabled)throw new NewsletterInputError('The account is no longer authorized for newsletter analysis.',403);
  stage='pdf-verification';
  if(await (deps.revision||((id:string)=>pdfRevision(db,id)))(job.newsletterId)!==job.pdfRevision)throw new NewsletterInputError('The retained PDF changed. Start analysis again for its current version.',409);
  const pdf=await (deps.loadPdf|| (async(id:string,newUpload:boolean)=>{
   const credential=await (await adminApp()).applicationDefault().getAccessToken();
   return retainedNativePdf(id,`Bearer ${credential.access_token}`,newUpload);
  }))(job.newsletterId,job.request.isNewUpload);
  const checkpoints:NewsletterAnalysisCheckpoints={
   load:async(hash,total)=>db.runTransaction(async(tx:any)=>{
    const d=await guard(tx);
    if(d.inputHash&&d.inputHash!==hash)throw Object.assign(new NewsletterInputError('The PDF or analysis instructions changed. Restart analysis using this retained PDF; no reupload is required.',409),{analysisCode:'analysis-input-changed'});
    tx.update(ref,{inputHash:hash,totalBatches:total});return d.checkpoints||{};
   }),
   save:async(hash,index,total,value,model)=>{
    if(Buffer.byteLength(JSON.stringify(value))>60000)throw Error('Analysis batch result is too large to save.');
    await db.runTransaction(async(tx:any)=>{const d=await guard(tx);if(d.inputHash!==hash||d.totalBatches!==total||index<0||index>=total)throw Error('Analysis progress mismatch.');tx.update(ref,{[`checkpoints.${index}`]:{value,model},updatedAt:new Date()});});
   },
  };
  stage='model-processing';
  const result=await (deps.extract||extractNewsletterContent)({...job.request,base64Data:pdf,mimeType:'application/pdf',isReanalysis:true},checkpoints);
  if(Buffer.byteLength(JSON.stringify(result))>300000)throw Error('Analysis result is too large to save.');
  await db.runTransaction(async(tx:any)=>{await guard(tx);tx.update(ref,{state:'succeeded',result:JSON.parse(JSON.stringify(result)),error:'',code:'',retryable:false,lease:null,updatedAt:new Date(),expiresAt:new Date(Date.now()+DAY)});});
 }catch(error){
  const input=error instanceof NewsletterInputError||error instanceof NewsletterPdfError,failure=newsletterAnalysisFailure(error),retryable=input?error instanceof NewsletterInputError&&error.status>=500:stage!=='model-processing'||failure.retryable||(error as any)?.checkpointFailure===true;
  const code=input?(error as any).analysisCode||'analysis-input':stage==='model-processing'?failure.code:'analysis-source-unavailable';
  const message=input?error.message:stage==='model-processing'?failure.error:'Analysis could not verify its source right now. Retry to resume saved progress; no PDF upload is needed.';
  const retry=retryable&&job.attempts<5;
  try{await db.runTransaction(async(tx:any)=>{const snap=await tx.get(ref),d=snap.data();if(!d||d.lease!==lease)return;tx.update(ref,{state:retry?'retrying':'failed',error:message,code,retryable,lease:null,retryNotBefore:new Date(Date.now()+60000),updatedAt:new Date()});});}
  catch{throw Error('Analysis progress status could not be saved.');}
  console.warn('[Newsletter Analysis Job]',{jobId:task.jobId,attempt:job.attempts,code,stage:stage==='model-processing'?failure.failureStage:stage,retrying:retry});
  if(retry)throw Error('Retryable newsletter analysis failure. Saved batches are retained.');
 }
}
