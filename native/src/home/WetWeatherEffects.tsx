import {memo,useEffect,useId,useMemo,useRef,useState} from 'react';
import {StyleSheet,View} from 'react-native';
import Svg,{Defs,Ellipse,Path,RadialGradient,LinearGradient,Stop} from 'react-native-svg';
import Animated,{cancelAnimation,Easing,useAnimatedStyle,useFrameCallback,useSharedValue,withSequence,withTiming,type SharedValue} from 'react-native-reanimated';
import {glassPosition,glassTrack,lightningPlan,noise,rainMesh,rainPosition,scheduleStorm,wetProfile,type RainDrop} from './wetWeatherModel';

type Profile=ReturnType<typeof wetProfile>;
export const WetWeatherEffects=memo(function WetWeatherEffects({profile,active,width,height,wind}:{profile:Profile;active:boolean;width:number;height:number;wind:number}){
 const time=useSharedValue(0);
 const frame=useFrameCallback(info=>{time.value+=Math.min(info.timeSincePreviousFrame??0,64);},false);
 useEffect(()=>{frame.setActive(active);return()=>frame.setActive(false);},[active,frame]);
 const drops=useMemo(()=>rainMesh(profile.kind,profile.count),[profile.kind,profile.count]);
 const tracks=useMemo(()=>Array.from({length:profile.runners},(_,i)=>glassTrack(i)),[profile.runners]);
 return <View pointerEvents="none" accessible={false} style={styles.clip}>
  {drops.map(drop=><RainStreak key={drop.seed} drop={drop} time={time} active={active} width={width} height={height} wind={wind}/>)}
  <GlassBeads count={profile.beads} width={width} height={height} large={profile.kind!=='drizzle'}/>
  {tracks.map((track,i)=><GlassRunner key={i} track={track} time={time} width={width} height={height} size={profile.kind==='drizzle'?12:profile.kind==='heavy'||profile.kind==='storm'?24:20}/>)}
  {profile.kind==='storm'&&<Lightning active={active} width={width} height={height}/>}
 </View>;
});
const RainStreak=memo(function RainStreak({drop,time,active,width,height,wind}:{drop:RainDrop;time:SharedValue<number>;active:boolean;width:number;height:number;wind:number}){
 const id=useId().replace(/[^a-zA-Z0-9]/g,'');
 const motion=useAnimatedStyle(()=>{const p=rainPosition(time.value,drop,width,height,wind);return{opacity:active?p.opacity:0,transform:[{translateX:p.x},{translateY:p.y},{rotate:`${p.angle}deg`}]};});
 const radius=drop.radius,canvasWidth=Math.max(4,Math.ceil(radius*2.8+2)),cx=canvasWidth/2,bodyY=drop.length+radius+1,canvasHeight=drop.length+radius*2+3;
 return <Animated.View style={[{position:'absolute',top:0,left:0,width:canvasWidth,height:canvasHeight},motion]}>
  <Svg width="100%" height="100%" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}>
   <Defs>
    <LinearGradient id={`${id}trail`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#d8eafa" stopOpacity={0}/><Stop offset=".7" stopColor="#d8eafa" stopOpacity={.24}/><Stop offset="1" stopColor="#f5fcff" stopOpacity={.65}/></LinearGradient>
    <RadialGradient id={`${id}body`} cx="28%" cy="24%" r="80%"><Stop offset="0" stopColor="#fff" stopOpacity={.7}/><Stop offset=".32" stopColor="#e1f4ff" stopOpacity={.15}/><Stop offset=".65" stopColor="#b9d8ec" stopOpacity={.08}/><Stop offset="1" stopColor="#173b51" stopOpacity={.65}/></RadialGradient>
   </Defs>
   <Path d={`M${cx} .5L${cx} ${radius?bodyY-radius*.55:drop.length}`} stroke={`url(#${id}trail)`} strokeWidth={drop.thickness*2.4} opacity={.12} strokeLinecap="round"/>
   <Path d={`M${cx} .5L${cx} ${radius?bodyY-radius*.55:drop.length}`} stroke={`url(#${id}trail)`} strokeWidth={drop.thickness} strokeLinecap="round"/>
   {radius>0&&<>
    {/* Falling water is rounded/slightly flattened, never a pointed cartoon teardrop. */}
    <Ellipse cx={cx} cy={bodyY} rx={radius} ry={radius*.82} fill={`url(#${id}body)`} stroke="#d6efff" strokeOpacity={.36} strokeWidth={.4}/>
    <Path d={`M${cx-radius*.56} ${bodyY-radius*.08}Q${cx-radius*.55} ${bodyY-radius*.6} ${cx+radius*.04} ${bodyY-radius*.55}`} stroke="#f6fdff" strokeWidth={.55} opacity={.8} fill="none" strokeLinecap="round"/>
   </>}
  </Svg>
 </Animated.View>;
});
function GlassBeads({count,width,height,large}:{count:number;width:number;height:number;large:boolean}){
 const id=useId().replace(/[^a-zA-Z0-9]/g,'');
 const beads=useMemo(()=>Array.from({length:count},(_,i)=>{const seed=i*21.71+9;return{x:width*(i%3===0?.32+noise(seed)*.35:i%2?.83+noise(seed)*.13:.025+noise(seed)*.14),y:height*(.08+noise(seed+1)*.85),r:large?2+noise(seed+3)*2.7:1.1+noise(seed+3)*1.6};}),[count,width,height,large]);
 return <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} viewBox={`0 0 ${width} ${height}`}>
  <Defs><RadialGradient id={id} cx="30%" cy="24%" r="80%"><Stop offset="0" stopColor="#f2fcff" stopOpacity={.2}/><Stop offset=".4" stopColor="#d3ebff" stopOpacity={.015}/><Stop offset="1" stopColor="#173746" stopOpacity={.20}/></RadialGradient></Defs>
  {beads.map((b,i)=><ViewlessBead key={i} x={b.x} y={b.y} r={b.r} fill={`url(#${id})`}/>)}
 </Svg>;
}
function ViewlessBead({x,y,r,fill}:{x:number;y:number;r:number;fill:string}){return <>
 <Ellipse cx={x} cy={y} rx={r} ry={r*1.23} fill={fill} stroke="#def5ff" strokeOpacity={.19} strokeWidth={.45}/>
 <Path d={`M${x-r*.55} ${y-r*.2}Q${x-r*.6} ${y-r*.85} ${x+r*.18} ${y-r*.9}`} stroke="#f6fdff" strokeWidth={.55} opacity={.46} fill="none"/>
 </>;}
