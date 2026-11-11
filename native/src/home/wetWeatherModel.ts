import type {atmosphereFor} from './weatherAtmosphereModel';
type Scene=ReturnType<typeof atmosphereFor>;
export function wetProfile(scene:Pick<Scene,'wet'|'storm'|'drizzle'|'heavy'>,code?:number){
 const kind=!scene.wet?'dry':scene.storm?'storm':scene.drizzle?'drizzle':scene.heavy?'heavy':[61,66,80].includes(code??-1)?'light':'rain';
 const count={dry:0,drizzle:10,light:16,rain:24,heavy:34,storm:34}[kind];
 return {kind,count,beads:kind==='dry'?0:kind==='drizzle'?5:8,runners:kind==='dry'?0:kind==='drizzle'?2:3};
}
export function noise(seed:number){'worklet';const n=Math.sin(seed*12.9898+78.233)*43758.5453;return n-Math.floor(n);}
export function rainMesh(kind:ReturnType<typeof wetProfile>['kind'],count:number){
 return Array.from({length:count},(_,i)=>{
  const seed=i*31.73+19,depth=.18+noise(seed)*.82,fine=kind==='drizzle';
  return {seed,depth,x:noise(seed+1),phase:noise(seed+2),duration:(fine?2500:kind==='light'?1450:850)*(1.7-depth*.8+noise(seed+3)*.4),
   length:(fine?2.2:kind==='storm'||kind==='heavy'?14:8)*(depth+.5),thickness:fine?.35+depth*.25:.35+depth*.6,opacity:(fine?.10:.16)+depth*(fine?.12:.23)};
 });
}
export type RainDrop=ReturnType<typeof rainMesh>[number];
export function rainPosition(time:number,drop:RainDrop,width:number,height:number,wind:number){
 'worklet';const lifetime=time/drop.duration+drop.phase,cycle=Math.floor(lifetime),p=lifetime-cycle;
 const drift=-(wind*.6+noise(drop.seed+cycle)*7)*drop.depth;
 return {x:noise(drop.seed+cycle*1.618)*width+drift*p+Math.sin(time*.0004+drop.seed)*2,y:-drop.length+p*(height+drop.length*2),
  angle:Math.atan2(-drift,height)*180/Math.PI,opacity:drop.opacity*Math.min(1,p/.025,(1-p)/.035)};
}
export function glassTrack(i:number){const seed=71+i*29.31;return {x:i%2?.84+noise(seed)*.1:.04+noise(seed)*.12,y:.10+noise(seed+2)*.42,duration:18000+noise(seed+3)*19000,phase:noise(seed+4)};}
export function glassPosition(time:number,track:ReturnType<typeof glassTrack>,height:number){
 'worklet';const p=(time/track.duration+track.phase)%1,slide=Math.max(0,(p-.34)/.66),merge=Math.min(1,p/.28);
 return {y:track.y*height+slide*slide*height*.78,mass:1+merge*.32,feederY:-13*(1-merge),feederX:4*(1-merge),feederOpacity:Math.max(0,1-merge),
  opacity:Math.min(1,p/.06,(1-p)/.05)*.46,stretch:1+slide*.45};
}
export function lightningPlan(seed:number,width:number,height:number){
 let index=0;const random=()=>noise(seed+(++index)*17.17),clamp=(n:number)=>Math.min(width*.97,Math.max(width*.03,n));
 const start={x:width*(.2+random()*.62),y:height*(.015+random()*.055)},steps=12+Math.floor(random()*7),length=height*(.43+random()*.36);
 const weights=Array.from({length:steps},()=>.5+random()),total=weights.reduce((sum,n)=>sum+n,0);
 const points=[start];let heading=(random()-.5)*width*.15,progress=0;
 for(let i=1;i<=steps;i++){progress+=weights[i-1]/total;heading=heading*.3+(random()-.5)*width*.11;points.push({x:clamp(points[i-1].x+heading),y:start.y+length*progress});}
 const path=(p:typeof points)=>p.map((v,i)=>`${i?'L':'M'}${v.x.toFixed(2)} ${v.y.toFixed(2)}`).join(' '),branches:string[]=[];
 for(let i=3;i<steps-2;i+=3){if(random()<.2)continue;const fork=[points[i]],direction=random()<.5?-1:1;
  for(let j=0;j<3+Math.floor(random()*3);j++)fork.push({x:clamp(fork.at(-1)!.x+direction*width*(.018+random()*.045)),y:Math.min(height*.95,fork.at(-1)!.y+height*(.015+random()*.035))});
  branches.push(path(fork));
 }
 return {main:path(points),branches,start};
}
/** One timeout at a time; cancelling also guards a callback already queued by the host. */
export function scheduleStorm(onStrike:()=>void,random= Math.random,timers:{set:(fn:()=>void,delay:number)=>ReturnType<typeof setTimeout>;clear:(timer:ReturnType<typeof setTimeout>)=>void}={set:setTimeout,clear:clearTimeout}){
 let canceled=false,timer:ReturnType<typeof setTimeout>;
 const schedule=()=>{timer=timers.set(()=>{if(canceled)return;onStrike();if(!canceled)schedule();},8000+Math.max(0,Math.min(1,random()))*18000);};schedule();
 return()=>{canceled=true;timers.clear(timer);};
}
