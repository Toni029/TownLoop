import test from 'node:test';import assert from 'node:assert/strict';
import {lifecycleHarness,appLifecycle,fakeIntervals,settle,nodes} from './helpers/lifecycleHarness';
import {createWeatherViewport} from '../src/home/weatherViewport';
import {foregroundPoll} from '../src/lib/foregroundPoll';
import {atmosphereFor} from '../src/home/weatherAtmosphereModel';import * as protocol from '../src/notifications/protocol';
const hour={time:'Now',temp:'70°',icon:'rain' as const,weatherCode:63,condition:'Rain',shortForecast:'Rain'};
const icons=new Proxy({},{get:(_,key)=>String(key)});
function weather(){const lifecycle=appLifecycle(),timers=fakeIntervals();let fetches=0;
 const h=lifecycleHarness('home/Weather.tsx',()=>({
  '../lib/foregroundPoll':{foregroundPoll:(app:any,run:any,period:number,pause:any)=>foregroundPoll(app,run,period,pause,timers as any)},
  'react-native':{AppState:lifecycle.app,View:'View',Pressable:'Pressable',ActivityIndicator:'Spinner'},'expo-router':{useIsFocused:()=>true},'../keyboard/KeyboardScrollView':{ScrollView:'Scroll'},'expo-linear-gradient':{LinearGradient:'Gradient'},'lucide-react-native':icons,
  './ui':{Theme:{},Action:'Action',Box:'Box',Row:'Row',Txt:'Text'},'./WeatherAtmosphere':{WeatherAtmosphere:'Atmosphere'},'./weatherAtmosphereModel':{isNightHour:()=>false},
  './weatherModel':{OPEN_METEO_API_URL:'https://synthetic.invalid',parseWeather:()=>({forecastDays:[]})},
  __globals:{...timers,fetch:async()=>{fetches++;return{ok:true,json:async()=>({})};}},
 }));return{...h,lifecycle,timers,get fetches(){return fetches;}};
}
test('weather polling has no timer wakeups while backgrounded or scrolled out of view',async()=>{
 const f=weather();f.render(f.exports.Weather,{visible:true});await settle();f.lifecycle.change('background');for(let i=0;i<5;i++){f.timers.tick();await settle();}
 const backgroundTicks=f.timers.ticks;f.lifecycle.change('active');await settle();f.render(f.exports.Weather,{visible:false});for(let i=0;i<5;i++){f.timers.tick();await settle();}const offscreenTimers=f.timers.count;f.dispose();console.log(JSON.stringify({measurement:'weather',backgroundTicks,offscreenTimers}));assert.equal(backgroundTicks,0,'Five-minute background wakeups');assert.equal(offscreenTimers,0);
});
test('weather scene pauses all existing effects while its card is outside the viewport',()=>{
 const app=appLifecycle();const h=lifecycleHarness('home/WeatherAtmosphere.tsx',()=>({
  'react-native':{AppState:app.app,Image:'Image',View:'View',StyleSheet:{absoluteFill:{},create:(v:any)=>v}},'expo-router':{useIsFocused:()=>true},'expo-linear-gradient':{LinearGradient:'Gradient'},'react-native-svg':{default:'Svg'},
  'react-native-reanimated':{default:{View:'AnimatedView'},FadeIn:{duration:()=>0},FadeOut:{duration:()=>0}},'./useWeatherCycle':{useWeatherCycle:()=>({value:0})},'./hooks':{useReducedMotion:()=>false},'./weatherAtmosphereModel':{atmosphereFor},'./WetWeatherEffects':{WetWeatherEffects:'WetEffects'},'./wetWeatherModel':{wetProfile:()=>({kind:'rain'})},
 }));const tree=h.render(h.exports.WeatherAtmosphere,{hour,visible:false});const scene=nodes(tree).find(n=>typeof n.type==='function');assert.equal(scene.props.active,false);h.dispose();
});
test('legacy Inbox polling coalesces initial requests and stops background polls without stopping its live membership listener',async()=>{
 const lifecycle=appLifecycle(),timers=fakeIntervals();let scans=0,stopped=0;
 const h=lifecycleHarness('profile/groupInbox.ts',()=>({
  '../lib/foregroundPoll':{foregroundPoll:(app:any,run:any,period:number,pause:any)=>foregroundPoll(app,run,period,pause,timers as any)},
  'react-native':{AppState:lifecycle.app},'./inboxActionError':{inboxActionError:(e:any)=>e},'./legacyLeaveEvents':{confirmedLegacyLeave:()=>{},onConfirmedLegacyLeave:()=>()=>{}},
  'firebase/firestore':{collection:()=>0,query:()=>0,where:()=>0,orderBy:()=>0,limit:()=>0,onSnapshot:(_:any,next:any)=>{next({docs:[]});return()=>stopped++;}},
  'firebase/functions':{getFunctions:()=>0,httpsCallable:()=>async(d:any)=>{if(d.op==='listLegacy')scans++;return{data:d.op==='capabilities'?{enabled:true,protocolVersion:3}:{rows:[]}};}},'../lib/firebase':{app:{},auth:{currentUser:{uid:'a'}},db:{}},'./model':{readThread:()=>null},
  __globals:timers,
 }));h.render(h.exports.useGroupInbox,{id:'a',approved:true,role:'resident'});await settle();const initialScans=scans;const before=scans;lifecycle.change('background');for(let i=0;i<10;i++){timers.tick();await settle();}const backgroundScans=scans-before;assert.equal(stopped,0);lifecycle.change('active');await settle();const resumedScans=scans;h.dispose();console.log(JSON.stringify({measurement:'legacy-inbox',initialScans,backgroundScans}));assert.equal(initialScans,1);assert.equal(backgroundScans,0);assert.equal(resumedScans,before+1);assert.equal(stopped,1);assert.equal(timers.count,0);
});
test('unchanged permission on resume triggers one device registration rather than two',async()=>{
 const lifecycle=appLifecycle();let registrations=0;
 const writer={version:()=>0,hydrate:()=>{},confirmed:()=>{},snapshot:()=>({phase:'saved'}),dispose:()=>{}};
 const h=lifecycleHarness('notifications/InboxPushProvider.tsx',()=>({
  'react-native':{AppState:lifecycle.app,Platform:{OS:'android'}},'firebase/auth':{beforeAuthStateChanged:()=>()=>{}},'firebase/firestore':{},'expo-router':{router:{},useRootNavigationState:()=>({key:'root'})},'../lib/community':{useCommunity:()=>({community:'synthetic',ready:true})},'../lib/session':{useSession:()=>({user:{uid:'a'},profile:{approved:true,role:'resident'},loading:false})},'../lib/firebase':{app:{},auth:{currentUser:{uid:'a'}},db:{}},'../profile/model':{},'./protocol':protocol,'./preferenceQueue':{preferenceQueue:()=>writer},
  './device':{serialized:protocol.serialOperations(),revoke:async()=>{},getNotificationAuthorization:async()=>'granted',applyNotificationPermission:async()=>{},categoryPreferences:async()=>({...protocol.emptyPreferences,inbox:true}),syncDevice:async()=>{registrations++;return'on';},notificationCapabilities:()=>({discussionReplies:true}),refreshBadge:async()=>{},requestNativeNotificationPermission:async()=>'granted',notifications:()=>null},
 }));h.render(h.exports.InboxPushProvider);await settle();const initial=registrations;for(let i=0;i<5;i++){lifecycle.change('background');lifecycle.change('active');await settle();}h.dispose();console.log(JSON.stringify({measurement:'notification-registration',initial,resumeCalls:registrations-initial}));assert.equal(registrations-initial,5);
});

