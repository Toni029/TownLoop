const {test}=require('node:test'),assert=require('node:assert/strict'),{build}=require('esbuild');
async function load(){const result=await build({entryPoints:['server/newsletterAnalysisErrors.ts'],bundle:true,platform:'node',format:'cjs',write:false});const m={exports:{}};new Function('module','exports',result.outputFiles[0].text)(m,m.exports);return m.exports;}
test('quota, outage, timeout, credentials, missing model and parsing failures have safe distinct responses',async()=>{
 const {newsletterAnalysisFailure}=await load();
 for(const [error,code,status,retryable,stage] of [
  [{status:503},'gemini-unavailable',503,true,'model-processing'],
  [{status:429},'gemini-quota',429,true,'model-processing'],
  [{name:'AbortError',message:'request aborted'},'gemini-timeout',504,true,'model-processing'],
  [{status:403,newsletterStage:'gemini-upload'},'gemini-configuration',503,false,'gemini-upload'],
  [{status:404},'gemini-model-unavailable',503,false,'model-processing'],
  [new SyntaxError('private response text secret-key'),'gemini-response',502,true,'response-parsing'],
  [{newsletterStage:'response-parsing'},'gemini-response',502,true,'response-parsing'],
 ]){const value=newsletterAnalysisFailure(Object.assign(error,{message:error.message||'secret-key private document contents'}));
 assert.equal(value.code,code);assert.equal(value.httpStatus,status);assert.equal(value.retryable,retryable);assert.equal(value.failureStage,stage);
 assert.match(value.error,/retained.*no reupload/);assert.doesNotMatch(JSON.stringify(value),/secret-key|private document contents|private response text/);
 }
});
test('transient retries back off, remain bounded, and respect the whole-analysis deadline',async()=>{
 const {retryGeminiGeneration}=await load();let count=0,clock=0;const waits=[];
 const result=await retryGeminiGeneration(async timeout=>{assert.equal(timeout,60);if(++count===1)throw {status:503};return 'verified';},{deadline:5000,timeout:60,attempts:2,now:()=>clock,wait:async ms=>{waits.push(ms);clock+=ms;}});
 assert.equal(result,'verified');assert.equal(count,2);assert.equal(waits.length,1);assert.ok(waits[0]>=1000&&waits[0]<1250);
 count=0;await assert.rejects(retryGeminiGeneration(async()=>{count++;throw {status:503};},{deadline:10,timeout:60,attempts:2,now:()=>0,wait:async()=>{throw Error('must not wait beyond deadline');}}));assert.equal(count,1);
 for(const error of [{status:403},{status:400},new SyntaxError('malformed')]){count=0;await assert.rejects(retryGeminiGeneration(async()=>{count++;throw error;},{deadline:5000,timeout:60,attempts:2,now:()=>0,wait:async()=>{}}));assert.equal(count,1);}
 count=0;await assert.rejects(retryGeminiGeneration(async()=>{count++;return 'bad';},{deadline:0,timeout:60,attempts:2,now:()=>1}),/deadline/);assert.equal(count,0);
 count=0;await assert.rejects(retryGeminiGeneration(async()=>{count++;throw {status:503};},{deadline:5000,timeout:60,attempts:2,now:()=>0,wait:async()=>{}}));assert.equal(count,2);
});
