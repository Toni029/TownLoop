const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { jobIdFor, SHARED, validateRequest, referencesUid, approvedRetention, approvedSocialDeletion, ownsSocial } = require('./accountDeletionPolicy.cjs');
const completedScopes=job=>{job.createdAt ??=Date.now();return require('./accountDeletionScope.cjs').DATABASES.map(databaseId=>({databaseId,uid:job.uid,policyReference:job.review.policyReference,inventoryVersion:require('./accountDeletionInventory.cjs').INVENTORY_VERSION,inventoryComplete:true,recordsComplete:true,writesFrozen:true,unresolvedIdentityCount:0,unresolvedMediaCount:0,completedAt:Date.now()}));};
function harness(initial, authorizeProcessing = false) {
  if (authorizeProcessing) for (const [path, job] of Object.entries(initial)) if (path.startsWith("account_deletion_jobs/") && !path.includes("/inventory/")) job.review = { decision: "approved", processingAuthorized: true, reviewerId: "fixture-manager", reviewedAt:Date.now(), policyReference: initial["deletion_policies/account"]?.approvalReference || "owner-approved-ticket", ...job.review };
  const records = new Map(Object.entries(initial));
  const snapshot = path => ({ id: path.split('/').at(-1), ref: doc(path), exists: records.has(path), data: () => records.get(path) });
  function doc(path) { return { path, get: async () => snapshot(path), update: async patch => {
    assert.ok(records.has(path)); records.set(path, { ...records.get(path), ...patch });
  }, collection: name => query(`${path}/${name}`) }; }
  function query(path, filters = [], cursor = '', count = Infinity) {
    return { where: (key, operator, value) => { assert.ok(['==', 'in'].includes(operator)); return query(path, [...filters, [key, value, operator]], cursor, count); },
      orderBy: () => query(path, filters, cursor, count), startAfter: value => query(path, filters, value, count), limit: value => query(path, filters, cursor, value),
      doc: id => doc(`${path}/${id}`), get: async () => {
        const docs = [...records.keys()].filter(key => (path.startsWith('@group/') ? key.split('/').at(-2) === path.slice(7) && key > cursor : key.startsWith(`${path}/`) && key.split('/').length === path.split('/').length + 1 && key.split('/').at(-1) > cursor))
          .sort().filter(key => filters.every(([field, value, operator]) => operator === 'in' ? value.includes(records.get(key)[field]) : records.get(key)[field] === value)).slice(0, count).map(snapshot);
        return { docs, size: docs.length, empty: !docs.length };
      } };
  }
  const db = { doc, collection: query, collectionGroup:name=>query('@group/'+name), batch: () => {
    const changes = [], batch = { set: (ref, value) => changes.push(() => records.set(ref.path, value)),
      update: (ref, value) => changes.push(() => records.set(ref.path, { ...records.get(ref.path), ...value })),
      delete: ref => changes.push(() => records.delete(ref.path)), commit: async () => changes.forEach(change => change()) }; return batch;
  } };
  db.runTransaction = async action => action({ get: async ref => ref.get(),
    create: (ref, value) => { assert.equal(records.has(ref.path), false); records.set(ref.path, value); },
    set: (ref, value) => records.set(ref.path, value), update: (ref, value) => records.set(ref.path, { ...records.get(ref.path), ...value }),
    delete: ref => records.delete(ref.path) });
  const authCalls = [], auth = { updateUser: async uid => authCalls.push(['disable', uid]), revokeRefreshTokens: async uid => authCalls.push(['revoke', uid]), deleteUser: async uid => authCalls.push(['delete', uid]) };
  auth.verifyIdToken = async (token, checkRevoked) => {
    assert.equal(checkRevoked, true);
    if (!['valid', 'wrong-account'].includes(token)) throw Error('revoked');
    return { uid: token === 'valid' ? 'alice' : 'bob', auth_time: Date.now() / 1000 };
  };
  const warnings = [], adminAlerts = [];
  const exports = {}, context = { exports, module: { exports }, require: name => {
    if (name === './deletionMediaReferences.cjs' || name === './accountDeletionRetention.cjs' || name === './accountDeletionScope.cjs') return require(name);
    if (['./accountDeletionV2.cjs','./accountDeletionReview.cjs','./accountDeletionMonitor.cjs'].includes(name)) { const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve(name),'utf8'),{exports:module.exports,module,require:n=>context.require(n),Date,process:context.process});return module.exports; }
    if (name === './deletionAlertExpiry.cjs') return {expireAlertClaims:async()=>{}};
    if (name === './accountDeletionAdminAlerts.cjs') return {notifyAdmins:async()=>{adminAlerts.push('generic_admin_digest');}};
    if (name === './accountDeletionInventory.cjs' || name === './accountDeletionStatus.cjs') return require(name);
    if (name === './accountDeletionPolicy.cjs') return require(name);
    if (name === 'firebase-functions') return {logger:{warn:(_message,data)=>warnings.push(data)}};
    if (name === 'node:crypto') return require(name);
    if (name === 'firebase-functions/v2/https') return { onCall: (_, fn) => fn, HttpsError: class extends Error { constructor(code, message) { super(message); this.code = code; } } };
    if (name === 'firebase-functions/v2/scheduler') return { onSchedule: (_, fn) => fn };
    if (name === 'firebase-admin/firestore') return { getFirestore: () => db, FieldPath: { documentId: () => '__name__' }, FieldValue: { serverTimestamp: () => 'server-time', delete: () => null } };
    if (name === 'firebase-admin/auth') return { getAuth: () => auth };
    throw Error(`Unexpected import: ${name}`);
  }, process: { env: { TOWNLOOP_ACCOUNT_DELETION_ENABLED: authorizeProcessing ? 'true' : 'false', TOWNLOOP_DELETION_REVIEW_MONITOR_ENABLED: authorizeProcessing ? 'true' : 'false' } }, Date };
  vm.runInNewContext(fs.readFileSync(require.resolve('./accountDeletion.cjs'), 'utf8') + '\nmodule.exports.run = processJob;', context);
  return { warnings, adminAlerts, enableAdminAlerts:()=>{context.process.env.TOWNLOOP_DELETION_ADMIN_ALERTS_ENABLED='true';}, records, db, auth, authCalls, schedule: context.module.exports.resumeAccountDeletions, escalate:context.module.exports.escalateAccountDeletionRequests, request: context.module.exports.requestAccountDeletion, requestOnly: context.module.exports.submitAccountDeletionRequest, status: context.module.exports.getAccountDeletionStatus, list: context.module.exports.listAccountDeletionRequests, review: context.module.exports.reviewAccountDeletionRequest, run: context.module.exports.run, ref: doc('account_deletion_jobs/job') };
}
test('deletion request requires the confirmation word and recent authentication, not just a refreshed token', () => {
  const now = 100000000, auth = { uid: 'alice', token: { auth_time: now / 1000 } };
  assert.equal(validateRequest(null, { confirmation: 'DELETE' }, now), 'unauthenticated');
  for(const confirmation of ['DELETE','delete','Delete','DeLeTe','  dElEtE  ']) assert.equal(validateRequest(auth, {confirmation}, now),null);
  for(const confirmation of ['delet','delete now','delete delete','',null,{},['delete']]) assert.equal(validateRequest(auth, {confirmation}, now),'confirmation-required');
  assert.equal(validateRequest({ ...auth, token: { auth_time: now / 1000 - 301 } }, { confirmation: 'DELETE' }, now), 'recent-login-required');
  assert.equal(validateRequest({ ...auth, token: { auth_time: Infinity } }, { confirmation: 'DELETE' }, now), 'recent-login-required');
  assert.equal(validateRequest(auth, { confirmation: 'DELETE' }, now), null);
  assert.equal(jobIdFor('alice'), jobIdFor('alice')); assert.notEqual(jobIdFor('alice'), jobIdFor('bob'));
});
test('inventory recognizes nested authors, participants, market sides and UID-keyed maps without guessing names', () => {
  for (const value of [{ comments: [{ authorId: 'alice' }] }, { participants: [{ id: 'alice' }] }, { participantIds: ['alice'] }, { buyerId: 'alice' }, { readBy: { alice: 1 } }]) assert.ok(referencesUid(value, 'alice'));
  assert.equal(referencesUid({ author: 'Alice', text: 'alice', authorId: 'bob' }, 'alice'), false);
  assert.ok(SHARED.includes('marketplace_chats'));
});
test('unknown, invented duration and unapproved anonymization decisions fail closed', () => {
  for (const policy of [undefined, { ownerApproved: true }, { ownerApproved: true, approvalReference: 'owner-1', collections: { posts: { action: 'anonymize', reason: 'review' } } }]) assert.equal(approvedRetention(policy, 'posts'), false);
});
test('callable re-verifies revocation and identity, deduplicates requests without freezing accounts or taking a target UID', async () => {
  const h = harness({ 'users/alice': { approved: true }, 'users/bob': { approved: true }, 'resident_directory/alice': { name: 'Alice' } });
  const request = token => ({ auth: { uid: 'alice', token: { auth_time: Date.now() / 1000 } }, data: { confirmation: 'DELETE', requestOnly: true, uid: 'bob' }, rawRequest: { headers: { authorization: `Bearer ${token}` } } });
  await assert.rejects(h.request(request('revoked')), error => error.code === 'unauthenticated');
  await assert.rejects(h.request(request('wrong-account')), error => error.code === 'failed-precondition');
  const first = await h.request(request('valid')), second = await h.request(request('valid'));
  assert.equal(first.jobId, second.jobId); assert.equal(first.jobId, jobIdFor('alice'));
  assert.equal([...h.records.keys()].filter(path => path.startsWith('account_deletion_jobs/')).length, 1);
  assert.equal(h.records.get('users/alice').deletionPending, undefined); assert.equal(h.records.get('users/bob').deletionPending, undefined);
  assert.equal(h.records.has('resident_directory/alice'), true);
});
test('retryable phases preserve shared history and block private/Auth erasure until owner policy approval', async () => {
  const h = harness({ 'account_deletion_jobs/job': { uid: 'alice', phase: 'disable', status: 'queued', collectionIndex: 0, cursor: '' },
    'users/alice': { name: 'Alice', deletionPending: true }, 'users/bob': { name: 'Bob' },
    'resident_directory/alice': { name: 'Alice' }, 'notification_devices/a': { uid: 'alice' }, 'notification_devices/b': { uid: 'bob' },
    'resident_chats/shared': { participantIds: ['alice', 'bob'], messages: [{ senderId: 'bob', text: 'preserve' }] },
    'work_order_numbers/WO-1': { orderId: 'old' }, 'counters/workOrders': { value: 9 } }, true);
  for (let step = 0; step < SHARED.length + 5; step++) await h.run(h.db, h.auth, h.ref);
  assert.equal(h.records.get(h.ref.path).status, 'pending_owner_approval');
  assert.ok(h.records.has('users/alice')); assert.equal(h.authCalls.some(([action]) => action === 'delete'), false);
  assert.equal(h.records.get('resident_chats/shared').messages[0].text, 'preserve');
  h.records.get(h.ref.path).databaseCompletion=completedScopes(h.records.get(h.ref.path));
  h.records.set('deletion_policies/account', { ownerApproved: true, approvalReference: 'owner-approved-ticket', collections: Object.fromEntries(SHARED.map(collection => [collection, { action: 'retain', reason: 'Synthetic approved policy fixture' }])) });
  for (let step = 0; step < SHARED.length + 8; step++) await h.run(h.db, h.auth, h.ref);
  assert.equal(h.records.get(h.ref.path).status, 'complete');
  assert.equal(h.records.has('users/alice'), false); assert.equal(h.records.has('notification_devices/a'), false);
  assert.ok(h.records.has('users/bob')); assert.ok(h.records.has('notification_devices/b'));
  assert.ok(h.records.has('resident_chats/shared')); assert.ok(h.records.has('work_order_numbers/WO-1')); assert.equal(h.records.get('counters/workOrders').value, 9);
  assert.equal(h.authCalls.filter(([action]) => action === 'delete').length, 1);
});
test('inventory pages resume after a durable cursor and do not skip the 101st matching record', async () => {
  const initial = { 'account_deletion_jobs/job': { uid: 'alice', phase: 'inventory', collectionIndex: 0, cursor: '' } };
  for (let n = 0; n < 101; n++) initial[`work_orders/${String(n).padStart(3, '0')}`] = { userId: 'alice' };
  const h = harness(initial, true); await h.run(h.db, h.auth, h.ref);
  assert.equal(h.records.get(h.ref.path).cursor, '099');
  await h.run(h.db, h.auth, h.ref);
  assert.equal(h.records.get(h.ref.path).collectionIndex, 1);
  assert.equal([...h.records.keys()].filter(path => path.includes('/inventory/')).length, 101);
});
test('active durable lease skips overlapping cron work; expired lease is reclaimable and released', async () => {
  const h = harness({ 'account_deletion_jobs/job': { uid: 'alice', phase: 'disable', status: 'queued', collectionIndex: 0, cursor: '', leaseOwner: 'another-run', leaseUntil: Date.now() + 60000 } }, true);
  await h.schedule(); assert.equal(h.authCalls.length, 0);
  h.records.get(h.ref.path).leaseUntil = Date.now() - 1;
  await h.schedule(); assert.deepEqual(h.authCalls, []);
  assert.equal(h.records.get(h.ref.path).status, 'pending_owner_approval');
  assert.equal(h.records.get(h.ref.path).leaseOwner, null); assert.equal(h.records.get(h.ref.path).leaseUntil, null);
});
test('approved social deletion checks current canonical ownership and leaves shared author references pending', async () => {
  const approval = { ownerApproved: true, approvalReference: 'actual-owner-ticket', collections: { posts: { action: 'delete_owned_social', reason: 'Approved own-content deletion' } } };
  assert.equal(approvedSocialDeletion(approval, 'posts'), true); assert.equal(approvedSocialDeletion(approval, 'work_orders'), false);
  assert.equal(ownsSocial({ userId: 'alice', authorId: 'bob' }, 'alice'), false);
  const initial = { 'account_deletion_jobs/job': { uid: 'alice', phase: 'policy', status: 'processing' },
    'deletion_policies/account': approval,
    'posts/own': { userId: 'alice', comments: [{ authorId: 'bob', text: 'comment' }] },
    'posts/shared': { userId: 'bob', comments: [{ authorId: 'alice', text: 'keep pending policy' }] },
    'work_orders/keep': { userId: 'alice' } };
  for (const path of ['posts/own', 'posts/shared', 'work_orders/keep']) initial[`account_deletion_jobs/job/inventory/${jobIdFor(path)}`] = { path, collection: path.split('/')[0], state: 'pending_policy' };
  const h = harness(initial, true); await h.run(h.db, h.auth, h.ref);
  assert.equal(h.records.has('posts/own'), false); assert.ok(h.records.has('posts/shared')); assert.ok(h.records.has('work_orders/keep'));
  assert.equal(h.records.get(`account_deletion_jobs/job/inventory/${jobIdFor('posts/own')}`).state, 'deleted_owned_social');
  assert.equal(h.records.get(`account_deletion_jobs/job/inventory/${jobIdFor('posts/shared')}`).state, 'pending_policy');
  await h.run(h.db, h.auth, h.ref); assert.equal(h.records.get(h.ref.path).status, 'pending_owner_approval');
  h.records.get(h.ref.path).databaseCompletion=completedScopes(h.records.get(h.ref.path));
  approval.collections.posts.sharedReferences = { action: 'retain', reason: 'Approved other-resident conversation continuity' };
  approval.collections.work_orders = { action: 'retain', reason: 'Approved work-order continuity' };
  for (let step = 0; step < 6; step++) await h.run(h.db, h.auth, h.ref);
  assert.equal(h.records.get(h.ref.path).status, 'identity_complete_media_pending');
  assert.ok(h.records.has('posts/shared')); assert.ok(h.records.has('work_orders/keep'));
  const receipt = h.records.get(`account_deletion_jobs/job/inventory/${jobIdFor('posts/own')}`), cleanupPath = `media_cleanup_jobs/${receipt.cleanupJobId}`;
  assert.equal(h.records.get(cleanupPath).status, 'queued'); assert.ok(h.records.has('media_deletion_tombstones/posts/records/own'));
  const saved = h.records.get(cleanupPath); h.records.delete(cleanupPath);
  await h.run(h.db, h.auth, h.ref); assert.equal(h.records.get(h.ref.path).mediaCleanupStatus, 'missing_cleanup_job_requires_review');
  h.records.set(cleanupPath, { ...saved, status: 'pending_legacy_review' });
  await h.run(h.db, h.auth, h.ref); assert.equal(h.records.get(h.ref.path).status, 'identity_complete_media_pending');
  h.records.get(cleanupPath).status = 'complete';
  await h.run(h.db, h.auth, h.ref); assert.equal(h.records.get(h.ref.path).status, 'complete');
  assert.equal(h.records.get(h.ref.path).mediaCleanupStatus, 'all_tracked_jobs_complete');
});

