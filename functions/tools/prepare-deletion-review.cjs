'use strict';
// Review/status callables only. Importing never stages files or initializes SDKs.
const path=require('node:path');
function prepare({target}={}){return require('./deletion-package.cjs').prepare({target:target||path.resolve(__dirname,'../../.release/deletion-review'),entries:['deletionReviewEntry.cjs']});}
module.exports={prepare};
if(require.main===module){prepare();console.log('Prepared review-only sources; no deployment performed.');}
