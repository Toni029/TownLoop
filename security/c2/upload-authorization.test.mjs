import test from 'node:test';
import assert from 'node:assert/strict';
import { missingLookupBinding, withLookupBinding, LOOKUP_ROLE, repair } from './repair-upload-authorization.mjs';
test('repair adds only the missing Storage service-agent role and preserves unrelated IAM and etag', () => {
 const original={version:3,etag:'concurrency-token',bindings:[{role:'roles/viewer',members:['user:operator@example.invalid']},{role:LOOKUP_ROLE,members:['serviceAccount:other@example.invalid'],condition:{expression:'false',title:'restricted'}}]};
 assert.equal(missingLookupBinding(original,'123'),true);
 const fixed=withLookupBinding(original,'123');
 assert.equal(missingLookupBinding(fixed,'123'),false);
 assert.deepEqual(fixed.bindings.slice(0,2),original.bindings);
 assert.deepEqual(fixed.bindings[2],{role:LOOKUP_ROLE,members:['serviceAccount:service-123@gcp-sa-firebasestorage.iam.gserviceaccount.com']});
 assert.equal(fixed.etag,original.etag);
 assert.deepEqual(withLookupBinding(fixed,'123'),fixed);
 assert.equal(original.bindings.length,2);
 assert.throws(()=>withLookupBinding({bindings:[]},'123'),/etag/);
});

test('apply cannot omit the explicit approval flag or perform any network request', async () => {
 const originalToken=process.env.TOWNLOOP_METADATA_ACCESS_TOKEN;
 process.env.TOWNLOOP_METADATA_ACCESS_TOKEN='test-only';
 try { await assert.rejects(repair(['cc-livingcommunity-app','--apply']),/Explicit --apply --approve/); }
 finally { if(originalToken===undefined)delete process.env.TOWNLOOP_METADATA_ACCESS_TOKEN;else process.env.TOWNLOOP_METADATA_ACCESS_TOKEN=originalToken; }
});
