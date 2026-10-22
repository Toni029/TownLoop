// Focused local-only rules regression tests. No SDK, Auth accounts or live Firebase access.
// FIRESTORE_EMULATOR_HOST=127.0.0.1:8897 node --test security/launch/h8.rules.test.mjs
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8897';
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw Error('Only a loopback Firestore emulator is allowed.');
const project = 'demo-townloop-h8';
const base = `http://${host}`;
const documents = `${base}/v1/projects/${project}/databases/(default)/documents`;
const admin = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const profile = (id, role = 'resident', extra = {}) => ({ id, name: `Name ${id}`, email: `${id}@example.invalid`, role, approved: true, ...extra });
const profiles = {
  Alice: profile('Alice'), alice: profile('alice'), Bob: profile('Bob'), Outsider: profile('Outsider'), Admin: profile('Admin', 'admin'), Vip: profile('Vip', 'vip'), Crew: profile('Crew', 'crew'),
  Pending: profile('Pending', 'resident', { approved: false }), Aliases: profile('Aliases', 'resident', { isAdmin: true, isVip: true, isCrew: true }),
  Unapproved: profile('Unapproved', 'admin', { approved: false }), LegacyStaff: profile('LegacyStaff', 'staff'), MissingApproval: profile('MissingApproval', 'admin'),
};
delete profiles.MissingApproval.approved;
function token(uid, overrides = {}) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ iss: `https://securetoken.google.com/${project}`, aud: project, auth_time: now, user_id: uid, sub: uid,
    iat: now, exp: now + 3600, email: `${uid}@example.invalid`, email_verified: false, firebase: { sign_in_provider: 'custom', identities: {} }, ...overrides })}.`;
}
function value(input) {
  if (input === null) return { nullValue: null };
  if (input instanceof Date) return { timestampValue: input.toISOString() };
  if (Array.isArray(input)) return { arrayValue: { values: input.map(value) } };
  if (typeof input === 'object') return { mapValue: { fields: fields(input) } };
  if (typeof input === 'boolean') return { booleanValue: input };
  if (typeof input === 'number') return Number.isInteger(input) ? { integerValue: String(input) } : { doubleValue: input };
  return { stringValue: input };
}
function fields(input) { return Object.fromEntries(Object.entries(input).map(([key, item]) => [key, value(item)])); }
async function request(path, { method = 'GET', uid, data, owner = false, query = '' } = {}) {
  const response = await fetch(`${documents}/${path}${query}`, { method,
    headers: owner ? admin : { 'Content-Type': 'application/json', ...(uid ? { Authorization: `Bearer ${token(uid)}` } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify({ fields: fields(data) }) }),
  });
  const result = await response.json();
  return { status: response.status, result };
}
async function allowed(promise) { const result = await promise; assert.ok(result.status >= 200 && result.status < 300, JSON.stringify(result)); return result; }
async function denied(promise) { const result = await promise; assert.equal(result.status, 403, JSON.stringify(result)); }
const seed = (path, data) => allowed(request(path, { method: 'PATCH', owner: true, data }));
const write = (path, uid, data) => request(path, { method: 'PATCH', uid, data });
const read = (path, uid) => request(path, { uid });
const message = (uid, id = 'first', body = 'Hello') => ({ id, senderId: uid, senderName: profiles[uid].name, senderRole: profiles[uid].role, senderAvatar: '', body, createdAt: id === 'first' ? 1 : 2, time: 'Now' });
const friend = (id = 'friend') => ({ id, identityVersion: 2, participantIds: ['Alice', 'Bob'], participants: [{ id: 'Alice', name: profiles.Alice.name }, { id: 'Bob', name: profiles.Bob.name }],
  subject: 'Hello', messages: [message('Alice')], lastMessage: 'Hello', updatedAt: 1, unreadBy: ['Bob'] });
const service = (kind, id = 'Alice') => ({ id, residentId: 'Alice', residentName: profiles.Alice.name, residentEmail: '', residentApt: '', residentPhone: '', residentAvatar: '',
  subject: 'Hello', messages: [message('Alice')], lastMessage: 'Hello', updatedAt: 1, unreadByResident: false, [kind === 'office' ? 'unreadByVip' : 'unreadByCrew']: true });

before(async () => {
  const rules = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const loaded = await fetch(`${base}/emulator/v1/projects/${project}:securityRules`, { method: 'PUT', headers: admin,
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: rules }] } }) });
  assert.equal(loaded.status, 200, await loaded.text());
  const cleared = await fetch(`${base}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE', headers: admin });
  assert.equal(cleared.status, 200, await cleared.text());
  profiles.Deleting = profile('Deleting', 'resident', { deletionPending: true });
  for (const [uid, data] of Object.entries(profiles)) await seed(`users/${uid}`, data);
});

