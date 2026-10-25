import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
test('cache cleanup uses an unambiguous account namespace and preserves other accounts/configuration',async()=>{
 const removed:string[]=[],module={exports:{} as any};let names:string[]=[];
 const code=ts.transpileModule(readFileSync(new URL('../src/localData/privateMediaCache.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:()=>({cacheDirectory:'file:///app/cache/',readDirectoryAsync:async()=>names,deleteAsync:async(p:string)=>{removed.push(p);}})});
 const {accountMediaPrefix,clearPrivateMediaCache}=module.exports;
 names=[accountMediaPrefix('alice')+'one.img',accountMediaPrefix('alice-other')+'two.img','config.json','private-workorder-legacy.img'];
 await clearPrivateMediaCache('alice');assert.deepEqual(removed,['file:///app/cache/'+names[0]]);
});
