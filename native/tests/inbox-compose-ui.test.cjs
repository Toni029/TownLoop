const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../src/profile/ProfileMenu.tsx'),'utf8');
test('normal composition has one automatic creation path without a legacy warning or manual fresh-chat button',()=>{
 const compose=source.slice(source.indexOf('  function sendCompose()'),source.indexOf('  const account ='));
 assert(compose.includes("groupAction('create',"));assert(!/createFresh|isLegacyReview|setLegacyReviewRequired|freshGroup/.test(compose));assert(!source.includes('Start a new conversation instead'));assert(!source.includes('Earlier messages remain protected in the original conversation'));
});
test('read-only previous threads are distinguished inline without another modal',()=>{assert(source.includes('Previous conversation · Read-only'));});
