import {useEffect} from 'react';
import {cancelAnimation,Easing,useSharedValue,withRepeat,withTiming} from 'react-native-reanimated';
/** Preserve the exact existing linear cycle and resume its remaining segment. */
export function useWeatherCycle(active:boolean,duration:number){
 const phase=useSharedValue(0);
 useEffect(()=>{
  if(active){
   const start=phase.get();
   if(start===0)phase.set(withRepeat(withTiming(1,{duration,easing:Easing.linear}),-1,false));
   else phase.set(withTiming(1,{duration:Math.max(1,(1-start)*duration),easing:Easing.linear},finished=>{
    'worklet';if(!finished)return;phase.set(0);phase.set(withRepeat(withTiming(1,{duration,easing:Easing.linear}),-1,false));
   }));
  }else cancelAnimation(phase);
  return()=>cancelAnimation(phase);
 },[active,duration,phase]);
 return phase;
}
