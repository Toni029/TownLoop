/** Executes native actions against a disposable local emulator only. */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local disposable emulator required.');
const tooling = createRequire(process.argv[2]);
const local = createRequire(new URL('../package.json',import.meta.url));
const ts=local('typescript');
const fb=tooling('firebase/firestore');
const {initializeTestEnvironment,assertFails}=tooling('@firebase/rules-unit-testing');
const root=fileURLToPath(new URL('../../',import.meta.url));
const env=await initializeTestEnvironment({projectId:'demo-townloop-news',firestore:{rules:readFileSync(path.join(root,'firestore.rules'),'utf8')}});
let checks=0;
function actionsFor(uid, folder) {
  const db=env.authenticatedContext(uid).firestore();
  const cache=new Map();
  function load(file) {
    if(cache.has(file))return cache.get(file).exports;
    const module={exports:{}};cache.set(file,module);
    const output=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const require=(name)=>{
      if(name==='firebase/firestore')return fb;
      if(!name.startsWith('.'))return local(name);
      const stem=path.resolve(path.dirname(file),name);
      if(stem===path.join(root,'native/src/lib/firebase'))return {db};
      if(stem===path.join(root,'native/src/news/actions'))return {approvedUser:async()=>{
        const snap=await fb.getDoc(fb.doc(db,'users',uid));
        if(!snap.exists()||snap.data().approved===false)throw Error('Account must be approved.');
        return {...snap.data(),id:uid};
      }};
      const target=[stem,stem+'.ts',stem+'.tsx'].find(existsSync);if(!target)throw Error(`Unresolved ${name}`);return load(target);
    };
    new Function('require','module','exports',output)(require,module,module.exports);
    return module.exports;
  }
  return {db,actions:load(path.join(root,`native/src/${folder}/actions.ts`))};
}
try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx=>{
    for(const role of ['resident','other','admin','vip','crew','staff','pending'])await fb.setDoc(fb.doc(ctx.firestore(),'users',role),{name:role,email:`${role}@example.invalid`,approved:role!=='pending',role:role==='other'||role==='pending'?'resident':role,address:'Unit test'});
  });
  const resident=actionsFor('resident','workorders'), other=actionsFor('other','workorders'), crew=actionsFor('crew','workorders'), admin=actionsFor('admin','workorders');
  const draft={title:'Emulator only',description:'Local test',category:'Plumbing & Fixtures',photos:[]};
  await Promise.all([resident.actions.submitWorkOrder('one',draft),resident.actions.submitWorkOrder('one',draft)]);
  assert.equal((await fb.getDocs(fb.collection(resident.db,'work_orders'))).size,1);checks++;
  await assert.rejects(other.actions.changeWorkOrder('one','delete'));checks++;
  await assert.rejects(resident.actions.changeWorkOrder('one','complete','fixed','https://example.invalid/proof'));checks++;
  await assert.rejects(crew.actions.changeWorkOrder('one','complete','fixed'));checks++;
  await Promise.all([crew.actions.changeWorkOrder('one','note','first','','first'),crew.actions.changeWorkOrder('one','note','first','','first')]);
  await crew.actions.changeWorkOrder('one','note','second','','second');
  await crew.actions.changeWorkOrder('one','complete','resolved','https://example.invalid/proof','resolution');
  let one=(await fb.getDoc(fb.doc(resident.db,'work_orders','one'))).data();assert.equal(one.status,'Done');assert.equal(one.comments.length,3);checks++;
  await crew.actions.changeWorkOrder('one','complete','resolved','https://example.invalid/proof','resolution');
  assert.equal((await fb.getDoc(fb.doc(resident.db,'work_orders','one'))).data().comments.length,3);checks++;
  await assert.rejects(resident.actions.changeWorkOrder('one','delete'));checks++;
  await crew.actions.changeWorkOrder('one','reopen');one=(await fb.getDoc(fb.doc(resident.db,'work_orders','one'))).data();assert.equal(one.status,'In Progress');assert.equal(one.completedAt,undefined);checks++;
  await resident.actions.changeWorkOrder('one','delete');checks++;
  await resident.actions.submitWorkOrder('two',draft);await admin.actions.changeWorkOrder('two','delete');checks++;
  await assert.rejects(actionsFor('crew','workorders').actions.submitWorkOrder('denied',draft));checks++;
  await assert.rejects(actionsFor('pending','workorders').actions.submitWorkOrder('denied',draft));checks++;
  await assertFails(fb.getDocs(fb.collection(env.unauthenticatedContext().firestore(),'work_orders')));checks++;
  if(process.argv.includes('--social')) {
    // Added in the Social milestone.
  }
  console.log(`${checks} native Work Orders action/permission/idempotence checks passed in a local emulator. No production writes.`);
} finally {await env.cleanup();}
