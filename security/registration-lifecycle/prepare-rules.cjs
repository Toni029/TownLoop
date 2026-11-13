const fs=require('node:fs'),path=require('node:path');
const {guard}=require('../social-media-lifecycle/prepare-rules.cjs');
function registrationRules(source){
 const anchor='    function isOwner(userId) {';
 source=source.replace(anchor,`    function registrationUsable(uid) {
      return !exists(/databases/$(database)/documents/registration_uid_fences/$(uid));
    }
    match /registration_applications/{uid} { allow read, write: if false; }
    match /registration_restrictions/{id} { allow read, write: if false; }
    match /registration_email_locks/{id} { allow read, write: if false; }
    match /registration_uid_fences/{id} { allow read, write: if false; }
    match /registration_cleanup_jobs/{id} { allow read, write: if false; }
    match /registration_audit/{id} { allow read, write: if false; }
    match /registration_policy/{id} { allow read, write: if false; }
    match /registration_reminders/{id} { allow read, write: if false; }
    match /registration_worker_state/{id} { allow read, write: if false; }
${anchor}`);
 // Pending/terminal profiles are atomically approved=false; no extra read on every protected request.
 const begin=source.indexOf('      allow create: if isOwner(userId) &&');const end=source.indexOf('      allow update:',begin);if(begin<0||end<0)throw Error('Profile creation seam missing');source=source.slice(0,begin)+'      allow create: if false; // Auth creation does not grant a profile; server enrollment only.\n'+source.slice(end);
 source=source.replace("allow update: if !exists(/databases/$(database)/documents/account_access_revocations/$(userId)) &&","allow update: if registrationUsable(userId) && !exists(/databases/$(database)/documents/account_access_revocations/$(userId)) &&");
 source=source.replace("((isManager() && canonicalRole(request.resource.data.role)","((isManager() && resource.data.approved == true && (request.resource.data.role == resource.data.role || currentProfile().role == 'admin') && canonicalRole(request.resource.data.role)");
 source=source.replace('allow delete: if isManager() && !exists(/databases/$(database)/documents/account_access_revocations/$(userId));','allow delete: if isManager() && resource.data.approved == true && registrationUsable(userId) && !exists(/databases/$(database)/documents/account_access_revocations/$(userId));');
 const socialHelper=`
    function socialRetentionPassed(data, key) {
      return data.get(key, null) == null || (data.get(key, null) is timestamp && data[key] <= request.time);
    }
    function socialNotHeld(data) {
      return data.get('legalHold', false) == false && data.get('evidenceHold', false) == false &&
        data.get('retentionHold', false) == false && data.get('hold', false) == false && data.get('reported', false) == false &&
        data.get('holds', {}) == {} && data.get('evidence', null) == null && data.get('reportId', '') == '' &&
        data.get('reportIds', []) == [] && data.get('retention', false) == false && data.get('retentionVersion', null) == null &&
        socialRetentionPassed(data, 'retainUntil') && socialRetentionPassed(data, 'retentionUntil') &&
        socialRetentionPassed(data, 'deleteAfter') && socialRetentionPassed(data, 'retentionDueAt') && socialRetentionPassed(data, 'retentionExpiresAt');
    }
`;
 source=source.replace('    function mediaParentMayCreate',socialHelper+'    function mediaParentMayCreate');
 for(const collection of ['discussion_feed','marketplace_posts']){
  const re=new RegExp('match /'+collection+'/(\\{[^}]+\\}) \\{([\\s\\S]*?)\\n    \\}','g');
  source=source.replace(re,(block)=>block.replace('allow delete: if isApproved()', 'allow delete: if socialNotHeld(resource.data) && isApproved()').replace('allow update: if isApproved()', 'allow update: if socialNotHeld(resource.data) && isApproved()'));
 }
 return source;
}
function storageRules(source){return source;} // Existing profile approval check enforces denial without exceeding Storage's two-document lookup budget.

function prepare(){const base=__dirname;const f=registrationRules(fs.readFileSync(path.join(base,'live-default.rules'),'utf8')),s=storageRules(fs.readFileSync(path.join(base,'live-storage.rules'),'utf8'));fs.writeFileSync(path.join(base,'firestore.candidate.rules'),f);fs.writeFileSync(path.join(base,'storage.candidate.rules'),s);fs.writeFileSync(path.join(base,'coordinated.firestore.rules'),guard(f,false));fs.writeFileSync(path.join(base,'coordinated.storage.rules'),guard(s,true));}
module.exports={registrationRules,storageRules,prepare};if(require.main===module)prepare();
