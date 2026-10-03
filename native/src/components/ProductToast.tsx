import { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { Copy } from '../news/ui';
import { useReducedMotion } from '../home/hooks';
export function ProductToast({message,onDone}:{message:string;onDone:()=>void}) {
  const [opacity]=useState(()=>new Animated.Value(0));
  const reduced=useReducedMotion();
  useEffect(()=>{
    const motion=Animated.timing(opacity,{toValue:1,duration:reduced?0:200,useNativeDriver:true});motion.start();
    const timer=setTimeout(onDone,4000);return()=>{clearTimeout(timer);motion.stop();};
  },[opacity,reduced,onDone]);
  return <Animated.View accessibilityRole="alert" accessibilityLiveRegion="polite" pointerEvents="none" style={{position:'absolute',bottom:16,left:20,right:20,backgroundColor:'#065f46',borderRadius:18,padding:16,opacity,flexDirection:'row',gap:10,alignItems:'center'}}><CheckCircle2 size={20} color="#a7f3d0"/><Copy weight="bold" style={{color:'#fff',flex:1}}>{message}</Copy></Animated.View>;
}