test('viewport publishes only visibility edges and accounts for content padding and resizing',()=>{
 const viewport=createWeatherViewport();let updates=0;const stop=viewport.subscribe(()=>updates++);
 viewport.viewport(600);viewport.origin(16);viewport.card(0,400);
 for(let y=0;y<416;y++)viewport.scroll(y);
 assert.equal(updates,0);assert.equal(viewport.snapshot(),true);
 viewport.scroll(416);assert.equal(updates,1);assert.equal(viewport.snapshot(),false);
 viewport.scroll(415);assert.equal(updates,2);assert.equal(viewport.snapshot(),true);
 viewport.viewport(0);assert.equal(viewport.snapshot(),true);stop();viewport.scroll(1000);viewport.viewport(600);assert.equal(updates,2);
});
test('weather cycle pauses at its current phase and resumes the remaining segment without duplicate loops',()=>{
 let phase=0,cancels=0;const starts:any[]=[];const shared={get:()=>phase,set:(v:any)=>{if(typeof v==='number')phase=v;else starts.push(v);}};
 const f=lifecycleHarness('home/useWeatherCycle.ts',()=>({'react-native-reanimated':{
  useSharedValue:()=>shared,cancelAnimation:()=>cancels++,Easing:{linear:'linear'},withRepeat:(animation:any)=>({repeat:animation}),withTiming:(to:number,options:any,done:any)=>({to,options,done}),
 }}));
 const render=(active:boolean)=>f.render(()=>f.exports.useWeatherCycle(active,1000));
 render(true);assert.equal(starts[0].repeat.options.duration,1000);
 phase=.4;render(false);assert.equal(phase,.4);assert.equal(starts.length,1);
 render(true);assert.equal(starts[1].options.duration,600);
 starts[1].done(false);assert.equal(starts.length,2);
 phase=1;starts[1].done(true);assert.equal(phase,0);assert.equal(starts[2].repeat.options.duration,1000);
 f.dispose();assert.equal(cancels,4);
});
test('foreground polling never multiplies timers across repeated resume events and handles failures',async()=>{
 const lifecycle=appLifecycle('background'),timers=fakeIntervals();let calls=0;
 const stop=foregroundPoll(lifecycle.app,async()=>{calls++;throw Error('synthetic offline');},1000,()=>{},timers as any);
 assert.equal(timers.count,0);
 for(let i=0;i<5;i++){lifecycle.change('active');lifecycle.change('active');assert.equal(timers.count,1);lifecycle.change('background');assert.equal(timers.count,0);}
 await settle();assert.equal(calls,5);stop();assert.equal(lifecycle.listeners.size,0);
});
test('weather cancels an in-flight network request on backgrounding and ignores its stale result',async()=>{
 const lifecycle=appLifecycle(),timers=fakeIntervals();let signal:AbortSignal|undefined,resolve:any,parsed=0;
 const h=lifecycleHarness('home/Weather.tsx',()=>({
  'react-native':{AppState:lifecycle.app,View:'View',Pressable:'Pressable',ActivityIndicator:'Spinner'},'expo-router':{useIsFocused:()=>true},'../keyboard/KeyboardScrollView':{ScrollView:'Scroll'},'expo-linear-gradient':{LinearGradient:'Gradient'},'lucide-react-native':icons,
  '../lib/foregroundPoll':{foregroundPoll:(app:any,run:any,period:number,pause:any)=>foregroundPoll(app,run,period,pause,timers as any)},
  './ui':{Theme:{},Action:'Action',Box:'Box',Row:'Row',Txt:'Text'},'./WeatherAtmosphere':{WeatherAtmosphere:'Atmosphere'},'./weatherAtmosphereModel':{isNightHour:()=>false},
  './weatherModel':{OPEN_METEO_API_URL:'https://synthetic.invalid',parseWeather:()=>{parsed++;return{forecastDays:[]};}},
  __globals:{...timers,fetch:(_url:any,options:any)=>{signal=options.signal;return new Promise(done=>{resolve=done;});}},
 }));
 h.render(h.exports.Weather);assert.equal(signal?.aborted,false);lifecycle.change('background');assert.equal(signal?.aborted,true);
 resolve({ok:true,json:async()=>({})});await settle();assert.equal(parsed,0);h.dispose();assert.equal(lifecycle.listeners.size,0);
});
test('account switching discards a late Inbox bootstrap and disposes the previous account polling',async()=>{
 const lifecycle=appLifecycle(),timers=fakeIntervals(),auth={currentUser:{uid:'a'}};let release:any,subscribed=0,unsubscribed=0;
 const h=lifecycleHarness('profile/groupInbox.ts',()=>({
  'react-native':{AppState:lifecycle.app},'../lib/foregroundPoll':{foregroundPoll:(app:any,run:any,period:number,pause:any)=>foregroundPoll(app,run,period,pause,timers as any)},
  './inboxActionError':{inboxActionError:(e:any)=>e},'./legacyLeaveEvents':{confirmedLegacyLeave:()=>{},onConfirmedLegacyLeave:()=>()=>{}},'./model':{readThread:()=>null},
  'firebase/firestore':{collection:()=>0,query:()=>0,where:()=>0,orderBy:()=>0,limit:()=>0,onSnapshot:(_:any,next:any)=>{subscribed++;next({docs:[]});return()=>unsubscribed++;}},
  'firebase/functions':{getFunctions:()=>0,httpsCallable:()=>async(d:any)=>{if(d.op==='capabilities'&&auth.currentUser.uid==='a')return await new Promise(done=>{release=done;});return{data:d.op==='capabilities'?{enabled:true,protocolVersion:3}:{rows:[]}};}},'../lib/firebase':{app:{},auth,db:{}},__globals:timers,
 }));
 h.render(h.exports.useGroupInbox,{id:'a',approved:true,role:'resident'});auth.currentUser={uid:'b'};h.render(h.exports.useGroupInbox,{id:'b',approved:true,role:'resident'});await settle();
 release({data:{enabled:true,protocolVersion:3}});await settle();assert.equal(subscribed,1);assert.equal(timers.count,1);
 h.render(h.exports.useGroupInbox,null);assert.equal(unsubscribed,1);assert.equal(timers.count,0);h.dispose();assert.equal(lifecycle.listeners.size,0);
});