test('request-only submission keeps the account, directory and authentication usable', async () => {
 const h=harness({'users/alice':{approved:true},'resident_directory/alice':{name:'Synthetic'}});
 const result=await h.request({auth:{uid:'alice',token:{auth_time:Date.now()/1000}},data:{confirmation:'DELETE',requestOnly:true},rawRequest:{headers:{authorization:'Bearer valid'}}});
 assert.equal(result.status,'requested');
 assert.equal(h.records.get('users/alice').deletionPending,undefined);
 assert.equal(h.records.has('resident_directory/alice'),true);
 assert.deepEqual(h.authCalls,[]);
 assert.equal(h.records.get(`account_deletion_jobs/${result.jobId}`).phase,'requested');
});
test('request-only processing waits for supported policy readiness without disabling access', async () => {
 const h=harness({'users/alice':{approved:true},'resident_directory/alice':{name:'Synthetic'},'account_deletion_jobs/job':{uid:'alice',phase:'requested',status:'requested'}});
 await h.run(h.db,h.auth,h.ref);
 assert.equal(h.records.get(h.ref.path).status,'requested');
 assert.equal(h.records.get('users/alice').deletionPending,undefined);
 assert.equal(h.records.has('resident_directory/alice'),true);
 assert.deepEqual(h.authCalls,[]);
});

