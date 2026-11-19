import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('public deletion disclosures distinguish pending authorization from verified completion',()=>{
 for(const name of ['privacy.html','delete-account.html']){
  const page=readFileSync(new URL(`../../public/${name}`,import.meta.url),'utf8');
  assert.match(page,/30.{0,35}24 hours/);assert.match(page,/undecided/);assert.match(page,/new verified request/);assert.match(page,/operational receipts/);
  assert(!page.includes('3 business days'));assert(!page.includes('processing within 7 calendar days'));
 }
});
