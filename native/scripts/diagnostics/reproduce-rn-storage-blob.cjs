// Run from native/. Models the installed RN Blob restriction against the installed Firebase SDK.
// Demo-only configuration; the reproduced exception occurs before a network request is created.
const {initializeApp}=require(process.cwd()+'/node_modules/firebase/app');
const {getStorage,ref,uploadBytesResumable}=require(process.cwd()+'/node_modules/firebase/storage');
const OriginalBlob=global.Blob;
global.Blob=class extends OriginalBlob { constructor(parts,options){ if(parts.some(p=>p instanceof ArrayBuffer||ArrayBuffer.isView(p))) throw Error("Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported"); super(parts,options); } };
process.on('unhandledRejection',e=>console.log('UNHANDLED:',e.message));
const s=getStorage(initializeApp({apiKey:'test',projectId:'demo-upload',storageBucket:'demo-upload.appspot.com'}));
let settled=false;
const task=uploadBytesResumable(ref(s,'feed/test.jpg'),new Uint8Array(1024),{contentType:'image/jpeg'});
task.on('state_changed',()=>{},e=>{settled=true;console.log('observer error',e.code)},()=>{settled=true});
setTimeout(()=>{ console.log('Upload observer settled:',settled,'state:',task.snapshot.state);process.exit(0)},300);
