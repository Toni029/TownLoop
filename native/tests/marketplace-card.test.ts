import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const jsx=(type:any,props:any)=>({type,props});
const e:any={};const s={row:{flexDirection:'row',flexWrap:'wrap'},card:{},input:{}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/social/SocialFeed.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:e,require:(name:string)=>{
 if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};
 if(name==='react')return{useState:(value:any)=>[typeof value==='function'?value():value,()=>{}]};
 if(name==='react-native')return new Proxy({useWindowDimensions:()=>({width:360})},{get:(target:any,key:string)=>target[key]||key});
 if(name==='../shell/TownLoopShell')return{usePresentation:()=>({dark:false})};
 if(name==='../news/ui')return{s,useNewsStyles:()=>s,useNewsFonts(){},Action:'Action',Copy:'Copy',Field:'Field',ErrorNotice:'ErrorNotice'};
 if(name==='./model')return{mediaFor:()=>[],owns:()=>false};
 if(name==='../../../src/utils/permissions')return{canDeleteAnyPost:()=>false};
 if(name==='./actions')return{newSocialId:()=> 'fixture'};
 return new Proxy({},{get:(_target,key)=>key});
}});
function nodes(node:any,predicate:(n:any)=>boolean):any[]{if(!node||typeof node!=='object')return[];return[...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(x=>nodes(x,predicate))];}
const item={id:'fixture',author:'Alex Resident',price:'FREE',sold:false,comments:[],title:'Chair',description:'Pickup instructions remain here'};
const handlers={onAction:async()=>true,onMessage(){}};
test('listing card places availability in footer and frees seller-name space',()=>{
 const root=e.SocialFeed({posts:[],listings:[item],user:null,view:'listing',setView(){},loading:false,error:'',retry(){},busy:false,reactionsReady:true,unread:0,onCreate(){},onOpen(){},onMedia(){},onInbox(){},...handlers});
 const list=nodes(root,n=>n.type==='FlatList')[0];const card=list.props.renderItem({item});
 const header=card.props.children[0];
 assert.equal(nodes(header,n=>n.props?.label==='Available').length,0);
 const author=nodes(header,n=>n.type==='Copy'&&n.props.children==='Alex Resident')[0];
 assert.ok(author);assert.equal(author.props.numberOfLines,undefined,'Long names may wrap');
 const sellerRow=header.props.children[0];assert.equal(sellerRow.props.style.at(-1).minWidth,0);assert.equal(sellerRow.props.style.at(-1).flexWrap,'nowrap');
 const footer=e.ListingActions(card.props.children.at(-1).props);
 assert.equal(nodes(footer,n=>n.props?.label==='Available')[0].props.tone,'green');
 assert.equal(nodes(footer,n=>n.props?.children==='Porch pickup').length,0);
});
test('sold state and pickup information in details remain available',()=>{
 const footer=e.ListingActions({item:{...item,sold:true},user:null,busy:false,...handlers});
 assert.equal(nodes(footer,n=>n.props?.label==='Sold')[0].props.tone,'stone');
 const details=e.Detail({item,kind:'listing',user:null,busy:false,reactionsReady:true,onClose(){},onMedia(){},...handlers});
 const actions=nodes(details,n=>n.type===e.ListingActions)[0];assert.equal(actions.props.pickupInfo,true);
 const detailFooter=e.ListingActions(actions.props);
 assert.equal(nodes(detailFooter,n=>n.props?.children==='Porch pickup').length,1);
});
