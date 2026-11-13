'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {guard,sha256}=require('./prepare-rules.cjs');
const pins=require('../../functions/socialMediaLifecyclePins.json');
const source=fs.readFileSync(path.join(__dirname,'../c2/storage.compatible.rules'),'utf8');
test('Storage stays byte-identical to reviewed immutable live rules without adding a third Firestore lookup',()=>{
 assert.equal(guard(source,true),source);
 assert.equal(fs.readFileSync(path.join(__dirname,'storage.candidate.rules'),'utf8'),source);
 assert.equal(pins.storageRulesSha256,'9aac5f82b7e31fef034b92340714136ec943232de88b1a0076c001331958c3e9');
 assert.equal(sha256(source),pins.storageRulesSha256);
 assert.doesNotMatch(source,/social_media_control|registration_uid_fences/);
});
test('native social create call graph uses only profile and parent documents and disallows byte/metadata replacement',()=>{
 const functions=new Map([...source.matchAll(/function\s+(\w+)\([^)]*\)\s*\{([\s\S]*?)\n    \}/g)].map(match=>[match[1],match[2]]));
 const seen=new Set(),documents=new Set();
 function visit(name){if(seen.has(name))return;seen.add(name);const body=functions.get(name);assert.ok(body,`Missing ${name}`);
  for(const match of body.matchAll(/firestore\.(?:get|exists)\((\/databases\/[^\n]*?)\)(?=\.data|\s*&&)/g))documents.add(match[1]);
  for(const [child]of functions)if(new RegExp(`\\b${child}\\(`).test(body))visit(child);
 }
 for(const name of ['newUpload','socialLink','socialOwner','socialUpload','media'])visit(name);
 assert.equal(documents.size,2,[...documents].join('\n'));
 assert.ok([...documents].some(document=>document.includes('/users/$(request.auth.uid)')));
 assert.ok([...documents].some(document=>document.includes('/$(metadata.collection)/$(metadata.recordId)')));
 const social=source.slice(source.indexOf('    match /{folder}/{fileName}'),source.indexOf('    match /newsletters/'));
 assert.match(social,/allow create: if resource == null/);
 assert.match(social,/allow update: if false;/);
 assert.match(social,/socialOwner\(request.resource.metadata\)/);
});
