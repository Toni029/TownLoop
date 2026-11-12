// Read-only localhost checks; no account requests, live Hosting or backend calls.
const assert=require('node:assert/strict');
async function verify(base='http://127.0.0.1:8125') {
 const u=new URL(base);assert(['127.0.0.1','localhost'].includes(u.hostname),'Only local Hosting previews are permitted.');
 const results=[];
 for(const [name,title] of [['privacy.html','Privacy Policy'],['terms.html','Terms of Use'],['child-safety.html','Child Safety Standards'],['delete-account.html','Request Account Deletion'],['legal.css',null]]) {
  const response=await fetch(new URL('/'+name,u),{redirect:'manual'}),source=await response.text();
  assert.equal(response.status,200,name);assert(!response.headers.get('location'),name);assert(!source.includes('id="root"'),name);
  if(title){assert(source.includes('<h1>'+title+'</h1>'),name);assert(response.headers.get('content-type').includes('text/html'));}
  else assert(response.headers.get('content-type').includes('text/css'));
  results.push({path:'/'+name,status:response.status,redirect:false,appShell:false});
 }
 return results;
}
module.exports={verify};if(require.main===module)verify(process.argv[2]).then(results=>console.log(JSON.stringify(results,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
