// Offline by default. Never reads credentials or invokes gcloud without a reviewed approval.
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {spawnSync} = require('node:child_process');
const planFile = path.join(__dirname, 'recovery.plan.json');
const project = 'cc-livingcommunity-app';
const databases = ['(default)', 'ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb'];
function loadPlan() {
  const bytes = fs.readFileSync(planFile), plan = JSON.parse(bytes);
  if (plan.project !== project || JSON.stringify(plan.databases) !== JSON.stringify(databases) ||
      plan.pitr.enabled !== true || plan.pitr.providerWindowDays !== 7 ||
      plan.daily.retentionDays !== 7 || plan.weekly.retentionDays !== 28 || plan.weekly.day !== 'SUNDAY' ||
      !Object.values(plan.restore).every(value => value === true)) throw Error('Recovery plan drift: review the fixed scope before any apply.');
  return {plan, hash:createHash('sha256').update(bytes).digest('hex')};
}
const base = database => [`--project=${project}`, `--database=${database}`];
function intended() {
  return databases.flatMap(database => [
    ['firestore','databases','update',...base(database),'--enable-pitr'],
    ['firestore','backups','schedules','create',...base(database),'--recurrence=daily','--retention=7d'],
    ['firestore','backups','schedules','create',...base(database),'--recurrence=weekly','--day-of-week=SUN','--retention=28d'],
  ]);
}
function approve(record, hash) {
  if (record.action !== 'ENABLE_RECOVERY_ONLY' || record.project !== project || record.planSha256 !== hash ||
      typeof record.ownerApprovalReference !== 'string' || record.ownerApprovalReference.length < 8 || /REQUIRED|TODO|PLACEHOLDER/.test(record.ownerApprovalReference) ||
      !['costsAccepted','retentionApproved','restoreReconciliationApproved'].every(key => record[key] === true)) throw Error('Apply refused: an explicit owner decision for this exact plan, costs, retention and isolated reconciliation is required.');
}
function mutations(states) {
  const commands = [];
  for (const {database, info, schedules} of states) {
    if (!databases.includes(database) || info.name !== `projects/${project}/databases/${database}` || !Array.isArray(schedules)) throw Error('Unexpected metadata scope; no changes authorized.');
    if (!['POINT_IN_TIME_RECOVERY_ENABLED','POINT_IN_TIME_RECOVERY_DISABLED'].includes(info.pointInTimeRecoveryEnablement)) throw Error('Unknown PITR state; stop for review.');
    if (info.pointInTimeRecoveryEnablement === 'POINT_IN_TIME_RECOVERY_DISABLED') commands.push(intended().find(args => args.includes(`--database=${database}`) && args.includes('--enable-pitr')));
    for (const [kind, seconds] of [['daily',604800],['weekly',2419200]]) {
      const matches = schedules.filter(s => kind === 'daily' ? s.dailyRecurrence : s.weeklyRecurrence);
      if (matches.length > 1 || matches.some(s => s.retention !== `${seconds}s` || kind === 'weekly' && s.weeklyRecurrence.day !== 'SUNDAY')) throw Error('Existing backup schedule differs from the proposal. Preserve it and review; no replacement or deletion is performed.');
      if (!matches.length) commands.push(intended().find(args => args.includes(`--database=${database}`) && args.includes(`--recurrence=${kind}`)));
    }
    if (schedules.some(s => !s.dailyRecurrence && !s.weeklyRecurrence)) throw Error('Unknown backup recurrence; stop for review.');
  }
  if (states.length !== 2 || new Set(states.map(s => s.database)).size !== 2) throw Error('Both database preflights are required.');
  return commands;
}
function gcloud(args) {
  const result = spawnSync('gcloud', [...args, '--format=json'], {encoding:'utf8', maxBuffer:1024*1024, timeout:120000});
  if (result.error || result.status !== 0) throw Error('gcloud failed; inspect the selected account/project and operation metadata. No automatic retry or rollback.');
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}
function main(args = process.argv.slice(2)) {
  const {hash} = loadPlan();
  if (!args.length || args.length === 1 && args[0] === '--dry-run') {
    console.log(JSON.stringify({mode:'DRY_RUN_NO_CLOUD_ACCESS',project,databases,planSha256:hash,commands:intended().map(args => ({command:'gcloud',args})),optionalCommandsNotApplied:databases.map(database=>({command:'gcloud',args:['firestore','databases','update',...base(database),'--delete-protection']})),warning:'Historical owner deferral remains in force. Review cost, retention and isolated restore before separate activation approval. Optional database deletion protection requires a separate owner decision and is not applied by this helper.'},null,2));
    return;
  }
  if (args.length !== 3 || args[0] !== '--apply' || args[1] !== '--approval') throw Error('Use --dry-run, or --apply --approval <reviewed-decision.json>.');
  approve(JSON.parse(fs.readFileSync(args[2],'utf8')),hash); // Gate before any gcloud/credential access.
  const states = databases.map(database => ({database,
    info:gcloud(['firestore','databases','describe',...base(database)]),
    schedules:gcloud(['firestore','backups','schedules','list',...base(database)]),
  }));
  const commands = mutations(states); // Preflight both scopes before the first mutation.
  for (const args of commands) gcloud(args);
  console.log(JSON.stringify({appliedOperations:commands.length,verificationRequired:true,warning:'Confirm both PITR settings and schedule metadata; no restore, data access, IAM, rules, Auth or cleanup changes were performed.'}));
}
module.exports = {loadPlan,intended,approve,mutations,main};
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode=1; } }