test('request-only worker does not silently treat a 60-day policy as indefinite retention', async () => {
 const collections=Object.fromEntries(SHARED.map(collection=>[collection,{action:'retain',reason:'Synthetic',retentionDays:60}]));
 const h=harness({'users/alice':{approved:true},'deletion_policies/account':{ownerApproved:true,approvalReference:'fixture',collections},'account_deletion_jobs/job':{uid:'alice',phase:'requested',status:'requested'}});
 await h.run(h.db,h.auth,h.ref);
 assert.equal(h.records.get(h.ref.path).status,'requested');
 assert.deepEqual(h.authCalls,[]);
 assert.equal(h.records.get('users/alice').deletionPending,undefined);
});

test('request-only protocol has a distinct endpoint and preserves the same durable queue', async () => {
 const h = harness({'users/alice':{approved:true}, 'resident_directory/alice':{name:'Synthetic'}});
 assert.equal(typeof h.requestOnly, 'function');
 const input={auth:{uid:'alice',token:{auth_time:Date.now()/1000}},data:{confirmation:'DELETE',requestOnly:true},rawRequest:{headers:{authorization:'Bearer valid'}}};
 const first=await h.requestOnly(input), retry=await h.request(input);
 assert.equal(first.jobId,retry.jobId);
 assert.equal(h.records.get('users/alice').deletionPending,undefined);
 assert.equal(h.records.has('resident_directory/alice'),true);
 assert.equal(h.authCalls.length,0);
});

