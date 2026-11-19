'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const source=path.resolve(__dirname,'..'),root=path.resolve(source,'..');
function prepare({target,entries,withManifest=false}){
 if(!target||!path.isAbsolute(target))throw Error('Explicit absolute package directory required');
 fs.mkdirSync(target,{recursive:true});const copied=new Set();
 function collect(file){
  const input=path.resolve(source,file);if(!input.startsWith(source+path.sep))throw Error('Dependency escapes functions directory');
  if(copied.has(file))return;copied.add(file);
  if(file==='deletionScopeRules.json'&&withManifest)return;
  if(!fs.existsSync(input))throw Error('Missing runtime dependency: '+file);
  const text=fs.readFileSync(input);fs.mkdirSync(path.dirname(path.join(target,file)),{recursive:true});fs.writeFileSync(path.join(target,file),text);
  if(file.endsWith('.cjs'))for(const m of text.toString().matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)){
   const absolute=path.resolve(path.dirname(input),m[1]);const candidates=[absolute,absolute+'.cjs',absolute+'.json'];const found=candidates.find(p=>fs.existsSync(p)&&fs.statSync(p).isFile())||(path.basename(absolute)==='deletionScopeRules.json'&&withManifest?absolute:null);
   if(!found)throw Error('Missing runtime dependency from '+file+': '+m[1]);collect(path.relative(source,found));
  }
 }
 for(const entry of entries)collect(entry);
 if(withManifest){const {PINS}=require('../databaseCleanupSafety.cjs');const sources=[['(default)','security/database-cleanup/firestore.rules',PINS.defaultRulesSha256],[PINS.namedDatabase,'security/native-only-firestore/firestore.named.rules',PINS.namedRulesSha256]];
  for(const[,file,expected]of sources)if(createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')!==expected)throw Error('Reviewed rules hash mismatch');
  fs.writeFileSync(path.join(target,'deletionScopeRules.json'),JSON.stringify({project:PINS.project,scopes:sources.map(([database,,candidateSHA256])=>({database,candidateSHA256}))},null,2)+'\n');
 }
 fs.copyFileSync(path.join(source,'package-lock.json'),path.join(target,'package-lock.json'));const pkg=JSON.parse(fs.readFileSync(path.join(source,'package.json')));pkg.main='index.cjs';delete pkg.scripts;fs.writeFileSync(path.join(target,'package.json'),JSON.stringify(pkg,null,2)+'\n');
 fs.writeFileSync(path.join(target,'index.cjs'),entries.map(entry=>`Object.assign(exports,require('./${entry}'));`).join('\n')+'\n');
 const allowed=new Set([...copied,'package.json','package-lock.json','index.cjs',...(withManifest?['deletionScopeRules.json']:[])]);
 function verifyDirectory(dir,prefix=''){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const relative=path.join(prefix,item.name);if(relative==='node_modules')continue;if(item.isDirectory())verifyDirectory(path.join(dir,item.name),relative);else if(!allowed.has(relative))throw Error('Unexpected staged release file: '+relative);}}
 verifyDirectory(target);
 if(!fs.existsSync(path.join(target,'node_modules')))fs.symlinkSync(path.join(source,'node_modules'),path.join(target,'node_modules'),'dir');
 return{target,files:[...copied]};
}
module.exports={prepare};
