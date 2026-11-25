const {test}=require('node:test'),assert=require('node:assert/strict');
const {rulesCompatible,mediaProvenanceMatches}=require('./deletionRulesCompatibility.cjs');
const {PINS}=require('./databaseCleanupSafety.cjs'),baseline=require('./deletionMediaProvenance.json').storageRulesSha256;
const cutover=1792756800000,media={ownerApproved:true,storageRulesSha256:baseline,trustedUploadsAfter:{toMillis:()=>cutover}};
const receipt={...PINS,version:3,ownerApproved:true,storageMode:'exclusive-generation-fenced-v2',genericMediaCleanupDisabledAcknowledged:true,accountCoordinationVersion:1,mediaProvenance:{storageRulesSha256:baseline,trustedUploadsAfterMillis:cutover}};
test('guard-only Storage upgrade preserves original proof date and needs explicit matching receipt',()=>{const input={database:'storage',liveHash:PINS.storageRulesSha256,releaseUpdatedAt:'2030-01-01',mediaPolicy:media,receipt};assert.equal(rulesCompatible(input),true);assert.equal(rulesCompatible({...input,receipt:undefined}),false);assert.equal(mediaProvenanceMatches({...receipt,mediaProvenance:{...receipt.mediaProvenance,trustedUploadsAfterMillis:cutover+1}},media),false);assert.equal(rulesCompatible({...input,liveHash:'unknown'}),false);});
test('Firestore compatibility never acknowledges the account deletion receipt implicitly',()=>{const input={database:'(default)',liveHash:PINS.defaultRulesSha256,expectedHash:'old',policy:{scopeRuleHashes:{'(default)':'old'}},receipt};assert.equal(rulesCompatible(input),false);assert.equal(rulesCompatible({...input,policy:{scopeRuleHashes:{'(default)':PINS.defaultRulesSha256}}}),true);assert.equal(rulesCompatible({...input,policy:{scopeRuleHashes:{'(default)':PINS.defaultRulesSha256}},receipt:{...receipt,ownerApproved:false}}),false);});

test('the Marketplace rules cutover requires both production receipts to match the exact published default rules', () => {
 const previous = '8d105d51885783e5b98993ca185d0ac968abf4d1eb423f53d78710e78dcc9047';
 const next = PINS.defaultRulesSha256;
 assert.notEqual(next,previous);
 const defaultScope = '(default)';
 const verify = (liveHash, accountHash, cleanupHash) => rulesCompatible({
  database:defaultScope, liveHash, expectedHash:next,
  policy:{scopeRuleHashes:{[defaultScope]:accountHash}},
  receipt:{...receipt,defaultRulesSha256:cleanupHash},
 });
 assert.equal(verify(previous,previous,previous),true);
 assert.equal(verify(next,next,next),true);
 assert.equal(verify(next,previous,next),false);
 assert.equal(verify(next,next,previous),false);
 assert.equal(verify(previous,previous,next),false);
 assert.equal(verify('unreviewed','unreviewed','unreviewed'),false);
});
