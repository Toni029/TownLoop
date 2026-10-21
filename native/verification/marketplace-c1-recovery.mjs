// Only the new read-only fallback is checked here; do not repeat the 51 C1 checks.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || ''))
  throw Error('Loopback emulator required');
const require = createRequire(process.argv[2]);
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, collection, query, where, updateDoc, deleteDoc } = require('firebase/firestore');
const env = await initializeTestEnvironment({ projectId: 'demo-townloop-c1-recovery', firestore: {
  rules: readFileSync(new URL('../../security/c1/firestore.c1-readonly-recovery.rules', import.meta.url), 'utf8'),
} });
try {
  await env.withSecurityRulesDisabled(async c => {
    for (const uid of ['fixture-seller', 'fixture-buyer', 'fixture-outsider'])
      await setDoc(doc(c.firestore(), 'users', uid), { approved: true, role: 'resident' });
    await setDoc(doc(c.firestore(), 'marketplace_chats', 'fixture-chat'), {
      sellerId: 'fixture-seller', buyerId: 'fixture-buyer', messages: [],
    });
  });
  const seller = env.authenticatedContext('fixture-seller').firestore();
  const buyer = env.authenticatedContext('fixture-buyer').firestore();
  const ref = db => doc(db, 'marketplace_chats', 'fixture-chat');
  await assertSucceeds(getDoc(ref(seller)));
  await assertSucceeds(getDocs(query(collection(buyer, 'marketplace_chats'), where('buyerId', '==', 'fixture-buyer'))));
  await assertFails(getDoc(ref(env.authenticatedContext('fixture-outsider').firestore())));
  await assertFails(getDoc(ref(env.unauthenticatedContext().firestore())));
  await assertFails(getDocs(collection(seller, 'marketplace_chats')));
  await assertFails(setDoc(doc(seller, 'marketplace_chats', 'new-fixture'), { sellerId: 'fixture-seller', buyerId: 'fixture-buyer' }));
  await assertFails(updateDoc(ref(seller), { unreadForSeller: false }));
  await assertFails(deleteDoc(ref(seller)));
  console.log('PASS: 8 restricted-recovery assertions; loopback emulator only; no Auth accounts created.');
} finally { await env.cleanup(); }
