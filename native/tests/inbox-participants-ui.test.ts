import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const ts=createRequire(import.meta.url)('typescript');
const alice={uid:'alice',name:'Alex Resident',avatar:'data:image/png;base64,fixture',role:'resident',status:'active'};
const staff={uid:'staff',name:'Office Staff',avatar:'data:image/png;base64,staff',role:'vip'};
function fixture(options:{category?:string;legacy?:boolean;fail?:boolean;rosterFail?:boolean}={}){
 let cursor=0;const states:any[]=[],effects:any[]=[],calls:any[]=[];let members:any[]=[alice],candidates:any[]=[staff];
 const jsx=(type:any,props:any)=>({type,props});
 const modules:Record<string,any>={
  react:{useState:(v:any)=>{const i=cursor++;if(!(i in states))states[i]=v;return[states[i],(next:any)=>states[i]=typeof next==='function'?next(states[i]):next];},useRef:(v:any)=>{const i=cursor++;return states[i]||(states[i]={current:v});},useEffect:(fn:any,deps:any[])=>{const i=cursor++,old=states[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){effects.push(()=>{old?.cleanup?.();states[i]={deps,cleanup:fn()};});}}},
  'react/jsx-runtime':{jsx,jsxs:jsx},
  'react-native':{ActivityIndicator:'Spinner',Keyboard:{dismiss:()=>{}},Image:'Image',Pressable:'Button',ScrollView:'Scroll',Text:'Text',View:'View',useWindowDimensions:()=>({width:320,height:600})},
  'lucide-react-native':{ChevronDown:'ChevronDown',UserPlus:'UserPlus',Users:'Users',Building2:'Building2',Wrench:'Wrench'},
  './groupInbox':{groupAction:async(op:string,input:any)=>{calls.push({op,input});if(options.fail){const e:any=Error('Bad Request [400]');e.code='functions/invalid-argument';throw e;}if(op==='upgradeLegacy')return{conversationId:'v3-upgraded',type:'office'};if(op==='add'){members=[alice,{...staff,status:'active'}];candidates=[];return{conversationId:'group'};}if(options.rosterFail&&calls.some(c=>c.op==='add'))throw Error('Raw server error [400]');return{members,candidates};}},
 };
 function load(file:string){const exports:any={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Error,Map,Set,require:(id:string)=>{assert(id in modules,id);return modules[id];}});return exports;}
 const component=load('../src/profile/InboxParticipants.tsx');let open=true;const upgrades:any[]=[];
 const props=()=>({thread:{id:'group',category:options.category||'office',data:{schemaVersion:options.legacy?2:3,sequence:1}},uid:'alice',open,onToggle:()=>{open=!open;},onUpgrade:(...v:any[])=>upgrades.push(v),dark:false,ink:'#111',muted:'#777',disabled:false});
 function render(){cursor=0;let tree=component.InboxParticipants(props());if(tree&&typeof tree.type==='function')tree=tree.type(tree.props);while(effects.length)effects.shift()();return tree;}
 return{render,calls,upgrades,setOpen:(v:boolean)=>open=v,icon:load('../src/profile/InboxThreadIcon.tsx').InboxThreadIcon};
}
function nodes(n:any):any[]{if(n==null||typeof n==='boolean')return[];if(Array.isArray(n))return n.flatMap(nodes);return typeof n==='object'?[n,...nodes(n.props?.children)]:[n];}
const settle=()=>new Promise<void>(r=>setImmediate(r));
const button=(tree:any,label:string)=>nodes(tree).find(n=>n.type==='Button'&&n.props.accessibilityLabel===label);
test('private chats never render participant controls or call membership endpoints',async()=>{const h=fixture({category:'friend'});assert.equal(h.render(),null);await settle();assert.equal(h.calls.length,0);});
test('Office list/header identity uses the same exact blue building artwork, including private Office tags',()=>{const h=fixture();for(const props of [{category:'office'},{category:'friend',officeDirect:true}]){const tree=h.icon(props);assert.equal(tree.props.style.width,32);const glyph=nodes(tree).find(n=>n.type==='Building2');assert.equal(glyph.props.size,16);assert.equal(glyph.props.color,'#2563eb');}});
test('Office dropdown shows current member avatars and only eligible new Office candidates',async()=>{const h=fixture();h.render();await settle();const tree=h.render(),all=nodes(tree);assert(all.includes('Group Members'));assert(all.includes('Add Members'));assert(button(tree,'Add Office Staff'));assert(all.some(n=>n.type==='Scroll'&&n.props.style.maxHeight<=180));const avatar=all.find(n=>typeof n.type==='function'&&n.props.person?.uid==='alice');assert.equal(avatar.props.person.avatar,alice.avatar);assert(!all.includes('View Participants'));});
test('confirmed add refreshes membership, removes the candidate and prevents duplicate taps',async()=>{const h=fixture();h.render();await settle();const add=button(h.render(),'Add Office Staff');add.props.onPress();add.props.onPress();await settle();const tree=h.render();assert.equal(h.calls.filter(c=>c.op==='add').length,1);assert.equal(button(tree,'Add Office Staff'),undefined);assert(nodes(tree).some(n=>n.type==='Text'&&n.props.children[0]==='Office Staff'));});
test('backend failures show useful retry controls without leaking raw HTTP errors',async()=>{const h=fixture({fail:true});h.render();await settle();const tree=h.render();assert(button(tree,'Refresh group members'));assert(!nodes(tree).filter(n=>typeof n==='string').join(' ').includes('[400]'));assert.equal(button(tree,'Add Office Staff'),undefined);});
test('a confirmed add with failed roster refresh disables further additions until refreshed',async()=>{const h=fixture({rosterFail:true});h.render();await settle();button(h.render(),'Add Office Staff').props.onPress();await settle();const tree=h.render();assert(button(tree,'Refresh group members'));assert.equal(button(tree,'Add Office Staff'),undefined);assert(nodes(tree).some(n=>typeof n==='string'&&n.includes('member update succeeded')));});
test('Maintenance has members but cannot invoke Office additions; legacy Office uses trusted upgrade',async()=>{const crew=fixture({category:'maintenance'});crew.render();await settle();assert(!nodes(crew.render()).includes('Add Members'));const old=fixture({legacy:true});old.render();await settle();assert.equal(old.calls[0].op,'upgradeLegacy');assert.equal(old.upgrades[0][0],'v3-upgraded');assert.equal(old.calls.some(c=>c.op==='add'),false);});
