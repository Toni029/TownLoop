import {test} from 'node:test';import assert from 'node:assert/strict';
import {wetProfile,rainMesh,rainPosition,glassTrack,glassPosition,lightningPlan,scheduleStorm} from '../src/home/wetWeatherModel';
import {atmosphereFor} from '../src/home/weatherAtmosphereModel';import type{HourlyForecast}from '../src/home/weatherModel';
const scene=(code:number,icon:HourlyForecast['icon'])=>atmosphereFor({weatherCode:code,icon,time:'Now',temp:'70°',condition:'',shortForecast:''});
test('only wet conditions get water; drizzle/light rain/heavy rain have bounded distinct intensities',()=>{
 const drizzle=wetProfile(scene(51,'rain'),51),light=wetProfile(scene(61,'rain'),61),rain=wetProfile(scene(63,'rain'),63),heavy=wetProfile(scene(65,'rain'),65);
 assert(drizzle.count<light.count&&light.count<rain.count&&rain.count<heavy.count);assert(heavy.count<=34);
 for(const [code,icon]of [[0,'sun'],[2,'cloudSun'],[3,'cloud'],[45,'fog'],[75,'snow']] as const)assert.deepEqual(wetProfile(scene(code,icon),code),{kind:'dry',count:0,beads:0,runners:0});
});
test('fine rain uses thin short streaks, distinct lifetimes and unsynchronized paths',()=>{
 const drops=rainMesh('drizzle',10);assert(drops.every(d=>d.thickness<.7&&d.length<4));assert.equal(new Set(drops.map(d=>d.duration)).size,10);
 const a=rainPosition(100,drops[0],360,440,12),b=rainPosition(120,drops[0],360,440,12);assert(b.y>a.y);assert.notEqual(a.y,rainPosition(100,drops[1],360,440,12).y);
 for(const d of drops)for(const t of [0,500,60000,3600000]){const p=rainPosition(t,d,320,440,60);assert(Number.isFinite(p.x)&&p.opacity>=0&&p.opacity<=.4);}
});
test('glass beads converge then gain mass and accelerate down the glass without a visible reset',()=>{
 const track={...glassTrack(0),phase:0};const early=glassPosition(track.duration*.05,track,440),merged=glassPosition(track.duration*.3,track,440),late=glassPosition(track.duration*.8,track,440);
 assert(early.feederOpacity>merged.feederOpacity);assert(merged.mass>early.mass);assert(late.y>merged.y);assert.equal(glassPosition(0,track,440).opacity,0);
});
test('bolts are bounded irregular polylines with forks and varied origins/shapes',()=>{
 const plans=[1,29,503,9001].map(seed=>lightningPlan(seed,320,440));assert.equal(new Set(plans.map(p=>p.main)).size,4);
 for(const plan of plans){assert(plan.branches.length>0);assert(plan.main.split('L').length>=13);for(const path of [plan.main,...plan.branches]){const points=[...path.matchAll(/[ML]([\d.]+) ([\d.]+)/g)];for(const p of points){assert(+p[1]>=0&&+p[1]<=320);assert(+p[2]>=0&&+p[2]<=440);}}}
});
test('storm scheduling is irregular, bounded and cancels safely across repeated navigation',()=>{
 let pending:(()=>void)|undefined,strikes=0,id=0;const delays:number[]=[],cleared:number[]=[];
 const timers={set:(fn:()=>void,delay:number)=>{pending=fn;delays.push(delay);return ++id as unknown as ReturnType<typeof setTimeout>;},clear:(t:ReturnType<typeof setTimeout>)=>{cleared.push(Number(t));}};let r=0;
 const stop=scheduleStorm(()=>strikes++,()=>[.1,.8,.3][r++%3],timers);pending!();assert.equal(strikes,1);assert.notEqual(delays[0],delays[1]);assert(delays.every(d=>d>=8000&&d<=26000));const queued=pending!;stop();queued();assert.equal(strikes,1);assert.equal(cleared.length,1);
});