test('a submitted request cannot enter destructive processing without individual approval, even with an approved policy', async () => {
 const h=harness({'users/alice':{approved:true},'deletion_policies/account':{ownerApproved:true,approvalReference:'fixture',collections:Object.fromEntries(SHARED.map(c=>[c,{action:'retain',reason:'Synthetic'}]))},'account_deletion_jobs/job':{uid:'alice',phase:'requested',status:'requested'}});
 await h.run(h.db,h.auth,h.ref); assert.equal(h.records.get(h.ref.path).phase,'requested'); assert.deepEqual(h.authCalls,[]);
 assert.equal(h.records.get('users/alice').deletionPending,undefined);
});

const reviewInput = (actor = 'bob', data = {}) => ({ auth: {uid:actor}, rawRequest:{headers:{authorization:`Bearer ${actor === 'alice' ? 'valid' : 'wrong-account'}`}}, data });
const supportedPolicy = () => ({ownerApproved:true,policyVersion:2,identityCoverageVerified:true,mediaCoverageVerified:true,databaseScopeVerified:true,retentionDays:60,reviewBusinessDays:3,escalationCalendarDays:7,completionCalendarDays:7,approvalReference:require('./accountDeletionRetention.cjs').POLICY_ID,collections:Object.fromEntries(SHARED.map(c=>[c,{action:'retain',reason:'Synthetic explicit policy'}]))});
const reviewFixture = (role='admin', approved=true) => ({'users/bob':{role,approved},'users/alice':{role:'resident',approved:true},[`account_deletion_jobs/${jobIdFor('alice')}`]:{uid:'alice',phase:'requested',status:'requested'},'deletion_policies/account':supportedPolicy()});
const decision = (choice='approved') => ({jobId:jobIdFor('alice'),decision:choice,confirmation:choice,reason:'Synthetic review reason',reasonCategory:'requester_withdrawal',reasonReference:'fixture-case'});
for (const role of ['resident','crew','Admin']) test(`${role} cannot review deletion requests`,async()=>{
 const h=harness(reviewFixture(role)); await assert.rejects(h.review(reviewInput('bob',decision())),e=>e.code==='permission-denied'); assert.deepEqual(h.authCalls,[]);
});
for (const role of ['admin','vip']) test(`${role}: independent approval queues only, creates audit, and is idempotent`,async()=>{
 const h=harness(reviewFixture(role)); const result=await h.review(reviewInput('bob',decision())); assert.equal(result.status,'approved_held');
 assert.equal([...h.records.keys()].filter(k=>k.startsWith(`account_deletion_jobs/${jobIdFor('alice')}/reviews/`)).length,1);
 assert.equal((await h.review(reviewInput('bob',decision()))).status,'approved_held');
 assert.equal(h.records.get(`account_deletion_jobs/${jobIdFor('alice')}`).phase,'requested'); assert.deepEqual(h.authCalls,[]);
 await assert.rejects(h.review(reviewInput('bob',decision('rejected'))),e=>e.code==='failed-precondition');
});
test('unapproved manager and self-review are denied by the backend',async()=>{
 const h=harness(reviewFixture('admin',false)); await assert.rejects(h.review(reviewInput('bob',decision())),e=>e.code==='permission-denied');
 h.records.set('users/alice',{role:'admin',approved:true}); await assert.rejects(h.review(reviewInput('alice',decision())),e=>e.code==='permission-denied');
});
test('rejection and own-status are available without authorizing deletion or exposing another request',async()=>{
 const h=harness(reviewFixture()); await h.review(reviewInput('bob',decision('rejected')));
 const result=await h.status(reviewInput('alice',{uid:'bob'})); assert.equal(result.status,'rejected'); assert.equal(result.reason,'Synthetic review reason'); assert.equal(result.uid,undefined); assert.equal(result.review,undefined);
 const retry=await h.requestOnly({...reviewInput('alice'),auth:{uid:'alice',token:{auth_time:Date.now()/1000}},data:{confirmation:'DELETE',requestOnly:true}});
 assert.equal(retry.status,'rejected','duplicate must return the real existing status'); assert.deepEqual(h.authCalls,[]);
});
test('incomplete processing policy allows held review only; residents cannot read review queue',async()=>{
 const h=harness(reviewFixture()); h.records.set('deletion_policies/account',{ownerApproved:true,approvalReference:'fixture-policy',collections:Object.fromEntries(SHARED.map(c=>[c,{action:'retain',reason:'Synthetic',retentionDays:60}]))});
 assert.equal((await h.review(reviewInput('bob',decision()))).status,'approved_held');
 assert.equal(h.records.get(`account_deletion_jobs/${jobIdFor('alice')}`).review.processingAuthorized,false);
 await assert.rejects(h.list(reviewInput('alice')),e=>e.code==='permission-denied');
});
test('operator activation and a separate valid approval are both required, even with a complete policy',async()=>{
 const initial=reviewFixture(); const h=harness(initial); const ref=h.db.doc(`account_deletion_jobs/${jobIdFor('alice')}`);
 await h.review(reviewInput('bob',decision())); await h.run(h.db,h.auth,ref); assert.equal(h.records.get(ref.path).phase,'requested'); assert.deepEqual(h.authCalls,[]);
 const enabled=harness(reviewFixture(),true); const r=enabled.db.doc(ref.path); delete enabled.records.get(r.path).review;
 await enabled.run(enabled.db,enabled.auth,r); assert.equal(enabled.records.get(r.path).phase,'requested'); assert.deepEqual(enabled.authCalls,[]);
});
test('status rejects revoked sessions and manager queue returns only review-safe fields',async()=>{
 const h=harness({...reviewFixture(),'resident_directory/alice':{name:'Fixture resident',phone:'must-not-return'}});
 await assert.rejects(h.status({auth:{uid:'alice'},rawRequest:{headers:{authorization:'Bearer revoked'}}}),e=>e.code==='unauthenticated');
 await assert.rejects(h.list({}),e=>e.code==='unauthenticated');
 const result=await h.list(reviewInput('bob',{}));assert.equal(result.requests.length,1);
 assert.equal(result.requests[0].name,'Fixture resident');assert.equal(result.requests[0].uid,undefined);assert.equal(result.requests[0].phone,undefined);
 assert.equal(result.policyReady,true);
});
test('v2 canonical deletion is retryable, preserves the other participant and ticket reservations, and retains receipts only until expiry',async()=>{
 const id=jobIdFor('alice'),other={id:'m2',senderId:'bob',body:'Other private message'};
 const initial=reviewFixture();initial['account_deletion_jobs/'+id].createdAt=Date.now();
 initial['work_orders/one']={userId:'alice',code:'1234',status:'Done',description:'private',comments:[]};
 initial['work_order_numbers/1234']={orderId:'one'};
 initial['resident_chats/shared']={identityVersion:2,participantIds:['alice','bob'],messages:[{id:'m1',senderId:'alice',body:'remove'},other]};
 initial['posts/other']={userId:'bob',comments:[{authorId:'alice',text:'remove'},{authorId:'bob',text:'keep'}]};
 const h=harness(initial,true),ref=h.db.doc('account_deletion_jobs/'+id);
 h.records.get(ref.path).databaseCompletion=completedScopes(h.records.get(ref.path));
 for(let i=0;i<60;i++)await h.run(h.db,h.auth,ref);
 assert.equal(h.records.has('users/alice'),false);assert.ok(h.records.has('users/bob'));
 assert.equal(h.records.get('work_orders/one').code,'1234');assert.equal(h.records.get('work_orders/one').userId,undefined);assert.ok(h.records.has('work_order_numbers/1234'));
 assert.equal(h.records.get('posts/other').comments.length,1);assert.equal(h.records.get('resident_chats/shared').messages[1].body,other.body);
 assert.equal(h.records.get(ref.path).status,'retention_pending');assert.equal(h.authCalls.filter(([x])=>x==='delete').length,1);
});
test('delays require a legitimate case, finite review date, and do not reset original deadlines',async()=>{
 const initial=reviewFixture();initial['account_deletion_jobs/'+jobIdFor('alice')].createdAt=Date.now();const h=harness(initial);
 const input={...decision('delayed'),reasonCategory:'legal_obligation',reasonReference:'fixture-case',delayUntil:Date.now()+86400000};
 await h.review(reviewInput('bob',input));await h.review(reviewInput('bob',input));
 assert.equal([...h.records.keys()].filter(k=>k.includes('/reviews/')).length,1);
 assert.equal(h.records.get('account_deletion_jobs/'+jobIdFor('alice')).status,'delayed');assert.deepEqual(h.authCalls,[]);
 await assert.rejects(h.review(reviewInput('bob',{...input,reasonReference:'bad',delayUntil:Infinity})),e=>e.code==='invalid-argument');
 await assert.rejects(h.review(reviewInput('bob',{...decision('rejected'),reasonCategory:'security_investigation'})),e=>e.code==='failed-precondition');
});
test('failed jobs remain scheduled and retry their durable phase',async()=>{
 const h=harness({'account_deletion_jobs/job':{uid:'alice',phase:'private',status:'failed',createdAt:Date.now(),failureCount:1}},true);
 // The earlier failure occurred before private erasure; retry must remain eligible.
 h.records.get(h.ref.path).databaseCompletion=completedScopes(h.records.get(h.ref.path));
 await h.schedule();assert.notEqual(h.records.get(h.ref.path).status,'failed');assert.ok(h.authCalls.some(([x])=>x==='delete'));
});
test('expired completed and withdrawn receipts erase only their own minimal records, never user accounts',async()=>{
 const created=Date.now()-61*86400000,due=require('./accountDeletionRetention.cjs').deadlines(created).retentionDueAt;
 const h=harness({'users/alice':{approved:true},'account_deletion_jobs/job':{uid:'alice',phase:'requested',status:'rejected',createdAt:created},'account_deletion_jobs/job/reviews/review':{decision:'rejected'},'users/bob':{approved:true}},true);
 await h.run(h.db,h.auth,h.ref);await h.run(h.db,h.auth,h.ref);assert.equal(h.records.has(h.ref.path),false);assert.ok(h.records.has('users/alice'));assert.deepEqual(h.authCalls,[]);
});
test('seven-day review escalation is durable, idempotent, and never approves or deletes',async()=>{
 const h=harness({'account_deletion_jobs/job':{uid:'alice',phase:'requested',status:'requested',createdAt:Date.now()-8*86400000,lastAttemptAt:1},'users/alice':{approved:true}},true);
 delete h.records.get(h.ref.path).review;
 await h.escalate();await h.escalate();assert.equal(h.records.get(h.ref.path).escalated,true);assert.equal([...h.records.keys()].filter(k=>k.includes('/reviews/')).length,1);
 assert.equal(h.records.get(h.ref.path).status,'requested');assert.deepEqual(h.authCalls,[]);assert.ok(h.records.has('users/alice'));
 assert.equal(h.warnings.length,1);assert.equal(h.warnings[0].code,'TOWNLOOP_DELETION_REVIEW_OVERDUE');assert.deepEqual(Object.keys(h.warnings[0]).sort(),['code','newAlerts']);
});
test('review monitoring is disabled by default',async()=>{
 const h=harness({'account_deletion_jobs/job':{uid:'alice',status:'requested',createdAt:Date.now()-8*86400000}});
 await h.escalate();assert.equal(h.records.get(h.ref.path).escalated,undefined);
});
test('a transient Auth failure is recorded and the next scheduled invocation retries successfully',async()=>{
 const h=harness({'account_deletion_jobs/job':{uid:'alice',phase:'auth',status:'queued',createdAt:Date.now()}},true);
 h.records.get(h.ref.path).databaseCompletion=completedScopes(h.records.get(h.ref.path));
 let first=true;h.auth.deleteUser=async uid=>{if(first){first=false;throw Error('synthetic transient failure');}h.authCalls.push(['delete',uid]);};
 await h.schedule();assert.equal(h.records.get(h.ref.path).status,'failed');assert.equal(h.records.get(h.ref.path).failureCount,1);
 await h.schedule();assert.equal(h.records.get(h.ref.path).status,'complete');assert.equal(h.authCalls.filter(([x])=>x==='delete').length,1);
});
test('60-day completed audit expiry is bounded, retryable and preserves unrelated audit records',async()=>{
 const created=Date.now()-61*86400000,due=require('./accountDeletionRetention.cjs').deadlines(created).retentionDueAt;
 const initial={'account_deletion_jobs/job':{uid:'alice',phase:'retention_receipts',status:'retention_pending',createdAt:created,policyVersion:2},'deletion_policies/account':supportedPolicy(),'account_deletion_jobs/job/inventory/one':{state:'redacted',expireRecord:true,path:'moderation_audit/one'},'moderation_audit/one':{status:'handled',deletionExpiresAt:due},'moderation_audit/other':{status:'handled'}};
 const h=harness(initial,true);for(let i=0;i<4;i++)await h.run(h.db,h.auth,h.ref);
 assert.equal(h.records.has('moderation_audit/one'),false);assert.ok(h.records.has('moderation_audit/other'));assert.equal(h.records.has(h.ref.path),false);assert.deepEqual(h.authCalls,[]);
});

