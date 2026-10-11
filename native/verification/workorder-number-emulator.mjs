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
let checks = 0;
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
  for (const role of ['resident', 'other', 'crew']) await fb.setDoc(fb.doc(ctx.firestore(),'users',role), {name:role, email:role+'@example.invalid',approved:true,role:role==='other'?'resident':role});
 });
 const resident=actionsFor('resident','workorders'), other=actionsFor('other','workorders'), crew=actionsFor('crew','workorders');
 const draft={title:'Counter test',description:'Local emulator only',category:'General Maintenance',photos:[]};
 await Promise.all([resident.actions.submitWorkOrder('one',draft),other.actions.submitWorkOrder('two',draft)]);
 const tickets=await fb.getDocs(fb.collection(crew.db,'work_orders'));
 assert.deepEqual(tickets.docs.map(d=>d.data().ticketNumber).sort(),[10000,10001]);
 await resident.actions.submitWorkOrder('one',draft);
 assert.equal((await fb.getDoc(fb.doc(crew.db,'counters','work_orders'))).data().lastNumber,10001);
 await assertFails(fb.getDoc(fb.doc(resident.db,'work_orders','two')));
 await assertFails(fb.getDocs(fb.collection(resident.db,'work_orders')));
 const own=await fb.getDocs(fb.query(fb.collection(resident.db,'work_orders'),fb.where('userId','==','resident')));
 assert.equal(own.size,1);
 await assertFails(fb.setDoc(fb.doc(resident.db,'counters','work_orders'),{lastNumber:10002,orderId:'fake'}));
 await assertFails(fb.updateDoc(fb.doc(resident.db,'work_orders','one'),{code:'WO-99999'}));
 await assertFails(fb.updateDoc(fb.doc(crew.db,'work_orders','one'),{ticketNumber:99999}));
 await fb.updateDoc(fb.doc(crew.db,'work_orders','one'),{status:'In Progress'});
 console.log('PASS: concurrent sequence, idempotent retry, resident isolation, crew visibility, counter tamper protection');
} finally {await env.cleanup();}