async function transformedWrite(path, uid, data, transforms = ['updatedAt']) {
  const response = await fetch(`${documents}:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(uid ? { Authorization: `Bearer ${token(uid)}` } : {}) },
    body: JSON.stringify({ writes: [{ update: { name: `projects/${project}/databases/(default)/documents/${path}`, fields: fields(data) },
      updateTransforms: transforms.map(fieldPath => ({ fieldPath, setToServerValue: 'REQUEST_TIME' })) }] }) });
  return { status: response.status, result: await response.json() };
}


function proposal(){return {status:'pending',requestedBy:'Alice',previous:{phone:'',address:'',dateOfBirth:'',maritalStatus:'',emergencyContactName:'',emergencyContactPhone:'',emergencyContactAddress:''},changes:{phone:'new',emergencyContactName:'Contact',emergencyContactPhone:'contact-phone',emergencyContactAddress:'contact-address'}};}
function order(){return {userId:'Alice',storageDraft:false,status:'In Progress',code:'1000',ticketNumber:1000,createdAt:new Date('2026-01-01'),comments:[]};}
const note={id:'resolution',authorId:'Crew',author:profiles.Crew.name,role:'Maintenance Crew',kind:'resolution',text:'Fixed sink\nVerified operation.',timestamp:'Just now',photoUrl:''};
function complete(before,comment=note){return {...before,status:'Done',completedBy:profiles.Crew.name,retentionVersion:1,resolutionNote:comment.text,resolutionCommentId:comment.id,resolutionCommentIndex:before.comments.length,resolutionAuthorId:'Crew',comments:[...before.comments,comment]};}
function readMap(data){const convert=x=>x?.mapValue?Object.fromEntries(Object.entries(x.mapValue.fields||{}).map(([k,v])=>[k,convert(v)])):x?.arrayValue?(x.arrayValue.values||[]).map(convert):x?.timestampValue?new Date(x.timestampValue):x?.integerValue!==undefined?Number(x.integerValue):x?.booleanValue!==undefined?x.booleanValue:x?.stringValue;return Object.fromEntries(Object.entries(data.fields||{}).map(([k,v])=>[k,convert(v)]));}
test('H8 profile proposals are bounded owner-only requests; direct private-field/approval edits denied',async()=>{
 const before=profiles.Alice;
 const request=proposal();
 await allowed(transformedWrite('users/Alice','Alice',{...before,profileUpdateRequest:request},['profileUpdateRequest.requestedAt']));
 const saved=readMap((await allowed(read('users/Alice','Alice'))).result);
 await denied(write('users/Alice','Alice',{...saved,phone:'bypassed'}));
 await denied(write('users/Alice','Alice',{...saved,approved:true,role:'admin'}));
 await denied(transformedWrite('users/Alice','Alice',{...saved,profileUpdateRequest:{...request,previous:{...request.previous,isAdmin:true}}},['profileUpdateRequest.requestedAt']));
 await denied(transformedWrite('users/Bob','Alice',{...profiles.Bob,profileUpdateRequest:request},['profileUpdateRequest.requestedAt']));
});
test('H8 manager review retains request identity and supports all canonical profile aliases',async()=>{
 const saved=readMap((await allowed(read('users/Alice','Admin'))).result);
 await allowed(transformedWrite('users/Alice','Admin',{...saved,phone:'new',emergencyContactName:'Contact',emergencyContactPhone:'contact-phone',emergencyContactAddress:'contact-address',emergencyContact:'Contact',emergency_contact:'Contact',emergency_contact_phone:'contact-phone',emergency_contact_address:'contact-address',dateOfBirth:'1990-01-01',date_of_birth:'1990-01-01',maritalStatus:'Single',marital_status:'Single',profileUpdateRequest:{...saved.profileUpdateRequest,status:'approved',reviewedBy:'Admin'}},['profileUpdateRequest.reviewedAt']));
});
test('H8 crew completion uses authenticated UID and multiline note; actor impersonation denied',async()=>{
 await seed('work_orders/fresh',order());
 const done=complete(order());
 for(const uid of ['Alice','Admin','Vip',undefined])await denied(transformedWrite('work_orders/fresh',uid,done,['completedAt','updatedAt']));
 await denied(transformedWrite('work_orders/fresh','Crew',complete(order(),{...note,authorId:'Bob'}),['completedAt','updatedAt']));
 await allowed(transformedWrite('work_orders/fresh','Crew',done,['completedAt','updatedAt']));
});
test('H8 reopen and re-complete revises exactly the original UID-owned comment with history',async()=>{
 const done=readMap((await allowed(read('work_orders/fresh','Crew'))).result);
 const {completedAt,completedBy,retentionVersion,resolutionNote,...rest}=done;
 const reopened={...rest,status:'In Progress'};
 await allowed(write('work_orders/fresh','Crew',reopened));
 const revised={...note,text:'Updated resolution',editedAt:'2026-10-21T00:00:00Z',revisions:[{text:note.text,photoUrl:'',timestamp:note.timestamp,editedAt:''}]};
 const next={...reopened,status:'Done',completedBy:profiles.Crew.name,retentionVersion:1,resolutionNote:revised.text,comments:[revised]};
 await denied(transformedWrite('work_orders/fresh','Alice',next,['completedAt','updatedAt']));
 await allowed(transformedWrite('work_orders/fresh','Crew',next,['completedAt','updatedAt']));
});
test('H8 Admin/VIP delete only crew resolutions with audit and preserve completed status',async()=>{
 for(const uid of ['Admin','Vip']){
  const before={...complete(order()),completedAt:new Date('2026-10-21'),updatedAt:new Date('2026-10-21')};
  await seed(`work_orders/delete-${uid}`,before);
  const {resolutionCommentId,resolutionCommentIndex,resolutionAuthorId,...rest}=before;
  const next={...rest,comments:[],resolutionCommentDeletions:[{comment:note,deletedBy:uid,deletedAt:'2026-10-21T00:00:00Z'}]};
  await denied(transformedWrite(`work_orders/delete-${uid}`,'Crew',next,['lastResolutionCommentDeletedAt','updatedAt']));
  await denied(transformedWrite(`work_orders/delete-${uid}`,'Alice',next,['lastResolutionCommentDeletedAt','updatedAt']));
  await allowed(transformedWrite(`work_orders/delete-${uid}`,uid,next,['lastResolutionCommentDeletedAt','updatedAt']));
  const saved=readMap((await allowed(read(`work_orders/delete-${uid}`,'Crew'))).result);
  assert.equal(saved.status,'Done');
  const {completedAt,completedBy,retentionVersion,resolutionNote,...reopen}=saved;
  await allowed(write(`work_orders/delete-${uid}`,'Crew',{...reopen,status:'In Progress'}));
 }
});


test('H10 newsletter documents and chunks require canonical approved access', async () => {
 await seed('newsletters/security-news', { editionTitle: 'Synthetic newsletter' });
 await seed('newsletters/security-news/chunks/part', { content: 'Synthetic content' });
 for (const path of ['newsletters/security-news', 'newsletters/security-news/chunks/part']) {
  await allowed(read(path, 'Alice'));
  await denied(read(path, 'Pending'));
  await denied(read(path, 'MissingApproval'));
  await denied(read(path));
 }
});
