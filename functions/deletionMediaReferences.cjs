// Token-free object identity only; never persist URLs, message bodies or photo contents.
const {createHash}=require('node:crypto');
const BUCKET='cc-livingcommunity-app.firebasestorage.app';
function pathFor(value){
 if(typeof value!=='string')return null;
 try{let path;if(/^(work_orders|feed|marketplace)\/[^/]+$/.test(value))path=value;else if(value.startsWith(`gs://${BUCKET}/`))path=value.slice(`gs://${BUCKET}/`.length);else{const u=new URL(value),prefix=`/v0/b/${BUCKET}/o/`;if(u.protocol!=='https:'||u.hostname!=='firebasestorage.googleapis.com'||!u.pathname.startsWith(prefix))return null;path=decodeURIComponent(u.pathname.slice(prefix.length));}
 if(!/^(work_orders|feed|marketplace)\/[^/]+$/.test(path)||/[\u0000-\u001f\\]/.test(path)||path.split('/').some(p=>p==='.'||p==='..'))return null;return path;}catch{return null;}
}
function objectHashes(record){const found=new Set();let nodes=0;
 function walk(value,depth=0){if(++nodes>10000||depth>20)throw Error('media_inventory_bound');if(typeof value==='string'){const path=pathFor(value);if(path)found.add(createHash('sha256').update(path).digest('hex'));return;}if(Array.isArray(value)){for(const item of value)walk(item,depth+1);return;}if(value&&typeof value==='object')for(const key of ['photoUrl','photos','media','mediaUrl','itemMediaUrl','imageUrl','attachmentUrl','attachments','fileUrl','avatarUrl','avatar_url','url','storagePath','comments','messages'])if(value[key]!=null)walk(value[key],depth+1);}
 walk(record);if(found.size>100)throw Error('media_inventory_bound');return [...found];
}
module.exports={pathFor,objectHashes};
