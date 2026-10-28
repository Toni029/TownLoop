import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path:string,modules:Record<string,any>,extra:Record<string,any>={}){
 const context:any={exports:{},require:(id:string)=>modules[id],...extra};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);return context.exports;
}
function filesFixture(){
 const files=new Map<string,string>(),timers:Array<()=>void>=[];let downloads=0,checks=0,stale=false;let loader=async()=>'data:application/pdf;base64,JVBERi0xLjcK';
 class File{uri:string;constructor(...parts:any[]){this.uri=parts.join('/');}get exists(){return files.has(this.uri);}get size(){return this.exists?100:0;}write(data:string){files.set(this.uri,data);}delete(){files.delete(this.uri);}}
 const auth={currentUser:{uid:'resident-a'} as {uid:string}|null};
 const api=load('../src/news/files.ts',{
  'expo-file-system':{File,Paths:{cache:'cache'}},'expo-sharing':{},'expo-document-picker':{},
  '../lib/firebase':{auth},'../localData/privateMediaCache':{accountMediaPrefix:(uid:string)=>`townloop-private-${uid}-`},
  './model':{editionKey:(c:any)=>c.id+'|'+c.uploadedAt},
  './download':{downloadPdfBytes:async()=>{throw Error('Unexpected fallback');}},
  './edition':{MAX_PDF_BYTES:32*1024*1024,activeEdition:async()=>{checks++;if(stale)throw Error('Edition changed');},loadPdfData:async()=>{downloads++;return loader();}},
 },{setTimeout:(fn:()=>void)=>{timers.push(fn);return timers.length-1;},clearTimeout:()=>{}});
 return {api,auth,files,timers,downloads:()=>downloads,checks:()=>checks,stale:()=>{stale=true;},setLoader:(next:()=>Promise<string>)=>{loader=next;}};
}
const config={id:'oct',uploadedAt:1};
test('reopening reuses one verified account-scoped PDF, and simultaneous readers share preparation',async()=>{
 const f=filesFixture();const a=await f.api.preparePdf(config);a.dispose();const b=await f.api.preparePdf(config);
 assert.equal(a.uri,b.uri);assert.equal(f.downloads(),1);assert.ok(f.checks()>0,'Reused private files require current-edition authorization');
 const [c,d]=await Promise.all([f.api.preparePdf(config),f.api.preparePdf(config)]);assert.equal(c.uri,d.uri);assert.equal(f.downloads(),1);b.dispose();c.dispose();d.dispose();
});
test('changed editions, account switches and explicit retry cannot reuse an old file',async()=>{
 const f=filesFixture();const a=await f.api.preparePdf(config);a.dispose();
 const b=await f.api.preparePdf({...config,uploadedAt:2});assert.notEqual(a.uri,b.uri);assert.equal(f.files.has(a.uri),false);b.dispose();
 f.auth.currentUser={uid:'resident-b'};const c=await f.api.preparePdf({...config,uploadedAt:2});assert.notEqual(b.uri,c.uri);c.dispose();
 f.api.invalidatePreparedPdf();const d=await f.api.preparePdf({...config,uploadedAt:2});assert.notEqual(c.uri,d.uri);d.dispose();
 f.stale();await assert.rejects(f.api.preparePdf({...config,uploadedAt:2}),/Edition changed/);
});
test('idle PDF bytes expire, live leases survive invalidation until disposed, and signed-out readers are denied',async()=>{
 const f=filesFixture();const a=await f.api.preparePdf(config);f.api.invalidatePreparedPdf();assert.equal(f.files.has(a.uri),true);a.dispose();await Promise.resolve();assert.equal(f.files.has(a.uri),false);
 const b=await f.api.preparePdf(config);b.dispose();f.timers.at(-1)!();await Promise.resolve();assert.equal(f.files.has(b.uri),false);
 f.auth.currentUser=null;await assert.rejects(f.api.preparePdf(config),/sign in/i);
});
function readerFixture(){
 let cursor=0;const slots:any[]=[],timers:Array<()=>void>=[],nativeCommands:number[]=[];
 const hooks={useState:(initial:any)=>{const i=cursor++;if(!(i in slots))slots[i]=i===0?'file:///newsletter.pdf':initial;return [slots[i],(v:any)=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useRef:(value:any)=>{const i=cursor++;return slots[i]||(slots[i]={current:value});},useEffect:()=>{},useMemo:(fn:any)=>fn(),useCallback:(fn:any)=>fn};
 const jsx=(type:any,props:any)=>({type,props});const api=load('../src/news/PdfReader.tsx',{
  react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{View:'View',Modal:'Modal',Platform:{OS:'android'},AppState:{},KeyboardAvoidingView:'KeyboardAvoidingView',Pressable:'Pressable',ActivityIndicator:'Spinner'},
  '../keyboard/KeyboardScrollView':{TextInput:'TextInput'},'../components/SystemBars':{SystemBars:'Bars'},'react-native-safe-area-context':{SafeAreaView:'Safe'},'lucide-react-native':{},
  './ui':{Copy:'Copy',Action:'Action',s:{row:{}}},'./PdfPages':{PdfPages:'PdfPages'},'./files':{},'./edition':{},'./model':{editionKey:()=> 'oct'},
 },{setTimeout:(fn:()=>void)=>{timers.push(fn);return timers.length-1;},clearTimeout:()=>{}});
 const render=()=>{cursor=0;return api.PdfReader({config,onClose(){}});};
 return {render,timers,nativeCommands};
}
function find(node:any,type:string):any{if(!node)return;if(Array.isArray(node))return node.map(n=>find(n,type)).find(Boolean);if(node.type===type)return node;return find(node.props?.children,type);}
test('native pinch scale stays display-only after gesture settlement and preserves the viewer viewport',()=>{
 const f=readerFixture();let pdf=find(f.render(),'PdfPages');const initial=pdf.props.scale;
 pdf.props.onPageChanged(2);pdf.props.onScaleChanged(2);f.timers.forEach(fn=>fn());pdf=find(f.render(),'PdfPages');
 assert.equal(pdf.props.scale,initial,'Native pinch must never be echoed back as a scale prop that reloads the document');
});

test('explicit native zoom controls still dispatch a command even when reset repeats the initial scale',()=>{
 let exposed:any;const commands:any[]=[];const native={setPage:(page:number)=>commands.push({page}),setNativeProps:(props:any)=>commands.push(props)};
 const jsx=(type:any,props:any)=>({type,props});
 const api=load('../src/news/PdfPages.tsx',{react:{memo:(fn:any)=>fn,forwardRef:(fn:any)=>fn,useRef:()=>({current:native}),useImperativeHandle:(_:any,create:any)=>{exposed=create();}},'react/jsx-runtime':{jsx,jsxs:jsx},'react-native-pdf':{default:'Pdf'}});
 api.PdfPages({},{});exposed.setScale(1);exposed.setScale(1);exposed.setPage(2);
 assert.deepEqual(JSON.parse(JSON.stringify(commands)),[{scale:1},{scale:1},{page:2}]);
});

test('an account change during preparation discards the file; failed downloads can be retried',async()=>{
 const f=filesFixture();let finish:(data:string)=>void=()=>{};
 f.setLoader(()=>new Promise<string>(resolve=>{finish=resolve;}));const pending=f.api.preparePdf(config);f.auth.currentUser={uid:'resident-b'};
 finish('data:application/pdf;base64,JVBERi0xLjcK');await assert.rejects(pending,/sign in/i);assert.equal(f.files.size,0);
 f.setLoader(async()=>{throw Error('Interrupted download');});await assert.rejects(f.api.preparePdf(config),/Interrupted/);
 f.setLoader(async()=> 'data:application/pdf;base64,JVBERi0xLjcK');const good=await f.api.preparePdf(config);assert.ok(good.uri);good.dispose();
});


test('unchanged page-field blur after a page-2 pinch never resets the native viewport',()=>{
 const f=readerFixture();let tree=f.render(),pdf=find(tree,'PdfPages');
 const jumps:number[]=[];pdf.props.ref.current={setPage:(n:number)=>jumps.push(n)};
 pdf.props.onLoadComplete(8);pdf.props.onPageChanged(2);pdf.props.onScaleChanged(2);
 tree=f.render();find(tree,'TextInput').props.onBlur();
 assert.deepEqual(jumps,[],'An unchanged page field must not issue setPage and reset pan offsets');
});
test('edited page input navigates once; submit followed by blur does not send a duplicate jump',()=>{
 const f=readerFixture();let tree=f.render(),pdf=find(tree,'PdfPages');const jumps:number[]=[];
 pdf.props.ref.current={setPage:(n:number)=>jumps.push(n)};pdf.props.onLoadComplete(8);pdf.props.onPageChanged(2);
 tree=f.render();find(tree,'TextInput').props.onChangeText('3');tree=f.render();
 const input=find(tree,'TextInput');input.props.onSubmitEditing();input.props.onBlur();
 assert.deepEqual(jumps,[3]);
});

test('first-open edition authorization runs alongside metadata and chunk reads, with a final server check',async()=>{
 let release!:()=>void;const gate=new Promise<void>(r=>{release=r;}),reads:string[]=[];
 let checks=0;
 const edition=load('../src/news/edition.ts',{
  'firebase/firestore':{
   doc:(_:any,...parts:string[])=>parts.join('/'),collection:(parent:string,child:string)=>parent+'/'+child,
   getDocFromServer:async(path:string)=>{reads.push(path);if(path==='newsletters/current'){checks++;if(checks===1)await gate;return {exists:()=>true,data:()=>config};}return {data:()=>({totalChunks:1})};},
   getDocsFromServer:async(path:string)=>{reads.push(path);return {empty:false,docs:[{data:()=>({index:0,data:'fixture'})}]};},
  },'firebase/storage':{},'../lib/firebase':{db:{}},'./actions':{},
  './model':{editionKey:(c:any)=>c?.id+'|'+c?.uploadedAt,hasUploadedNewsletter:()=>true,assemblePdf:()=>'fixture'},
 });
 const pending=edition.loadPdfData(config);
 await Promise.resolve();
 const parallel=reads.includes('newsletters/oct')&&reads.includes('newsletters/oct/chunks');
 release();assert.equal(await pending,'fixture');
 assert.ok(parallel,'Independent bytes and metadata reads should start without waiting for an extra server round trip');
 assert.equal(checks,2,'Authorization/edition checks must still bracket the result');
});

test('concurrent first-open reads cannot return bytes when authorization fails or the edition changes',async()=>{
 for(const failAt of [1,2]){
  let checks=0;
  const edition=load('../src/news/edition.ts',{
   'firebase/firestore':{
    doc:(_:any,...parts:string[])=>parts.join('/'),collection:(parent:string,child:string)=>parent+'/'+child,
    getDocFromServer:async(path:string)=>{
     if(path==='newsletters/current'){
      if(++checks===failAt)throw new Error('Edition unavailable');
      return {exists:()=>true,data:()=>config};
     }
     return {data:()=>({totalChunks:1})};
    },
    getDocsFromServer:async()=>({empty:false,docs:[{data:()=>({index:0,data:'fixture'})}]}),
   },'firebase/storage':{},'../lib/firebase':{db:{}},'./actions':{},
   './model':{editionKey:(c:any)=>c?.id+'|'+c?.uploadedAt,hasUploadedNewsletter:()=>true,assemblePdf:()=>'fixture'},
  });
  await assert.rejects(edition.loadPdfData(config),/Edition unavailable/);
 }
});
