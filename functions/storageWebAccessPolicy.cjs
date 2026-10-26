const WEB_DATABASE = 'ai-studio-cclivingv27-5fc1a0f6-cd75-4964-8c9e-e219a265f7bb';
const POLICY_PATH = 'storage_web_authorization/policy';
function webMembership(profile) {
 const approved=profile?.approved===true&&profile.deletionPending!==true&&['admin','vip','crew','resident'].includes(profile.role);
 return {approved,role:approved?profile.role:''};
}
// Projection contains only authorization metadata. Never copy names, contacts or private records.
async function syncWebMembership(defaultDb,webDb,uid) {
 if(typeof uid!=='string'||!uid||uid.includes('/'))throw Error('Invalid UID');
 const [snapshot]=await webDb.getAll(webDb.doc(`users/${uid}`),{fieldMask:['role','approved','deletionPending']});
 const ref=defaultDb.doc(POLICY_PATH);
 await defaultDb.runTransaction(async tx=>{
  const current=await tx.get(ref),before=current.data()?.members?.[uid];
  const observedAt=snapshot.readTime;
  if(!observedAt)throw Error('Missing authoritative read timestamp');
  if(before?.observedAt&&(before.observedAt.seconds>observedAt.seconds||before.observedAt.seconds===observedAt.seconds&&before.observedAt.nanoseconds>=observedAt.nanoseconds))return;
  if(!snapshot.exists){if(before){const members={...(current.data()?.members||{})};delete members[uid];tx.update(ref,{members});}return;}
  tx.set(ref,{members:{[uid]:{...webMembership(snapshot.exists?snapshot.data():null),observedAt}}},{merge:true});
 });
}
module.exports={WEB_DATABASE,POLICY_PATH,webMembership,syncWebMembership};
