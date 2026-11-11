'use strict';
const fs=require('node:fs'),Module=require('node:module');
const {protectedReadOnlySource}=require('./databaseCleanupQuotaGateway.cjs');
const filename=require.resolve('./databaseCleanupReadOnlyEntry.cjs');
const isolated=new Module(filename,module);
isolated.filename=filename;isolated.paths=module.paths;
// Only a checked local source is compiled; no client input or remote source is used.
isolated._compile(protectedReadOnlySource(fs.readFileSync(filename,'utf8')),filename);
module.exports=isolated.exports;
