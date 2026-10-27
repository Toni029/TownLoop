const test=require('node:test'),assert=require('node:assert/strict');
const {buildPages,openPage}=require('../scripts/submit-build.cjs');
test('opens exact returned build page immediately in default browser, prints link and never polls',()=>{
 const id='49e3b645-1d6f-4dbd-aa4d-820f835dc812',calls=[],printed=[];
 const [url]=buildPages([{id}]);openPage(url,{platform:'linux',spawn:(...args)=>{calls.push(args);return{status:0};},print:s=>printed.push(s)});
 assert.equal(url,`https://expo.dev/accounts/seeds4clix/projects/townloop-native/builds/${id}`);
 assert.equal(calls.length,1);assert.equal(calls[0][0],'xdg-open');assert.deepEqual(calls[0][1],[url]);assert.deepEqual(printed,[url]);
 assert.throws(()=>buildPages([]),/Do not resubmit/);
});
test('failed browser still returns exact clickable URL, without retrying build',()=>{
 const printed=[];openPage('https://expo.dev/builds/fixture',{platform:'linux',spawn:()=>({status:1}),print:s=>printed.push(s)});
 assert.equal(printed.length,2);assert.match(printed[1],/could not open/);
});

test('stale local native directories fail before any cloud build submission',()=>{
 const {assertManagedSource}=require('../scripts/submit-build.cjs');assert.throws(()=>assertManagedSource('/native',()=>true),/No build was submitted/);assert.doesNotThrow(()=>assertManagedSource('/native',()=>false));
});
