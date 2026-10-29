// Disposable fixture only; no SDK/network access. Transactions serialize and roll back failures.
function fixture() {
  const records = new Map(); let pending=Promise.resolve();
  const clone = value => value === undefined ? undefined : structuredClone(value);
  const snap = (path, data=records.get(path)) => ({id:path.split('/').at(-1),ref:doc(path),exists:data!==undefined,data:()=>clone(data)});
  function doc(path) { return {path,id:path.split('/').at(-1),get:async()=>snap(path),delete:async()=>records.delete(path),update:async patch=>records.set(path,{...records.get(path),...clone(patch)})}; }
  function collection(path,filters=[],sort=null,maximum=Infinity) {
    const result=()=>[...records].filter(([p,d])=>p.startsWith(path+'/')&&p.split('/').length===path.split('/').length+1&&filters.every(([f,op,v])=>op==='=='?d[f]===v:op==='in'?v.includes(d[f]):op==='array-contains'?d[f]?.includes(v):op==='>'?d[f]>v:op==='<='?d[f]<=v:false)).sort(([,a],[,b])=>sort?(sort[1]==='desc'?-1:1)*((a[sort[0]]>b[sort[0]])?1:(a[sort[0]]<b[sort[0]]?-1:0)):0).slice(0,maximum).map(([p,d])=>snap(p,d));
    return {get:async()=>({docs:result(),empty:result().length===0}),orderBy:(field,direction)=>collection(path,filters,[field,direction],maximum),where:(...f)=>collection(path,[...filters,f],sort,maximum),limit:maximum=>collection(path,filters,sort,maximum),count:()=>({get:async()=>({data:()=>({count:result().length})})})};
  }
  const db={doc,collection,runTransaction:fn=>{
    const run=pending.then(async()=>{const writes=[];let wrote=false;
      const tx={get:async r=>{if(wrote)throw Error('read_after_write');return r.path?snap(r.path):r.get();},
        create:(r,d)=>{wrote=true;writes.push(['create',r.path,clone(d)]);},
        set:(r,d)=>{wrote=true;writes.push(['set',r.path,clone(d)]);},
        update:(r,d)=>{wrote=true;writes.push(['update',r.path,clone(d)]);},delete:r=>{wrote=true;writes.push(['delete',r.path]);}};
      const value=await fn(tx);const next=new Map(records);
      for(const [op,p,d]of writes){if(op==='create'&&next.has(p))throw Error('already_exists');if(op==='update'&&!next.has(p))throw Error('missing_document');if(op==='delete')next.delete(p);else next.set(p,op==='update'?{...next.get(p),...d}:d);}
      records.clear();for(const [p,d]of next)records.set(p,d);return value;
    });pending=run.catch(()=>{});return run;
  }};
  for(const [uid,role]of [['a','resident'],['b','resident'],['admin','admin'],['vip','vip'],['crew','crew']])records.set(`users/${uid}`,{name:uid,role,approved:true});
  let now=1000000000000;
  const {operate}=require('../inbox-groups.cjs');
  return {db,records,now,call:(uid,data,options={})=>operate(db,uid,data,{enabled:true,now:++now,...options})};
}
module.exports={fixture};
