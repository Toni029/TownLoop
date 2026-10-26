// In-memory fixtures only. No emulator/project/account credentials or network access.
function memoryFirestore(initial={}) {
 const records=new Map(Object.entries(initial)),clone=value=>value===undefined?undefined:structuredClone(value);
 const snapshot=path=>({id:path.split('/').at(-1),ref:doc(path),exists:records.has(path),data:()=>clone(records.get(path))});
 function doc(path){return {path,id:path.split('/').at(-1),get:async()=>snapshot(path),collection:name=>query(`${path}/${name}`),update:async patch=>{if(!records.has(path))throw Error('missing fixture document');records.set(path,{...records.get(path),...clone(patch)});},create:async data=>{if(records.has(path))throw Error('duplicate fixture document');records.set(path,clone(data));}};}
 function query(path,filters=[],orders=[],after=[],count=Infinity){const q={select:()=>q,where:(key,op,value)=>query(path,[...filters,[key,op,value]],orders,after,count),orderBy:key=>query(path,filters,[...orders,key],after,count),startAfter:(...values)=>query(path,filters,orders,values,count),limit:value=>query(path,filters,orders,after,value),doc:id=>doc(`${path}/${id}`),async get(){
  const value=(key,field)=>field==='__name__'?(path.startsWith('@group/')?key:key.split('/').at(-1)):records.get(key)[field];
  const sort=orders.length?orders:['__name__'];
  const keys=[...records.keys()].filter(key=>path.startsWith('@group/')?key.split('/').at(-2)===path.slice(7):key.startsWith(path+'/')&&key.split('/').length===path.split('/').length+1).filter(key=>filters.every(([field,op,v])=>{const actual=value(key,field);if(op==='==')return actual===v;if(op==='in')return v.includes(actual);if(op==='<=')return actual<=v;throw Error('unsupported fixture operator');})).sort((a,b)=>{for(const field of sort){const av=value(a,field),bv=value(b,field);if(av<bv)return -1;if(av>bv)return 1;}return 0;}).filter(key=>{if(!after.length)return true;for(let i=0;i<sort.length;i++){const actual=value(key,sort[i]),v=after[i];if(actual>v)return true;if(actual<v)return false;}return false;}).slice(0,count);
  return {docs:keys.map(snapshot),size:keys.length,empty:keys.length===0};
 }};return q;}
 const commit=changes=>{for(const [kind,ref,value]of changes){if(kind==='delete')records.delete(ref.path);else if(kind==='create'){if(records.has(ref.path))throw Error('duplicate fixture create');records.set(ref.path,clone(value));}else if(kind==='update') {if(!records.has(ref.path))throw Error('missing fixture update');records.set(ref.path,{...records.get(ref.path),...clone(value)});}else records.set(ref.path,clone(value));}};
 const db={doc,collection:query,collectionGroup:name=>query('@group/'+name),batch(){const changes=[];return {set:(r,v)=>changes.push(['set',r,v]),update:(r,v)=>changes.push(['update',r,v]),delete:r=>changes.push(['delete',r]),commit:async()=>commit(changes)};},async runTransaction(fn){const changes=[];const result=await fn({get:r=>r.get(),create:(r,v)=>changes.push(['create',r,v]),set:(r,v)=>changes.push(['set',r,v]),update:(r,v)=>changes.push(['update',r,v]),delete:r=>changes.push(['delete',r])});commit(changes);return result;}};
 return {db,records};
}
module.exports={memoryFirestore};