test('review approval cannot activate processing even when all worker flags are enabled',async()=>{
 const h=harness(reviewFixture(),true),ref=h.db.doc(`account_deletion_jobs/${jobIdFor('alice')}`);
 delete h.records.get(ref.path).review;
 await h.review(reviewInput('bob',decision()));
 await h.run(h.db,h.auth,ref);
 assert.equal(h.records.get(ref.path).status,'approved_held');
 assert.equal(h.records.get(ref.path).phase,'requested');
 assert.deepEqual(h.authCalls,[]);
 assert.equal((await h.status(reviewInput('alice'))).processingHeld,true);
});

test('three-business-day reminder is distinct from seven-day escalation and does not process',async()=>{
 // Six calendar days always exceeds three weekdays but is before seven calendar days.
 const created=Date.now()-6*86400000;
 const h=harness({'account_deletion_jobs/job':{uid:'alice',phase:'requested',status:'requested',createdAt:created,lastAttemptAt:1}},true);
 delete h.records.get(h.ref.path).review;
 await h.escalate();
 const job=h.records.get(h.ref.path);
 assert.equal(job.reviewOverdue,true);assert.equal(job.escalated,false);assert.equal(job.escalationReason,'review_due');
 assert.equal(job.status,'requested');assert.deepEqual(h.authCalls,[]);
});