function WaterLens({trail=false}:{trail?:boolean}){
 const id=useId().replace(/[^a-zA-Z0-9]/g,'');
 return <Svg width="100%" height="100%" viewBox="0 0 24 52">
  <Defs><RadialGradient id={id} cx="30%" cy="35%" r="75%"><Stop offset="0" stopColor="#fff" stopOpacity={.55}/><Stop offset=".25" stopColor="#e2f7ff" stopOpacity={.07}/><Stop offset=".7" stopColor="#bedcf3" stopOpacity={.035}/><Stop offset="1" stopColor="#133a4c" stopOpacity={.55}/></RadialGradient></Defs>
  {trail&&<Path d="M12 1C10 13 13 22 12 34" stroke="#e4f9ff" strokeWidth={.8} opacity={.12} fill="none"/>}
  <Path d="M12 35C8 34 5.4 37.2 4.8 42C4.2 47.4 7.4 50.8 12 50.5C17.3 50.5 20 47.4 19.1 42C18.4 37.9 16 34.9 12 35Z" fill={`url(#${id})`} stroke="#d7f4ff" strokeOpacity={.4} strokeWidth={.8}/>
  <Path d="M8 43Q7 39 11 37" stroke="#fff" strokeWidth={1} opacity={.7} fill="none" strokeLinecap="round"/>
 </Svg>;
}
function GlassRunner({track,time,width,height,size}:{track:ReturnType<typeof glassTrack>;time:SharedValue<number>;width:number;height:number;size:number}){
 const main=useAnimatedStyle(()=>{const p=glassPosition(time.value,track,height);return{opacity:p.opacity,transform:[{translateX:track.x*width},{translateY:p.y},{scaleX:p.mass},{scaleY:p.mass*p.stretch}]};});
 const feeder=useAnimatedStyle(()=>{const p=glassPosition(time.value,track,height);return{opacity:p.opacity*p.feederOpacity*.7,transform:[{translateX:track.x*width+p.feederX},{translateY:p.y+p.feederY},{scale:.7}]};});
 return <>
  <Animated.View style={[styles.bead,{width:size,height:size*2.8},main]}><WaterLens trail/></Animated.View>
  <Animated.View style={[styles.bead,{width:size,height:size*2.8},feeder]}><WaterLens/></Animated.View>
 </>;
}
function Lightning({active,width,height}:{active:boolean;width:number;height:number}){
 const [strike,setStrike]=useState<ReturnType<typeof lightningPlan>|null>(null),last=useRef<typeof strike>(null);
 const pulse=useSharedValue(0);
 useEffect(()=>{
  if(!active)return;
  const cancel=scheduleStorm(()=>setStrike(lightningPlan(Math.floor(Math.random()*1e8),width,height)));
  return()=>{cancel();cancelAnimation(pulse);pulse.set(0);};
 },[active,width,height,pulse]);
 useEffect(()=>{
  if(!active||!strike||last.current===strike)return;last.current=strike;
  // One brief double discharge, then a soft afterglow; long, irregular quiet intervals.
  pulse.set(withSequence(withTiming(1,{duration:28}),withTiming(.16,{duration:65}),withTiming(.72,{duration:32}),withTiming(0,{duration:420,easing:Easing.out(Easing.quad)})));
 },[active,strike,pulse]);
 const bolt=useAnimatedStyle(()=>({opacity:active?pulse.value:0}));
 const cloudLight=useAnimatedStyle(()=>({opacity:active?pulse.value*.14:0}));
 const id=useId().replace(/[^a-zA-Z0-9]/g,'');
 if(!strike)return null;
 return <>
  <Animated.View style={[StyleSheet.absoluteFill,cloudLight]}>
   <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}><Defs><RadialGradient id={id}><Stop offset="0" stopColor="#eff6ff"/><Stop offset=".5" stopColor="#dbeaff" stopOpacity={.6}/><Stop offset="1" stopColor="#c7dfff" stopOpacity={0}/></RadialGradient></Defs><Ellipse cx={strike.start.x} cy={height*.15} rx={width*.65} ry={height*.46} fill={`url(#${id})`}/></Svg>
  </Animated.View>
  <Animated.View style={[StyleSheet.absoluteFill,bolt]}>
   <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
    <Path d={strike.main} stroke="#aacfff" strokeWidth={6} opacity={.09} fill="none" strokeLinejoin="round"/>
    <Path d={strike.main} stroke="#d2e6ff" strokeWidth={2.6} opacity={.38} fill="none" strokeLinejoin="round"/>
    {strike.branches.map((path,i)=><Path key={i} d={path} stroke="#e5f2ff" strokeWidth={.6+i%2*.2} opacity={.65} fill="none"/>)}
    <Path d={strike.main} stroke="#f5fbff" strokeWidth={1} fill="none" strokeLinejoin="round"/>
   </Svg>
  </Animated.View>
 </>;
}
const styles=StyleSheet.create({
 // Same 28-point radius as the existing Weather tile; never a screen-level overlay.
 clip:{position:'absolute',top:0,right:0,bottom:0,left:0,borderRadius:28,overflow:'hidden'},
 bead:{position:'absolute',top:0,left:0,width:12,height:34,transformOrigin:'50% 75%'},
});
