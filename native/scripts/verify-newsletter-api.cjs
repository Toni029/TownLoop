// Read-only release preflight. The only public configuration is the HTTPS service origin.
(async()=>{
 const base=process.env.EXPO_PUBLIC_TOWNLOOP_API_URL?.trim();
 if(!base)throw Error('A verified HTTPS native API URL is required before releasing newsletter analysis. No URL was invented.');
 const url=new URL(base);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('Use a credential-free HTTPS API origin.');
 const response=await fetch(base.replace(/\/$/,'')+'/api/newsletter/native/health',{redirect:'error',signal:AbortSignal.timeout(15000)});
 const value=await response.json().catch(()=>null);
 if(!response.ok||value?.service!=='townloop-native-api'||value.projectId!=='cc-livingcommunity-app')throw Error('This address is not the TownLoop native API. Static Hosting and HTML responses are not valid.');
 const guard=await fetch(base.replace(/\/$/,'')+'/api/newsletter/native/capabilities',{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(guard.status!==401)throw Error('The analysis endpoint must reject unauthenticated requests.');
 console.log('HTTPS service identity and authentication boundary verified. An approved Admin/VIP must still verify capabilities and Gemini configuration in Preview.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
