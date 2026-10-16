const test = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
test('translation endpoint authenticates tokens and denies resident and unapproved profiles', async () => {
  const output = await build({entryPoints:['server/newsletterAuth.ts'],bundle:true,platform:'node',format:'cjs',write:false});
  const module = {exports:{}};
  new Function('module','exports','require',output.outputFiles[0].text)(module,module.exports,require);
  const original = global.fetch;
  try {
    for(const role of ['resident','crew','vip','admin']) for(const approved of [true,false]) {
      global.fetch = async url => ({ok:true,json:async()=>String(url).includes('accounts:lookup') ? {users:[{localId:'test-user'}]} : {fields:{role:{stringValue:role},approved:{booleanValue:approved}}}});
      let status, passed = false;
      const res = {status(n){status=n;return this;},json(){}};
      await module.exports.requireWorkOrderTranslator({headers:{authorization:'Bearer test-token'}},res,()=>{passed=true;});
      assert.equal(passed,approved && role!=='resident');
      if(!passed)assert.equal(status,403);
    }
    let status;
    await module.exports.requireWorkOrderTranslator({headers:{}},{status(n){status=n;return this;},json(){}},()=>assert.fail('Unauthenticated request allowed'));
    assert.equal(status,401);
  } finally {global.fetch=original;}
});
