'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const sha256=source=>createHash('sha256').update(source).digest('hex');
function guard(source,storage=false){
 // Native social Storage already consumes its two-document Firestore lookup budget.
 // Keep immutable create-only media rules byte-identical; fence only Firestore reference writes.
 if(storage){if(sha256(source)!=='9aac5f82b7e31fef034b92340714136ec943232de88b1a0076c001331958c3e9')throw Error('Immutable Storage baseline drift');return source;}
 if(source.includes('function socialMediaWriteAllowed'))throw Error('Social guard already present');
 const guarded=source.replace(/allow\s+([a-z,\s]+):\s*if\s+([^;]+);/g,(all,names,predicate)=>{
  const ops=names.split(',').map(value=>value.trim()),reads=ops.filter(value=>['read','get','list'].includes(value)),writes=ops.filter(value=>['write','create','update','delete'].includes(value));
  if(ops.length!==reads.length+writes.length)throw Error('Unknown operation');
  return [reads.length?`allow ${reads.join(', ')}: if ${predicate};`:'',writes.length?`allow ${writes.join(', ')}: if socialMediaWriteAllowed() && (${predicate});`:''].filter(Boolean).join('\n      ');
 });
 const anchor='  match /databases/{database}/documents {';
 if(!guarded.includes(anchor))throw Error('Missing rules anchor');
 const helper=`
    function socialMediaWriteAllowed() {
      return !exists(/databases/$(database)/documents/social_media_control/active) ||
        get(/databases/$(database)/documents/social_media_control/active).data.get('blocked', false) != true;
    }
    match /social_media_control/{document=**} { allow read, write: if false; }
    match /social_media_jobs/{document=**} { allow read, write: if false; }
    match /social_media_deletion_attempts/{document=**} { allow read, write: if false; }
`;
 return guarded.replace(anchor,()=>anchor+helper);
}
module.exports={guard,sha256};
if(require.main===module){
 // Produce LOCAL candidates only; no CLI config or deployed rules are changed.
 const base=path.resolve(__dirname,'../..');
 for(const [input,output,storage] of [['firestore.rules','firestore.candidate.rules',false],['security/c2/storage.compatible.rules','storage.candidate.rules',true]]){
  const source=fs.readFileSync(path.join(base,input),'utf8'),candidate=guard(source,storage);
  fs.writeFileSync(path.join(__dirname,output),candidate);console.log(`${output}: baseline ${sha256(source)} candidate ${sha256(candidate)}`);
 }
}
