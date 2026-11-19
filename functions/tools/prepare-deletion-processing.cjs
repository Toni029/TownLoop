'use strict';
// Importing this module never creates an artifact, initializes Firebase or deploys.
const path=require('node:path');
function prepare({target}={}){return require('./deletion-package.cjs').prepare({target:target||path.resolve(__dirname,'../../.release/deletion-processing'),entries:['deletionProcessingEntry.cjs','accountDeletionJobEntry.cjs'],withManifest:true});}
module.exports={prepare};
if(require.main===module){prepare();console.log('Prepared scoped deletion sources only; no build, deployment, activation or account processing performed.');}
