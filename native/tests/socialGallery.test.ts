import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function screenFixture() {
 const state:any[]=[];let cursor=0;const exports:any={};
 const item={id:'fixture',authorId:'owner',likedBy:{},comments:[],media:[]};
 const react={useState:(initial:any)=>{const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],(v:any)=>{state[i]=typeof v==='function'?v(state[i]):v;}];},useEffect:()=>{},useMemo:(f:any)=>f(),useCallback:(f:any)=>f,useRef:(v:any)=>({current:v})};
 const modules:any={
  react,'react/jsx-runtime':{jsx:(type:any,props:any)=>({type,props}),jsxs:(type:any,props:any)=>({type,props})},
  '@react-native-async-storage/async-storage':{default:{}},'react-native':{View:'View'},
  '../lib/community':{useCommunity:()=>({community:'cecil_pines'})},'../lib/resident':{useResident:()=>({id:'owner'})},
  '../lib/liveCollection':{useLiveCollection:(name:string)=>({items:['discussion_feed','marketplace_posts'].includes(name)?[item]:[],loading:false,error:'',retry(){}})},
  '../news/ui':{Action:'Action',Copy:'Copy',NewsDialog:'Dialog'},'../components/ProductToast':{ProductToast:'Toast'},
  '../components/MarketplaceGallery':{MarketplaceGallery:'Gallery'},'../components/MediaViewer':{MediaViewer:'VideoViewer'},
  './model':{readPost(){},readListing(){},readPerson(){},readChat(){},orderedChats:()=>[],chatSide(){},withAvatar:(p:any)=>p,avatarResolver:()=>()=>'',communityResidentLabel:()=> 'Cecil Pines Resident'},
  './actions':{},'./SocialFeed':{SocialFeed:'Feed',Detail:'Detail'},'./CreateEditor':{CreateEditor:'Editor'},'./Inbox':{Inbox:'Inbox',MessageSeller:'MessageSeller'},
 };
 const source=ts.transpileModule(readFileSync(new URL('../src/social/SocialScreen.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{exports,require:(name:string)=>{assert(name in modules,name);return modules[name];}});
 return ()=>{cursor=0;const tree=exports.default();return tree.props.children.filter(Boolean);};
}
for(const kind of ['post','listing'])test(`${kind} photos use the shared gallery without closing the underlying details`,()=>{
 const render=screenFixture();let children=render();children.find((n:any)=>n.type==='Feed').props.onOpen(kind,'fixture');
 children=render();assert(children.some((n:any)=>n.type==='Detail'));
 const files=[{type:'video',url:'fixture-video'},{type:'image',url:'fixture-photo1'},{type:'image',url:'fixture-photo2'}];
 children.find((n:any)=>n.type==='Detail').props.onMedia(files,'Fixture',2);
 children=render();assert(children.some((n:any)=>n.type==='Detail'));const gallery=children.find((n:any)=>n.type==='Gallery');
 assert.equal(gallery.props.initialIndex,1);assert.equal(gallery.props.media.length,2);
 gallery.props.onClose();children=render();assert(children.some((n:any)=>n.type==='Detail'));assert(!children.some((n:any)=>n.type==='Gallery'));
});
