import {before, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {BASELINE_SHA256, ROOTS, sha256, prepare} = createRequire(import.meta.url)('./prepare-rules.cjs');

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!/^127\.0\.0\.1:\d+$/.test(host || '')) throw Error('Explicit loopback Firestore emulator required; no cloud calls are supported.');
const endpoint = `http://${host}`;
const baselineProject = 'demo-townloop-cleanup-rules-baseline';
const candidateProject = 'demo-townloop-cleanup-rules-candidate';
const projects = [baselineProject, candidateProject];
const privileged = {Authorization: 'Bearer owner', 'Content-Type': 'application/json'};
const social = ['work_orders', 'discussion_feed', 'posts', 'marketplace_posts', 'marketItems'];
const managerOnly = ['newsletters', 'community_events', 'community_highlights'];
const actors = ['resident', 'other', 'crew', 'admin', 'vip', 'pending', 'deleting', 'revoked'];
const value = v => v === null ? {nullValue: null} : Array.isArray(v) ? {arrayValue: {values: v.map(value)}} :
  typeof v === 'object' ? {mapValue: {fields: fields(v)}} : typeof v === 'boolean' ? {booleanValue: v} :
  typeof v === 'number' ? {integerValue: String(v)} : {stringValue: v};
const fields = data => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, value(v)]));
const token = (project, uid) => {
  const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url'), now = Math.floor(Date.now() / 1000);
  return encode({alg: 'none', typ: 'JWT'}) + '.' + encode({iss: `https://securetoken.google.com/${project}`,
    aud: project, sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now,
    email: uid + '@example.invalid', firebase: {sign_in_provider: 'custom'}}) + '.';
};
async function request(project, path, {uid = 'admin', admin = false, method = 'GET', data} = {}) {
  return fetch(`${endpoint}/v1/projects/${project}/databases/(default)/documents/${path}`, {
    method, headers: admin ? privileged : {'Content-Type': 'application/json', ...(uid ? {Authorization: 'Bearer ' + token(project, uid)} : {})},
    ...(data ? {body: JSON.stringify({fields: fields(data)})} : {})});
}
async function status(response, expected, label) {
  const r = await response;
  assert.equal(r.status, expected, `${label}: ${await r.text()}`);
}
const seed = (p, path, data) => status(request(p, path, {admin: true, method: 'PATCH', data}), 200, 'seed ' + path);
const control = collections => collections === null ? status(request(candidateProject, 'database_cleanup_control/active', {admin: true, method: 'DELETE'}), 200, 'clear lock') :
  seed(candidateProject, 'database_cleanup_control/active', {collections});
