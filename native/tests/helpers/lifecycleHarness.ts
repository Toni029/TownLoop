import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
export function lifecycleHarness(file:string,dependencies:(react:any)=>Record<string,any>){
 let cursor=0;const slots:any[]=[],pending:Array<()=>void>=[];
 const react={
  memo:(f:any)=>f,createContext:()=>({Provider:'Provider'}),useContext:()=>false,useId:()=>String(cursor++),
  useState:(initial:any)=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],(value:any)=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
  useRef:(value:any)=>{const i=cursor++;return slots[i]||(slots[i]={current:value});},
  useMemo:(f:any,deps:any[])=>{const i=cursor++,old=slots[i];if(!old||deps.some((d,j)=>d!==old.deps[j]))slots[i]={deps,value:f()};return slots[i].value;},
  useCallback:(f:any,deps:any[])=>react.useMemo(()=>f,deps),
  useEffect:(f:any,deps:any[])=>{const i=cursor++,old=slots[i];if(!old||deps.some((d,j)=>d!==old.deps[j]))pending.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:f()};});},
 };
 const deps=dependencies(react),exports:any={},jsx=(type:any,props:any)=>({type,props});
 const code=ts.transpileModule(fs.readFileSync(new URL('../../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports,require:(name:string)=>{if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};if(!(name in deps))throw Error('Missing fixture '+name);return deps[name];},setTimeout,clearTimeout,setInterval,clearInterval,AbortController,requestAnimationFrame:(f:any)=>{f();return 1;},cancelAnimationFrame:()=>{},...(deps.__globals||{})});
 return{exports,render:(fn:any,props:any={})=>{cursor=0;const tree=fn(props);pending.splice(0).forEach(f=>f());return tree;},dispose:()=>{for(const value of slots)value?.cleanup?.();},slots};
}
export const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
export function appLifecycle(initial='active'){
 const listeners=new Set<(s:string)=>void>();const app={currentState:initial,addEventListener:(_name:string,f:(s:string)=>void)=>{listeners.add(f);return{remove:()=>listeners.delete(f)};}};
 return{app,change(state:string){app.currentState=state;for(const f of [...listeners])f(state);},listeners};
}
export function fakeIntervals(){let next=0,ticks=0;const timers=new Map<number,()=>void>();return{setInterval:(f:()=>void)=>{timers.set(++next,f);return next;},clearInterval:(id:number)=>timers.delete(id),tick(){for(const f of [...timers.values()]){ticks++;f();}},get ticks(){return ticks;},get count(){return timers.size;}};}
export function nodes(tree:any):any[]{if(!tree||typeof tree==='boolean')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
