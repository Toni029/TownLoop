'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSocialMediaReadiness,canonicalDigest,validateManifest,PINS}=require('./socialMediaLifecycleReadiness.cjs');
const now=Date.parse('2026-11-13T16:00:00Z');
function fixture(){
 const fn={name:`projects/${PINS.project}/locations/us-central1/functions/submitSafetyReport`,state:'ACTIVE',buildConfig:{entryPoint:'submitSafetyReport'},serviceConfig:{revision:'reviewed-1',environmentVariables:{}}};
 const observed={functions:[fn],projectIam:{version:3,bindings:[]},bucketIam:{version:3,bindings:[]}};
 const manifest={version:1,ownerApproved:true,approvalReference:'synthetic-review',project:PINS.project,bucket:PINS.bucket,workerServiceAccount:PINS.workerServiceAccount,defaultRulesSha256:PINS.defaultRulesSha256,namedRulesSha256:PINS.namedRulesSha256,storageRulesSha256:PINS.storageRulesSha256,expiresAt:now+3600000,reviewedAt:now-1000,functionInventorySha256:canonicalDigest(observed.functions),projectIamSha256:canonicalDigest(observed.projectIam),bucketIamSha256:canonicalDigest(observed.bucketIam),writerEvidence:{externalWritersDisabledAndDrained:true,namedBackendWritersDisabledAndDrained:true,defaultWritersTransactionGuarded:true,privilegedObjectWritersGuardedOrDisabled:true,sourceReviewReference:'review/source',iamReviewReference:'review/iam',defaultOnlyMutationScopeReviewed:true,immutableNativeSocialUploadsVerified:true,storageFirestoreDocumentBudgetVerified:true},writers:{[fn.name]:{configurationSha256:canonicalDigest(fn),sourceSha256:'a'.repeat(64),mode:'guarded_default_only',namedWrites:'none'}}};
 return {observed,manifest};
}
test('manifest is failclosed and pins coordinated rules plus exact reviewed writer/IAM evidence',()=>{
 const {manifest}=fixture();assert.equal(validateManifest(manifest,now),true);
 for(const patch of [{ownerApproved:false},{storageRulesSha256:'b'.repeat(64)},{expiresAt:now-1},{writerEvidence:{}},{workerServiceAccount:'generic@example.test'},{writers:{}}])assert.equal(validateManifest({...manifest,...patch},now),false);
});
test('authoritative verifier fetches exact rules releases, complete function configs and IAM instead of trusting flags',async()=>{
 const {observed,manifest}=fixture(),calls=[];
 const rules={default:'default source',storage:'storage source',named:'named source'};
 const pins={...PINS,defaultRulesSha256:canonicalDigest(rules.default),storageRulesSha256:canonicalDigest(rules.storage),namedRulesSha256:canonicalDigest(rules.named)};
 // Rule hashes are content SHA256, unlike canonical object digests.
 const sha=x=>require('node:crypto').createHash('sha256').update(x).digest('hex');
 for(const key of Object.keys(rules))pins[`${key==='named'?'named':key}RulesSha256`]=sha(rules[key]);
 Object.assign(manifest,{defaultRulesSha256:pins.defaultRulesSha256,storageRulesSha256:pins.storageRulesSha256,namedRulesSha256:pins.namedRulesSha256});
 const request=async(url,method='GET')=>{calls.push([url,method]);if(url.includes('/releases/'))return {rulesetName:`projects/${PINS.project}/rulesets/${url.includes('firebase.storage')?'storage':url.includes('/cloud.firestore/')?'named':'default'}`};if(url.includes('/rulesets/'))return {source:{files:[{content:rules[url.split('/').at(-1)]}]}};if(url.includes('cloudfunctions.googleapis.com/v1/'))return {functions:[]};if(url.includes('cloudfunctions.googleapis.com/v2/'))return {functions:observed.functions};if(url.includes('cloudresourcemanager.googleapis.com'))return observed.projectIam;if(url.includes('/iam'))return observed.bucketIam;throw Error('unexpected');};
 const db={databaseId:'(default)',doc:path=>({get:async()=>({data:()=>path==='social_media_control/deployment'?manifest:undefined})}),collection:()=>({where:()=>({limit:()=>({get:async()=>({empty:true})})})})};
 const ready=createSocialMediaReadiness({db,request,now:()=>now,pins});assert.equal(await ready(),true);assert.ok(calls.some(([url,method])=>url.includes('getIamPolicy')&&method==='POST'));
 observed.functions[0].serviceConfig.revision='unreviewed';assert.equal(await ready(),false);
 observed.functions[0].serviceConfig.revision='reviewed-1';manifest.projectIamSha256='f'.repeat(64);assert.equal(await ready(),false);
});