const published = {userId: 'resident', authorId: 'resident', storageDraft: false, title: 'Fixture', status: 'Queued'};
async function create(project, collection, id) {
  if (!social.includes(collection)) return request(project, `${collection}/${id}`, {method: 'PATCH', data: {title: 'Created'}});
  // A genuine resident draft create uses request.time via a server timestamp transform.
  const name = `projects/${project}/databases/(default)/documents/${collection}/${id}`;
  return fetch(`${endpoint}/v1/projects/${project}/databases/(default)/documents:commit`, {
    method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token(project, 'resident')},
    body: JSON.stringify({writes: [{update: {name, fields: {...fields({userId: 'resident', storageDraft: true}),
      storageDraftExpiresAt: {timestampValue: new Date(Date.now() + 1800000).toISOString()}}},
      updateTransforms: [{fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME'}], currentDocument: {exists: false}}]})});
}
async function mutation(project, collection, operation, suffix) {
  const id = `${operation}-${suffix}`, path = `${collection}/${id}`;
  if (operation === 'create') return create(project, collection, id);
  const data = social.includes(collection) ? published : {title: 'Fixture'};
  await seed(project, path, data);
  return request(project, path, {uid: social.includes(collection) ? 'resident' : 'admin',
    method: operation === 'delete' ? 'DELETE' : 'PATCH', ...(operation === 'update' ? {data: {...data, title: 'Changed'}} : {})});
}

before(async () => {
  const baseline = await readFile(new URL('../account-deletion/firestore.default.candidate.rules', import.meta.url), 'utf8');
  const candidate = await readFile(new URL('./firestore.rules', import.meta.url), 'utf8');
  assert.equal(sha256(baseline), BASELINE_SHA256);
  assert.equal(candidate, prepare(baseline), 'Candidate must be the exact reviewed transformation of the pinned default baseline');
  assert.throws(() => prepare(baseline + '\n'), /baseline drift/);
  // The mechanical check covers every rule, including currently denied and nested paths.
  const declarations = source => [...source.matchAll(/allow\s+([a-z,\s]+):\s*if\s+([^;]+);/g)];
  const readPredicates = source => declarations(source).filter(m => m[1].split(',').every(op => ['get', 'list', 'read'].includes(op.trim()))).map(m => [m[1].replace(/\s/g, ''), m[2]]);
  const baselineReads = declarations(baseline).flatMap(m => {
    const reads = m[1].split(',').map(s => s.trim()).filter(op => ['get', 'list', 'read'].includes(op));
    return reads.length ? [[reads.join(','), m[2]]] : [];
  });
  assert.deepEqual(readPredicates(candidate).slice(3), baselineReads, 'Existing read authorization is byte-for-byte unchanged');
  for (const m of declarations(candidate)) if (m[1].split(',').some(op => ['write', 'create', 'update', 'delete'].includes(op.trim()))) {
    assert.match(m[2], /^databaseCleanupWriteAllowed\(\) && \(/);
    assert.ok(!m[1].split(',').some(op => ['get', 'list', 'read'].includes(op.trim())));
  }
  for (const [project, content] of [[baselineProject, baseline], [candidateProject, candidate]]) {
    await status(fetch(`${endpoint}/emulator/v1/projects/${project}:securityRules`, {method: 'PUT', headers: privileged,
      body: JSON.stringify({rules: {files: [{name: 'firestore.rules', content}]}})}), 200, 'compile rules');
    await status(fetch(`${endpoint}/emulator/v1/projects/${project}/databases/(default)/documents`, {method: 'DELETE', headers: privileged}), 200, 'reset demo data');
    for (const uid of actors) await seed(project, 'users/' + uid, {id: uid, name: uid, email: uid + '@example.invalid',
      role: ['crew', 'admin', 'vip'].includes(uid) ? uid : 'resident', approved: uid !== 'pending', ...(uid === 'deleting' ? {deletionPending: true} : {})});
    await seed(project, 'account_access_revocations/revoked', {uid: 'revoked'});
    for (const c of ROOTS) await seed(project, c + '/read-fixture', c === 'work_orders' ? {...published, userId: 'other'} : published);
    await seed(project, 'newsletters/read-fixture/chunks/0', {data: 'synthetic-pdf'});
    await seed(project, 'resident_directory/resident', {name: 'Resident'});
    await seed(project, 'users/resident/home_preferences/today', {fixture: true});
    await seed(project, 'home_content/today', {fixture: true});
  }
});

test('unlocked candidate preserves canonical roles, account-deletion denials, protected reads, and manager-only writes', async () => {
  for (const uid of [null, ...actors]) {
    const approved = uid && !['pending', 'deleting', 'revoked'].includes(uid);
    for (const p of projects) {
      await status(request(p, 'newsletters/read-fixture', {uid}), approved ? 200 : 403, `${p} newsletter read ${uid}`);
      await status(request(p, 'newsletters/read-fixture/chunks/0', {uid}), approved ? 200 : 403, `${p} chunk read ${uid}`);
      await status(request(p, 'newsletters/role-' + (uid || 'anonymous'), {uid, method: 'PATCH', data: {fixture: true}}),
        ['admin', 'vip'].includes(uid) ? 200 : 403, `${p} newsletter write ${uid}`);
      await status(request(p, 'work_orders/read-fixture', {uid}), approved && ['other', 'crew', 'admin', 'vip'].includes(uid) ? 200 : 403, `${p} private work order ${uid}`);
    }
  }
});

test('each selected whitelist root freezes create/update/delete without changing any baseline authorization', async () => {
  await control(ROOTS);
  for (const c of [...social, ...managerOnly]) for (const operation of ['create', 'update', 'delete']) {
    await status(mutation(baselineProject, c, operation, 'selected'), 200, `baseline ${c} ${operation}`);
    await status(mutation(candidateProject, c, operation, 'selected'), 403, `frozen ${c} ${operation}`);
  }
  for (const p of projects) for (const method of ['GET', 'PATCH', 'DELETE']) {
    await status(request(p, 'newsletter_analysis_jobs/read-fixture', {method, ...(method === 'PATCH' ? {data: {fixture: true}} : {})}), 403, 'analysis jobs stay server-only');
  }
  for (const method of ['PATCH', 'DELETE']) await status(request(candidateProject, 'newsletters/read-fixture/chunks/0', {method, ...(method === 'PATCH' ? {data: {data: 'changed'}} : {})}), 403, 'selected nested chunk');
  await status(request(candidateProject, 'newsletters/read-fixture/chunks/new', {method: 'PATCH', data: {data: 'new'}}), 403, 'selected new chunk');
});

test('only selected collections freeze; Home/profile data and protected reads retain baseline behavior', async () => {
  await control(['work_orders', 'newsletters', 'users', 'home_content']);
  // Even malformed server scope cannot turn non-whitelisted Home/profile collections into cleanup targets.
  for (const c of [...social.filter(c => c !== 'work_orders'), 'community_events', 'community_highlights']) {
    await status(mutation(candidateProject, c, 'update', 'unrelated'), 200, 'unrelated selected-category exclusion ' + c);
  }
  for (const p of projects) {
    await status(request(p, 'users/resident', {uid: 'resident', method: 'PATCH', data: {id: 'resident', name: 'Updated', email: 'resident@example.invalid', role: 'resident', approved: true}}), 200, 'Home self-profile remains writable');
    await status(request(p, 'resident_directory/resident', {uid: 'resident'}), 200, 'Home directory read');
    await status(request(p, 'home_content/today', {uid: 'admin', method: 'PATCH', data: {fixture: true}}), 403, 'Home default deny unchanged');
    await status(request(p, 'users/resident/home_preferences/today', {uid: 'resident'}), 403, 'Home nested default deny unchanged');
    for (const uid of [null, 'resident', 'other', 'crew', 'admin', 'pending', 'deleting', 'revoked']) {
      await status(request(p, 'newsletters/read-fixture', {uid}), uid && !['pending', 'deleting', 'revoked'].includes(uid) ? 200 : 403, 'protected newsletter read during lock');
      await status(request(p, 'work_orders/read-fixture', {uid}), ['other', 'crew', 'admin'].includes(uid) ? 200 : 403, 'private work order read during lock');
    }
  }
});

test('empty, missing collections, and absent control do not lock; nested chunks recover when unlocked', async () => {
  for (const state of [[], 'missing', null]) {
    if (state === 'missing') await seed(candidateProject, 'database_cleanup_control/active', {}); else await control(state);
    await status(create(candidateProject, 'newsletters', 'unlocked-' + String(state)), 200, 'empty or missing selected scope');
    await status(request(candidateProject, 'newsletters/read-fixture/chunks/0', {method: 'PATCH', data: {data: 'still readable'}}), 200, 'unlocked nested chunk');
  }
});

test('persistent per-root fences block mutation, recreation and orphan descendants after lock release', async () => {
  await control(null);
  for (const c of [...social, 'newsletters']) {
    await seed(candidateProject, `database_cleanup_fences/${c}/records/fenced`, {fixture: true});
    await seed(candidateProject, `${c}/fenced`, social.includes(c) ? published : {title: 'Fixture'});
    await status(request(candidateProject, `${c}/fenced`, {uid: social.includes(c) ? 'resident' : 'admin', method: 'PATCH', data: {...(social.includes(c) ? published : {}), title: 'Changed'}}), 403, 'partial processing fence ' + c);
    await status(request(candidateProject, `${c}/fenced`, {uid: 'admin', method: 'DELETE'}), 403, 'fence blocks client delete ' + c);
    await status(request(candidateProject, `${c}/fenced`, {admin: true, method: 'DELETE'}), 200, 'synthetic server deletion ' + c);
    await status(create(candidateProject, c, 'fenced'), 403, 'fence blocks recreation ' + c);
    await status(create(candidateProject, c, 'unfenced'), 200, 'sibling remains writable ' + c);
  }
  await seed(candidateProject, 'newsletters/fenced/chunks/0', {data: 'orphan fixture'});
  for (const method of ['PATCH', 'DELETE']) await status(request(candidateProject, 'newsletters/fenced/chunks/0', {method, ...(method === 'PATCH' ? {data: {data: 'changed'}} : {})}), 403, 'orphan descendant fence');
  await status(request(candidateProject, 'newsletters/fenced/chunks/new', {method: 'PATCH', data: {data: 'new'}}), 403, 'new descendant of erased fenced root');
  await status(request(candidateProject, 'newsletters/fenced/chunks/0', {uid: 'resident'}), 200, 'fences do not remove protected reads');
});

test('current pointer may be republished after unlocking while its legacy descendants remain permanently fenced', async () => {
  const root = 'newsletters/current', fence = 'database_cleanup_fences/newsletters/records/current';
  await seed(candidateProject, fence, {fixture: true});
  await status(request(candidateProject, root, {method: 'PATCH', data: {id: 'future-edition'}}), 403, 'ordinary current fence still blocks root');
  await seed(candidateProject, fence, {fixture: true, descendantsOnly: true});
  await seed(candidateProject, root + '/chunks/old', {data: 'legacy-pdf'});
  await control(['newsletters']);
  await status(request(candidateProject, root, {method: 'PATCH', data: {id: 'future-edition'}}), 403, 'active cleanup still freezes current pointer');
  await control([]);
  await status(request(candidateProject, root, {method: 'PATCH', data: {id: 'future-edition'}}), 200, 'manager can publish future current pointer');
  await status(request(candidateProject, root, {uid: 'vip', method: 'PATCH', data: {id: 'another-edition'}}), 200, 'VIP retains baseline publishing permission');
  await status(request(candidateProject, root, {uid: 'resident', method: 'PATCH', data: {id: 'forbidden'}}), 403, 'exception never grants residents publishing permission');
  for (const method of ['PATCH', 'DELETE']) await status(request(candidateProject, root + '/chunks/old', {method, ...(method === 'PATCH' ? {data: {data: 'changed'}} : {})}), 403, 'legacy current chunk stays fenced');
  await status(request(candidateProject, root + '/chunks/new', {method: 'PATCH', data: {data: 'new'}}), 403, 'new current chunk stays fenced');
  await status(request(candidateProject, root + '/chunks/old', {uid: 'resident'}), 200, 'protected old chunk reads unchanged');
  await status(request(candidateProject, root, {method: 'DELETE'}), 200, 'baseline manager current pointer deletion remains allowed');
  await status(request(candidateProject, root + '/chunks/old', {method: 'DELETE'}), 403, 'orphan legacy current chunk stays fenced');
  await status(request(candidateProject, root, {method: 'PATCH', data: {id: 'republished'}}), 200, 'current pointer can be recreated');
  for (const [collection, id] of [['newsletters', 'ordinary-edition']]) {
    await seed(candidateProject, `database_cleanup_fences/${collection}/records/${id}`, {descendantsOnly: true});
    await status(request(candidateProject, `${collection}/${id}`, {method: 'PATCH', data: {fixture: true}}), 403, 'descendants-only marker cannot relax other permanent root fences');
  }
});

test('authenticated Admin can atomically publish 25 derived records plus edition and current pointer', async () => {
  await control([]);
  for (const project of projects) {
    const records = Array.from({length: 25}, (_, i) => ({path: `${i % 2 ? 'community_events' : 'community_highlights'}/publish-batch-${i}`,
      data: {title: 'Generated fixture', isAiExtracted: true, newsletterId: 'publish-batch'}}));
    records.push({path: 'newsletters/publish-batch', data: {id: 'publish-batch', title: 'Published fixture'}},
      {path: 'newsletters/current', data: {id: 'publish-batch', title: 'Published fixture'}});
    await status(fetch(`${endpoint}/v1/projects/${project}/databases/(default)/documents:commit`, {
      method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token(project, 'admin')},
      body: JSON.stringify({writes: records.map(({path, data}) => ({update: {
        name: `projects/${project}/databases/(default)/documents/${path}`, fields: fields(data)}}))})}), 200, project + ' 27-document client publish');
  }
});

test('shared edition fences deny stale AI-derived writes and old-link stripping while preserving manual content', async () => {
  await control([]);
  await seed(candidateProject, 'database_cleanup_fences/newsletters/records/erased-edition', {fixture: true});
  for (const collection of ['community_events', 'community_highlights']) {
    const linked = {title: 'Generated fixture', isAiExtracted: true, newsletterId: 'erased-edition'};
    const path = `${collection}/stale-derived`;
    await status(request(candidateProject, path, {method: 'PATCH', data: linked}), 403, 'cannot recreate AI content from erased edition');
    await seed(candidateProject, path, linked);
    for (const proposal of [{...linked, title: 'Changed'}, {...linked, newsletterId: 'fresh-edition'},
      {...linked, isAiExtracted: false}, {title: 'Stripped linkage'}]) {
      await status(request(candidateProject, path, {method: 'PATCH', data: proposal}), 403, 'cannot bypass old edition fence by changing or removing attribution');
    }
    await status(request(candidateProject, path, {method: 'DELETE'}), 403, 'old edition fence blocks derived delete');
    await seed(candidateProject, `${collection}/fresh-derived`, {isAiExtracted: true, newsletterId: 'fresh-edition'});
    await status(request(candidateProject, `${collection}/fresh-derived`, {method: 'PATCH', data: linked}), 403, 'cannot move existing record into fenced edition');
    await status(request(candidateProject, `${collection}/fresh-derived`, {method: 'PATCH', data: {title: 'Valid update', isAiExtracted: true, newsletterId: 'fresh-edition'}}), 200, 'unfenced derived update works');
    await status(request(candidateProject, `${collection}/fresh-derived`, {method: 'DELETE'}), 200, 'unfenced derived delete works');
    await seed(candidateProject, `database_cleanup_fences/${collection}/records/manual`, {fixture: true});
    const manual = `${collection}/manual`;
    await status(request(candidateProject, manual, {method: 'PATCH', data: {title: 'Manual content'}}), 200, 'unlinked manual content retains baseline authorization');
    await status(request(candidateProject, manual, {method: 'PATCH', data: {title: 'Manual update', isAiExtracted: false, newsletterId: 'erased-edition'}}), 200, 'manual content never targeted solely for edition field');
    await status(request(candidateProject, manual, {uid: 'resident', method: 'PATCH', data: {title: 'Forbidden resident edit'}}), 403, 'manual exception grants no resident editing permission');
    await status(request(candidateProject, manual, {method: 'DELETE'}), 200, 'manager manual delete remains allowed');
    await control([collection]);
    await status(request(candidateProject, `${collection}/active-lock`, {method: 'PATCH', data: {title: 'Manual'}}), 403, 'selected collection lock still dominates');
    await control([]);
  }
});

test('no client role can read, list, create, update or delete cleanup controls, fences, or jobs', async () => {
  const metadata = ['database_cleanup_control/active', 'database_cleanup_fences/newsletters/records/fenced', 'database_cleanup_jobs/fixture', 'database_cleanup_jobs/fixture/batches/0'];
  for (const path of metadata) await seed(candidateProject, path, {fixture: true});
  for (const uid of [null, ...actors]) for (const path of metadata) for (const method of ['GET', 'PATCH', 'DELETE']) {
    await status(request(candidateProject, path, {uid, method, ...(method === 'PATCH' ? {data: {collections: [], fixture: false}} : {})}), 403, 'private server cleanup metadata');
  }
  for (const uid of [null, 'resident', 'admin', 'vip', 'crew']) {
    for (const path of ['database_cleanup_control/new-', 'database_cleanup_fences/posts/records/new-', 'database_cleanup_jobs/new-']) {
      await status(request(candidateProject, path + (uid || 'anonymous'), {uid, method: 'PATCH', data: {fixture: true}}), 403, 'client cleanup metadata creation');
    }
    for (const collection of ['database_cleanup_control', 'database_cleanup_fences/newsletters/records', 'database_cleanup_jobs']) {
      await status(request(candidateProject, collection, {uid}), 403, 'cleanup metadata list');
    }
  }
});
