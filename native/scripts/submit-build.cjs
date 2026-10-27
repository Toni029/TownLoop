// Manual, owner-approved builds only. Submit once, open the returned page, never poll.
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
function assertManagedSource(root,exists=fs.existsSync){
 if(['android','ios'].some(dir=>exists(path.join(root,dir))))throw Error('Use the clean managed release checkout; preserve local generated native directories. No build was submitted.');
}
function buildPages(builds){
 if(!Array.isArray(builds)||!builds.length)throw Error('No build ID returned. Do not resubmit blindly; inspect EAS first.');
 return builds.map(b=>{
  if(!/^[a-f0-9-]{36}$/i.test(b.id||''))throw Error('Invalid build ID. Do not retry submission.');
  return `https://expo.dev/accounts/seeds4clix/projects/townloop-native/builds/${b.id}`;
 });
}
function openPage(url,{platform=process.platform,spawn=spawnSync,print=console.log}={}){
 print(url); // Always provide the exact link, including when browser launch fails.
 const command=platform==='darwin'?'open':platform==='win32'?'rundll32':'xdg-open';
 const args=platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];
 const result=spawn(command,args,{stdio:'ignore',timeout:10000});
 if(result.error||result.status!==0)print('Browser could not open automatically. Use the build link above.');
}
function main(){
 const [platform='android',profile='preview']=process.argv.slice(2);
 assertBuildTarget(platform,profile);
 assertManagedSource(path.resolve(__dirname,'..'));
 const result=spawnSync(process.execPath,[path.resolve(__dirname,'../node_modules/eas-cli/bin/run'),'build','--platform',platform,'--profile',profile,'--no-wait','--json','--non-interactive'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',stdio:['inherit','pipe','inherit'],maxBuffer:10*1024*1024});
 let returned=[];try{returned=JSON.parse(result.stdout||'[]');}catch{}
 if(returned.length)for(const url of buildPages(returned))openPage(url);
 if(result.error||result.status!==0)throw Error('EAS submission failed. No automatic retry or cancellation was attempted.');
 if(!returned.length)buildPages(returned);
}
function assertBuildTarget(platform,profile){
 if(!['android','ios','all'].includes(platform)||!['preview','development','production','ios-simulator'].includes(profile))throw Error('Choose the explicitly approved platform and profile.');
 if(profile==='ios-simulator'&&platform!=='ios')throw Error('The unsigned simulator profile is iOS-only. No build was submitted.');
}
module.exports={buildPages,openPage,assertManagedSource,assertBuildTarget};
if(require.main===module){try{main();}catch(error){console.error(error.message);process.exitCode=1;}}