test('automatic Admin delivery requires both explicit non-destructive monitor flags',async()=>{
 const input=()=>({'account_deletion_jobs/job':{uid:'alice',status:'requested',createdAt:Date.now()-8*86400000,lastAttemptAt:1}});
 const disabled=harness(input());disabled.enableAdminAlerts();await disabled.escalate();assert.deepEqual(disabled.adminAlerts,[]);
 const prepared=harness(input(),true);delete prepared.records.get(prepared.ref.path).review;await prepared.escalate();assert.deepEqual(prepared.adminAlerts,[]);
 prepared.enableAdminAlerts();await prepared.escalate();assert.deepEqual(prepared.adminAlerts,['generic_admin_digest']);assert.deepEqual(prepared.authCalls,[]);assert.equal(prepared.records.get(prepared.ref.path).status,'requested');
});

test('shared Auth and private data survive absent or incomplete cross-database proof',async()=>{
 for(const phase of ['private','auth']) {
  const h=harness({'account_deletion_jobs/job':{uid:'alice',phase,status:'queued',createdAt:Date.now()},'users/alice':{approved:true},'resident_directory/alice':{name:'fixture'}},true);
  h.records.get(h.ref.path).databaseCompletion=completedScopes(h.records.get(h.ref.path)).slice(0,1);
  await h.run(h.db,h.auth,h.ref);assert.deepEqual(h.authCalls,[]);assert.ok(h.records.has('users/alice'));assert.ok(h.records.has('resident_directory/alice'));assert.equal(h.records.get(h.ref.path).lastError,'cross_database_completion_required');
 }
});
test('permission failures pause for human repair instead of endlessly retrying',async()=>{
 const h=harness({'account_deletion_jobs/job':{uid:'alice',phase:'auth',status:'queued',createdAt:Date.now()}},true);h.records.get(h.ref.path).databaseCompletion=completedScopes(h.records.get(h.ref.path));
 let attempts=0;h.auth.deleteUser=async()=>{attempts++;throw Object.assign(Error('synthetic denied'),{code:7});};await h.schedule();assert.equal(h.records.get(h.ref.path).status,'needs_review');await h.schedule();assert.equal(attempts,1);
});
test('optional review note and standard approval audit entry remain held and preserve audit evidence',async()=>{
 for(const reason of ['Approved without an additional note.','Reviewer fixture note']){
  const h=harness(reviewFixture());const result=await h.review(reviewInput('bob',{jobId:jobIdFor('alice'),decision:'approved',confirmation:'approved',reason}));
  assert.equal(result.status,'approved_held');const job=h.records.get(`account_deletion_jobs/${jobIdFor('alice')}`);assert.equal(job.review.reason,reason);assert.equal(job.review.processingAuthorized,false);assert.deepEqual(h.authCalls,[]);
  const receipts=[...h.records].filter(([path])=>path.startsWith(`account_deletion_jobs/${jobIdFor('alice')}/reviews/`));assert.equal(receipts.length,1);assert.equal(receipts[0][1].reason,reason);
 }
});
