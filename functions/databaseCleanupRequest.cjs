'use strict';
// A verified Admin request advances only its own requested job, never a background schedule.
async function advanceCleanupRequest(service,uid,input,{maxSteps=4,now=Date.now}={}){
 let result=await service.operate(uid,input);
 if(input.action==='scope')return result;
 const deadline=now()+20000;
 for(let i=0;i<maxSteps&&now()<deadline&&['planning','queued','running'].includes(result.state);i++){
  if(!await service.tick(result.id))break;
  result=await service.operate(uid,{action:'status',jobId:result.id});
 }
 return result;
}
module.exports={advanceCleanupRequest};
