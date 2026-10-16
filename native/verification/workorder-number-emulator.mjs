/** Executes native actions against a disposable local emulator only. */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith("127.0.0.1:"))
  throw Error("Local disposable emulator required.");
const tooling = createRequire(process.argv[2]);
const local = createRequire(new URL("../package.json", import.meta.url));
const ts = local("typescript");
const fb = tooling("firebase/firestore");
const { initializeTestEnvironment, assertFails } = tooling(
  "@firebase/rules-unit-testing",
);
const root = fileURLToPath(new URL("../../", import.meta.url));
const env = await initializeTestEnvironment({
  projectId: "demo-townloop-news",
  firestore: {
    rules: readFileSync(path.join(root, "firestore.rules"), "utf8"),
  },
});

function actionsFor(uid, folder) {
  const db = env.authenticatedContext(uid).firestore();
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const output = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const require = (name) => {
      if (name === "firebase/firestore") return fb;
      if (!name.startsWith(".")) return local(name);
      const stem = path.resolve(path.dirname(file), name);
      if (stem === path.join(root, "native/src/lib/firebase")) return { db };
      if (stem === path.join(root, "native/src/news/actions"))
        return {
          approvedUser: async () => {
            const snap = await fb.getDoc(fb.doc(db, "users", uid));
            if (!snap.exists() || snap.data().approved === false)
              throw Error("Account must be approved.");
            return { ...snap.data(), id: uid };
          },
        };
      const target = [stem, stem + ".ts", stem + ".tsx"].find(existsSync);
      if (!target) throw Error(`Unresolved ${name}`);
      return load(target);
    };
    new Function("require", "module", "exports", output)(
      require,
      module,
      module.exports,
    );
    return module.exports;
  }
  return {
    db,
    actions: load(path.join(root, `native/src/${folder}/actions.ts`)),
  };
}
try {
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async ctx => {
  await fb.setDoc(fb.doc(ctx.firestore(),'counters','work_orders_four_digit'),{lastNumber:999,orderId:'',ready:true});
  await fb.setDoc(fb.doc(ctx.firestore(),'work_order_numbers','1001'),{historical:true});
  for (const role of ['resident', 'other', 'crew', 'admin', 'vip']) await fb.setDoc(fb.doc(ctx.firestore(),'users',role), {name:role, email:role+'@example.invalid',approved:true,role:role==='other'?'resident':role});
 });
 const resident=actionsFor('resident','workorders'), other=actionsFor('other','workorders'), crew=actionsFor('crew','workorders');
 const draft={title:'Counter test',description:'Local emulator only',category:'General Maintenance',photos:[]};
 await Promise.all([resident.actions.submitWorkOrder('one',draft),other.actions.submitWorkOrder('two',draft)]);
 const tickets=await fb.getDocs(fb.collection(crew.db,'work_orders'));
 assert.deepEqual(tickets.docs.map(d=>d.data().ticketNumber).sort(),[1000,1002]);
 await resident.actions.submitWorkOrder('one',draft);
 assert.equal((await fb.getDoc(fb.doc(crew.db,'counters','work_orders_four_digit'))).data().lastNumber,1002);
 await assertFails(fb.getDoc(fb.doc(resident.db,'work_orders','two')));
 await assertFails(fb.getDocs(fb.collection(resident.db,'work_orders')));
 const own=await fb.getDocs(fb.query(fb.collection(resident.db,'work_orders'),fb.where('userId','==','resident')));
 assert.equal(own.size,1);
 await assertFails(fb.setDoc(fb.doc(resident.db,'counters','work_orders'),{lastNumber:10002,orderId:'fake'}));
 await assertFails(fb.updateDoc(fb.doc(resident.db,'work_orders','one'),{code:'WO-99999'}));
 await assertFails(fb.updateDoc(fb.doc(crew.db,'work_orders','one'),{ticketNumber:99999}));
 await fb.updateDoc(fb.doc(crew.db,'work_orders','one'),{status:'In Progress'});
 await assertFails(fb.setDoc(fb.doc(resident.db,'work_orders','forged'),{userId:'resident',ticketNumber:1003,code:'1003'}));
 await assertFails(fb.setDoc(fb.doc(resident.db,'work_order_numbers','1003'),{orderId:'forged'}));
 await assertFails(fb.deleteDoc(fb.doc(resident.db,'work_order_numbers','1000')));
 await assertFails(fb.updateDoc(fb.doc(resident.db,'counters','work_orders_four_digit'),{lastNumber:1004,orderId:''}));
 await env.withSecurityRulesDisabled(async ctx => {
   await fb.updateDoc(fb.doc(ctx.firestore(),'counters','work_orders_four_digit'),{lastNumber:9998});
 });
 await resident.actions.submitWorkOrder('last',draft);
 assert.equal((await fb.getDoc(fb.doc(resident.db,'work_orders','last'))).data().code,'9999');
 await assert.rejects(other.actions.submitWorkOrder('exhausted',draft), /used/);
 assert.equal((await fb.getDoc(fb.doc(other.db,'work_orders','exhausted'))).exists(),false);
 // Previously published five-digit clients still submit atomically during rollout.
 await fb.runTransaction(resident.db,async tx => {
   await tx.get(fb.doc(resident.db,'counters','work_orders'));
   tx.set(fb.doc(resident.db,'counters','work_orders'),{lastNumber:10000,orderId:'legacy-client'});
   tx.set(fb.doc(resident.db,'work_orders','legacy-client'),{userId:'resident',ticketNumber:10000,code:'WO-10000',status:'Queued',comments:[]});
 });

 const admin=actionsFor('admin','workorders'), vip=actionsFor('vip','workorders');
 await assertFails(fb.deleteDoc(fb.doc(crew.db,'work_orders','one')));
 await assertFails(fb.deleteDoc(fb.doc(other.db,'work_orders','one')));
 await assertFails(fb.updateDoc(fb.doc(resident.db,'work_orders','one'), {status:'Done', completedAt:fb.serverTimestamp()}));
 await assert.rejects(crew.actions.changeWorkOrder('one','complete','   '));
 await crew.actions.changeWorkOrder('one','complete','Repaired safely');
 const done = (await fb.getDoc(fb.doc(crew.db,'work_orders','one'))).data();
 assert.equal(done.status,'Done'); assert.equal(done.resolutionNote,'Repaired safely');
 assert.equal(typeof done.completedAt.toMillis,'function'); assert.equal(done.retentionVersion,1);
 await assertFails(fb.deleteDoc(fb.doc(crew.db,'work_orders','one')));
 await assertFails(fb.deleteDoc(fb.doc(resident.db,'work_orders','one')));
 await assertFails(fb.updateDoc(fb.doc(resident.db,'work_orders','one'), {status:'Queued'}));
 await assertFails(fb.updateDoc(fb.doc(crew.db,'work_orders','one'), {completedAt:fb.Timestamp.fromMillis(0)}));
 await crew.actions.changeWorkOrder('one','reopen');
 assert.equal((await fb.getDoc(fb.doc(crew.db,'work_orders','one'))).data().retentionVersion,undefined);
 await crew.actions.changeWorkOrder('one','complete','Fixed again');
 await admin.actions.changeWorkOrder('one','delete');
 await vip.actions.changeWorkOrder('two','delete');
 await resident.actions.changeWorkOrder('last','delete');
 console.log('PASS: role deletion rules, trusted completion, optional photos, reopening and immutable reservations');
 console.log('PASS: concurrent sequence, idempotent retry, resident isolation, crew visibility, counter tamper protection');
} finally {await env.cleanup();}
