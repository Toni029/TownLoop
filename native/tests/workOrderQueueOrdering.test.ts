import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
test('queue badges use original submission order even when the listener returns newest first',()=>{
 const exports:any={};const source=ts.transpileModule(readFileSync(new URL('../src/workorders/model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(source,{exports,require:()=>({})});
 const oldest={id:'oldest',createdAt:100,status:'Queued'},middle={id:'middle',createdAt:200,status:'Queued'},newest={id:'newest',createdAt:300,status:'Queued'},done={id:'done',createdAt:50,status:'Done'};
 const positions=exports.pendingQueuePositions([newest,done,middle,oldest]);
 assert.equal(positions.get('oldest'),1);assert.equal(positions.get('middle')-1,1);assert.equal(positions.get('newest')-1,2);assert.equal(positions.has('done'),false);
 const afterCompletion=exports.pendingQueuePositions([newest,middle,{...oldest,status:'Done'}]);assert.equal(afterCompletion.get('middle'),1);
 const reopened=exports.pendingQueuePositions([newest,{...oldest,status:'In Progress'},middle]);assert.equal(reopened.get('oldest'),1);
});
