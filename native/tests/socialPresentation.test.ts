import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync(new URL('../src/social/model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const model:any={};
vm.runInNewContext(source,{exports:model,require:()=>({marketLeft:()=>false})});
test('real creation timestamps replace saved Just now labels for posts and listings',()=>{
 const date='2026-10-20T14:30:00.000Z',ms=Date.parse(date);
 for(const read of [model.readPost,model.readListing]){
  for(const value of [{toMillis:()=>ms},{seconds:ms/1000,nanoseconds:0},{_seconds:ms/1000},ms,date,new Date(ms)]){
   const item=read('fixture',{createdAt:value,timeAgo:'Just now'});
   assert.equal(item.createdAt,ms);assert.notEqual(item.timeAgo,'Just now');assert.match(item.timeAgo,/2026/);
  }
  const missing=read('legacy',{timeAgo:'Just now'});assert.equal(missing.timeAgo,'Date unavailable');
 }
});
test('resident labels come from the selected community without inventing a community',()=>{
 assert.equal(model.communityResidentLabel('cecil_pines'),'Cecil Pines Resident');
 assert.equal(model.communityResidentLabel(null),'Community Resident');
});
