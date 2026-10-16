// Run only against the disposable local Firestore emulator; no real notifications.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
const require = createRequire(process.argv[2]);
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, getDocs, collection, query, where, deleteDoc } = require('firebase/firestore');
const env = await initializeTestEnvironment({ projectId: 'demo-townloop-inbox', firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
const db = uid => env.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
const message = { id: 'first', senderId: 'resident', body: 'Hello', createdAt: 1 };
const chat = { residentId: 'resident', residentEmail: 'resident@example.test', messages: [message] };
try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    for (const role of ['resident', 'other', 'crew', 'admin', 'vip']) await setDoc(doc(context.firestore(), 'users', role), { role: role === 'other' ? 'resident' : role, approved: true });
  });
  for (const name of ['office_chats', 'maintenance_chats']) {
    const id = 'resident_example_test';
    await assertSucceeds(getDoc(doc(db('resident'), name, id)));
    await assertSucceeds(setDoc(doc(db('resident'), name, id), chat));
    await assertFails(getDoc(doc(db('other'), name, id)));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), name, 'fake'), chat));
    const manager = name === 'office_chats' ? 'vip' : 'crew';
    const outsider = name === 'office_chats' ? 'crew' : 'admin';
    await assertSucceeds(getDocs(collection(db(manager), name)));
    await assertFails(getDoc(doc(db(outsider), name, id)));
    await assertSucceeds(updateDoc(doc(db(manager), name, id), { messages: [message, { ...message, id: 'second', senderId: manager }] }));
    await assertSucceeds(updateDoc(doc(db('resident'), name, id), { messages: [message, { ...message, id: 'second', senderId: manager, readBy: ['resident'] }], unreadByResident: false }));
    await assertFails(updateDoc(doc(db('resident'), name, id), { residentId: 'other' }));
    await assertFails(updateDoc(doc(db('resident'), name, id), { messages: [message, { ...message, id: 'second', senderId: manager, readBy: ['resident'] }, { ...message, id: 'third', senderId: 'admin' }] }));
  }
  const friend = { participantIds: ['resident', 'other'], participants: [{ id: 'resident' }, { id: 'other' }], messages: [message] };
  await assertSucceeds(setDoc(doc(db('resident'), 'resident_chats', 'friend'), friend));
  await assertSucceeds(getDocs(query(collection(db('other'), 'resident_chats'), where('participantIds', 'array-contains-any', ['other', 'other@example.test', 'other_example_test']))));
  await assertFails(getDoc(doc(db('crew'), 'resident_chats', 'friend')));
  await assertFails(setDoc(doc(db('resident'), 'notification_devices', 'fake'), { uid: 'other', token: 'fake' }));
  await assertFails(getDoc(doc(db('admin'), 'notification_devices', 'fake')));
  await assertSucceeds(deleteDoc(doc(db('resident'), 'resident_chats', 'friend')));
  console.log('PASS: Inbox creation, staff routing/access, friend query, receipts, forgery denial, token protection and deletion');
} finally { await env.cleanup(); }
