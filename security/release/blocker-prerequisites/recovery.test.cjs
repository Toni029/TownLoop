const test = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const {loadPlan,intended,approve,mutations} = require('./recovery.cjs');
const {plan,hash}=loadPlan();
const states = () => plan.databases.map(database => ({database,info:{name:`projects/${plan.project}/databases/${database}`,pointInTimeRecoveryEnablement:'POINT_IN_TIME_RECOVERY_DISABLED'},schedules:[]}));
test('default path prints six scoped commands without invoking a cloud client',()=>{
 const result=spawnSync(process.execPath,[path.join(__dirname,'recovery.cjs')],{encoding:'utf8',env:{PATH:''}});
 assert.equal(result.status,0);const output=JSON.parse(result.stdout);
 assert.equal(output.mode,'DRY_RUN_NO_CLOUD_ACCESS');assert.equal(output.commands.length,6);
 assert.equal(output.optionalCommandsNotApplied.length,2);
 assert(output.optionalCommandsNotApplied.every(({args})=>args.includes('--delete-protection')));
 assert(output.commands.every(({args})=>args.includes(`--project=${plan.project}`)));
});
test('example approval rejects before invoking a cloud client',()=>{
 const result=spawnSync(process.execPath,[path.join(__dirname,'recovery.cjs'),'--apply','--approval',path.join(__dirname,'recovery-approval.example.json')],{encoding:'utf8',env:{PATH:''}});
 assert.equal(result.status,1);assert.match(result.stderr,/Apply refused/);assert(!result.stderr.includes('gcloud failed'));
 assert.throws(()=>approve({...require('./recovery-approval.example.json'),planSha256:hash},hash),/Apply refused/);
});
test('both empty database scopes plan exactly PITR and two backups each',()=>{
 assert.deepEqual(mutations(states()),intended());
 assert.throws(()=>mutations(states().slice(0,1)),/Both database/);
});
test('already matching settings do not create duplicate schedules',()=>{
 const existing=states().map(state=>({...state,info:{...state.info,pointInTimeRecoveryEnablement:'POINT_IN_TIME_RECOVERY_ENABLED'},schedules:[{dailyRecurrence:{},retention:'604800s'},{weeklyRecurrence:{day:'SUNDAY'},retention:'2419200s'}]}));
 assert.deepEqual(mutations(existing),[]);
});
test('unexpected retention or database identity stops before the first mutation',()=>{
 const drift=states();drift[1].schedules=[{dailyRecurrence:{},retention:'5184000s'}];
 assert.throws(()=>mutations(drift),/differs/);
 drift[1].info.name='projects/other/databases/(default)';assert.throws(()=>mutations(drift),/scope/);
});
