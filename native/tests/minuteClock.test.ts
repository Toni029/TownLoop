import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
test('timestamp clock updates, pauses in background, resumes and releases its listener',()=>{
 const exports:any={};let clock=1,tick:Function|undefined,onState:Function=()=>{},cleanup:Function=()=>{},value=0,removed=false,started=0;
 const source=ts.transpileModule(readFileSync(new URL('../src/time/useMinuteNow.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(source,{exports,Date:{now:()=>clock},setInterval:(fn:Function,delay:number)=>{assert.equal(delay,60000);tick=fn;started++;return 1;},clearInterval:()=>{tick=undefined;},require:(name:string)=>name==='react'?{useState:(initial:Function)=>[initial(),(next:number)=>{value=next;}],useEffect:(fn:Function)=>{cleanup=fn();}}:{AppState:{currentState:'active',addEventListener:(_name:string,fn:Function)=>{onState=fn;return {remove:()=>{removed=true;}};}}}});
 exports.useMinuteNow();assert.equal(started,1);clock=2;tick?.();assert.equal(value,2);
 onState('background');assert.equal(tick,undefined);clock=3;onState('active');assert.equal(value,3);assert.equal(started,2);
 cleanup();assert.equal(tick,undefined);assert.equal(removed,true);
});
