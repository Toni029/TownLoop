import {useEffect,useRef,useState} from 'react';
import {Animated,Easing,StyleSheet,Text,View} from 'react-native';
import {Check,Trash2,UserRound} from 'lucide-react-native';
import {MotionPressable} from '../motion/Pressable';
import {useReducedMotion} from '../home/hooks';

/** A request receipt, never a representation of completed account deletion. */
export function DeletionRequestSuccess({onDone}:{onDone:()=>void}){
 const reduced=useReducedMotion(),progress=useRef(new Animated.Value(0)).current;
 const [finished,setFinished]=useState(false);
 useEffect(()=>{
  if(reduced){progress.setValue(1);setFinished(true);return;}
  let active=true;
  const finish=()=>{if(active)setFinished(true);};
  const animation=Animated.timing(progress,{toValue:1,duration:2100,easing:Easing.inOut(Easing.cubic),useNativeDriver:true});
  // Receipt remains usable even if the native completion callback is lost.
  const timeout=setTimeout(finish,2800);
  animation.start(({finished})=>{if(finished){clearTimeout(timeout);finish();}});
  return()=>{active=false;clearTimeout(timeout);animation.stop();};
 },[progress,reduced]);
 return <View style={s.card}>
  <Text style={s.receipt}>Request submitted · Awaiting review</Text>
  <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.scene}>
   <View style={s.halo}/>
   <View style={s.paperWell}>
    <Animated.View style={[s.paper,{opacity:progress.interpolate({inputRange:[0,0.68,0.86,1],outputRange:[1,1,0,0]}),transform:[
     {translateX:progress.interpolate({inputRange:[0,0.5,1],outputRange:[-42,0,0]})},
     {translateY:progress.interpolate({inputRange:[0,0.5,0.85,1],outputRange:[-18,8,95,95]})},
     {rotate:progress.interpolate({inputRange:[0,0.5,1],outputRange:['-12deg','0deg','0deg']})},
    ]}]}>
     <View style={s.avatar}><UserRound size={23} color="#087d5c"/></View>
     <View style={s.line}/><View style={[s.line,{width:30}]}/>
    </Animated.View>
   </View>
   <View style={s.bin}><Trash2 size={60} color="#a83b37" strokeWidth={1.6}/></View>
   <Animated.View style={[s.lid,{transform:[{translateY:progress.interpolate({inputRange:[0,0.35,0.72,0.87,1],outputRange:[0,-5,-5,1,0]})},{rotate:progress.interpolate({inputRange:[0,0.35,0.72,0.87,1],outputRange:['0deg','-12deg','-12deg','2deg','0deg']})}]}]}/>
   <Animated.View style={[s.check,{opacity:progress.interpolate({inputRange:[0,0.82,1],outputRange:[0,0,1]}),transform:[{scale:progress.interpolate({inputRange:[0,0.82,1],outputRange:[0.8,0.8,1]})}]}]}><Check size={22} color="#fff" strokeWidth={3}/></Animated.View>
  </View>
  {finished && <View style={s.message} accessibilityLiveRegion="polite">
   <Text accessibilityRole="header" style={s.title}>Thank you for being part of our community!</Text>
   <Text style={s.body}>{"Your account deletion request has been submitted successfully.\n\nWe appreciate the time you've spent with TownLoop and hope to see you again someday."}</Text>
   <MotionPressable accessibilityRole="button" onPress={onDone} style={s.done}><Text style={s.doneText}>Done</Text></MotionPressable>
  </View>}
 </View>;
}
const s=StyleSheet.create({
 card:{padding:20,borderRadius:20,backgroundColor:'#faf6ed',gap:16},
 receipt:{fontFamily:'JakartaSemi',fontSize:13,lineHeight:20,color:'#087d5c',textAlign:'center'},
 scene:{width:220,maxWidth:'100%',height:180,alignSelf:'center',alignItems:'center'},
 halo:{position:'absolute',top:10,width:160,height:160,borderRadius:80,backgroundColor:'#efe7cf'},
 paperWell:{position:'absolute',width:160,height:130,top:0,overflow:'hidden',alignItems:'center'},
 paper:{position:'absolute',top:22,width:65,height:85,padding:10,gap:6,borderRadius:9,backgroundColor:'#fffdf7',borderWidth:1,borderColor:'#e0d7bc'},
 avatar:{alignSelf:'center',backgroundColor:'#e3eee2',borderRadius:16,padding:3},
 line:{height:4,width:42,borderRadius:2,backgroundColor:'#bed0c0'},
 bin:{position:'absolute',top:106,backgroundColor:'#faf6ed',borderRadius:8},
 lid:{position:'absolute',top:113,width:46,height:3,borderRadius:2,backgroundColor:'#a83b37'},
 check:{position:'absolute',top:143,left:'59%',padding:5,borderRadius:20,backgroundColor:'#087d5c',borderWidth:3,borderColor:'#faf6ed'},
 message:{gap:18},title:{fontFamily:'JakartaBold',fontSize:22,lineHeight:30,color:'#12372d',textAlign:'center'},
 body:{fontFamily:'Jakarta',fontSize:14,lineHeight:22,color:'#59675e',textAlign:'center'},
 done:{minHeight:48,padding:13,borderRadius:14,backgroundColor:'#087d5c',alignItems:'center',justifyContent:'center'},
 doneText:{fontFamily:'JakartaBold',fontSize:16,color:'#fff'},
});
