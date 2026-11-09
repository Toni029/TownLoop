import test from 'node:test';
import assert from 'node:assert/strict';
import {inboxActionError,isLegacyReview} from '../src/profile/inboxActionError';
test('old and new backend history-review errors have safe recovery text without raw HTTP status',()=>{
 for(const error of [{code:'functions/failed-precondition',message:'This older conversation needs community office review. [400]'},{code:'functions/failed-precondition',message:'Review required',details:{reason:'legacy-review'}}]){
  assert.equal(isLegacyReview(error),true);const result=inboxActionError(error);assert.match(result.message,/Start a new conversation/);assert.doesNotMatch(result.message,/\[400\]/);assert.equal((result as any).code,error.code);
 }
});
test('validation errors preserve drafts and permission errors never suggest bypassing access',()=>{
 assert.match(inboxActionError({code:'functions/invalid-argument',message:'Unable to complete. [400]'}).message,/draft has been kept/);
 assert.match(inboxActionError({code:'functions/permission-denied'}).message,/permission/);
 assert.equal(isLegacyReview({code:'functions/permission-denied',message:'older conversation'}),false);
});
