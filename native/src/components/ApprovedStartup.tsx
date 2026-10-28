import {Component,useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {AccessibilityInfo,Animated,AppState,Image,Platform,StyleSheet,View,useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LinearGradient} from 'expo-linear-gradient';
import {createVideoPlayer,VideoView,type VideoPlayer} from 'expo-video';
import {hideNativeSplash} from '../lib/nativeSplash';
import {fitPortrait} from '../layout/phoneGeometry';

// One authoritative, byte-identical owner-approved asset. No alternate logo/poster.
const source=require('../../assets/launch/approved-startup.mp4');
const background='#f1e4d3';
let claimed=false,completed=false;
// Keep the ID valid for late Fabric view props; unload the decoder source on exit.
let launchPlayer:VideoPlayer|undefined;
function playerForLaunch(){
 if(launchPlayer)return launchPlayer;
 const p=createVideoPlayer(null,Platform.OS==='android'?{disableAudioSession:true}:undefined);
 try{
  p.muted=true;p.volume=0;p.audioMixingMode='mixWithOthers';p.loop=false;
  p.showNowPlayingNotification=false;p.staysActiveInBackground=false;
  if(Platform.OS==='ios')p.allowsExternalPlayback=false;
 }catch(error){try{p.release();}catch{}throw error;}
 launchPlayer=p;return p;
}
function useMotionPreference(){
 const [reduced,setReduced]=useState<boolean|null>(null);
 useEffect(()=>{
  let alive=true,resolved=false;
  const update=(value:boolean)=>{if(alive){resolved=true;setReduced(value);}};
  const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',update);
  void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(!resolved)update(value);}).catch(()=>{if(!resolved)update(true);});
  return()=>{alive=false;sub.remove();};
 },[]);
 return reduced;
}
class VideoBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){this.props.onFailure();}
 render(){return this.state.failed?null:this.props.children;}
}
function VideoScene({onComplete,enabled=true}:{onComplete:()=>void;enabled?:boolean}){
 const [player]=useState(playerForLaunch),[visible,setVisible]=useState(false);
 const firstFrame=useRef<()=>void>(()=>{});
 const laidOut=useRef(false),startWhenReady=useRef<()=>void>(()=>{}),allowed=useRef(enabled);
 allowed.current=enabled;
 useEffect(()=>{startWhenReady.current();},[enabled]);
 useEffect(()=>{
  let active=true,framed=false,prepared=false,started=false,loading:Promise<void>|undefined;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const unload=()=>{try{player.pause();void player.replaceAsync(null).catch(()=>{});}catch{}};
  const finish=()=>{if(!active)return;active=false;clearTimeout(timer);try{player.pause();}catch{}onComplete();};
  // These are failure limits only. Normal completion is exclusively playToEnd.
  timer=setTimeout(finish,8000);
  firstFrame.current=()=>{
   if(!active||framed)return;framed=true;setVisible(true);clearTimeout(timer);
   timer=setTimeout(finish,4500); // full 2.5s video plus decoder-stall allowance
   startWhenReady.current();
  };
  const subs:Array<{remove:()=>void}>=[];
  try{
   // Android can emit ENDED for the initial empty player before replaceAsync resolves.
   // Only our prepared, framed, started movie is allowed to complete startup.
   subs.push(player.addListener('playToEnd',()=>{if(started&&framed)finish();}));
   subs.push(player.addListener('statusChange',event=>{if(event.status==='error')finish();}));
   subs.push(AppState.addEventListener('change',state=>{if(state==='background')finish();else if(state==='active')startWhenReady.current();}));
   startWhenReady.current=()=>{
    if(!active||!prepared||!laidOut.current||!allowed.current||!framed||started)return;
    if(AppState.currentState!=='active')return;started=true;
    // Android's native splash blocks pre-draw and TextureView frames. Never
    // wait for a first-frame/image-load callback before releasing that gate.
    void hideNativeSplash().then(()=>{
     if(active&&AppState.currentState==='active')player.play();
     else if(active)started=false;
    }).catch(finish);
   };
   if(AppState.currentState==='background')finish();
   else{
    loading=player.replaceAsync(source);
    void loading.then(()=>{prepared=true;startWhenReady.current();}).catch(finish);
   }
  }catch{finish();}
  return()=>{
   active=false;clearTimeout(timer);firstFrame.current=()=>{};startWhenReady.current=()=>{};
   for(const sub of subs)try{sub.remove();}catch{}
   unload();void loading?.then(unload,unload);
  };
 },[player,onComplete]);
 return <View collapsable={false} style={StyleSheet.absoluteFill}><VideoView player={player} style={[StyleSheet.absoluteFill,{opacity:1}]} contentFit="contain" surfaceType="textureView"
  nativeControls={false} allowsPictureInPicture={false} fullscreenOptions={{enable:false}} useExoShutter={true}
  onLayout={()=>{laidOut.current=true;startWhenReady.current();}}
  onFirstFrameRender={()=>firstFrame.current()}/>
  {!visible?<Image source={require('../../assets/launch/approved-first-frame.png')} style={StyleSheet.absoluteFill} resizeMode="contain" resizeMethod="resize"/>:null}
 </View>;
}
/** Prepare immediately; retain one overlay while authorized navigation mounts underneath. */
export function ApprovedStartup({ready,children}:{ready:boolean;children:ReactNode}){
 const reduced=useMotionPreference();
 const [phase,setPhase]=useState<'playing'|'done'>(completed||claimed?'done':'playing');
 const [ended,setEnded]=useState(false),[laidOut,setLaidOut]=useState(false),[timedOut,setTimedOut]=useState(false);
 const [foreground,setForeground]=useState(AppState.currentState==='active');
 const [opacity]=useState(()=>new Animated.Value(1));
 const {width,height}=useWindowDimensions(),insets=useSafeAreaInsets();
 const frame=fitPortrait(width,height,insets),appReady=ready&&laidOut;
 const finish=useCallback(()=>{completed=true;setPhase('done');},[]);
 const videoEnded=useCallback(()=>setEnded(true),[]);
 const destinationLayout=useCallback(()=>setLaidOut(true),[]);
 useEffect(()=>{if(!ready)setLaidOut(false);},[ready]);
 useEffect(()=>{
  if(phase==='playing'){claimed=true;void hideNativeSplash();}
  return()=>{if(claimed)completed=true;};
 },[]);
 useEffect(()=>{
  const sub=AppState.addEventListener('change',state=>setForeground(state==='active'));
  return()=>sub.remove();
 },[]);
 // Bounded initialization failure uses the existing error/retry screen, never unsafe routes.
 useEffect(()=>{
  if(appReady||!foreground)return;
  const timer=setTimeout(()=>{completed=true;setTimedOut(true);},20000);
  return()=>clearTimeout(timer);
 },[appReady,foreground]);
 useEffect(()=>{
  if(phase==='done') {if(appReady)void hideNativeSplash();return;}
  if(!appReady){opacity.setValue(1);return;}
  if(!foreground||(!ended&&reduced!==true))return;
  if(reduced){finish();void hideNativeSplash();return;}
  const animation=Animated.timing(opacity,{toValue:0,duration:500,useNativeDriver:true});
  const timer=setTimeout(finish,1200); // recover if a native completion callback is lost
  animation.start(({finished})=>{if(finished){clearTimeout(timer);finish();}});
  return()=>{clearTimeout(timer);animation.stop();};
 },[phase,appReady,foreground,ended,reduced,opacity,finish]);
 if(timedOut)throw Error('TownLoop initialization did not finish. Please retry.');
 return <View collapsable={false} style={{flex:1,backgroundColor:background}}>
  <View key="destination" collapsable={false} style={{flex:1}}
   accessibilityElementsHidden={phase!=='done'} importantForAccessibility={phase==='done'?'auto':'no-hide-descendants'}>
   {ready?<View style={{flex:1}} onLayout={destinationLayout}>{children}</View>:null}
  </View>
  {phase!=='done'?<Animated.View key="launch-overlay" collapsable={false} style={[StyleSheet.absoluteFill,{backgroundColor:background,opacity,zIndex:1000}]}
   accessibilityLabel="Starting TownLoop" accessibilityRole="progressbar">
   <LinearGradient pointerEvents="none" colors={['#f1e4d3','#f0e6d7','#f2e8d9','#f0e6d7','#f1e4d3']} locations={[0,.25,.5,.75,1]}
    style={{position:'absolute',left:0,right:0,top:frame.top,height:frame.height}}/>
   <View collapsable={false} style={{position:'absolute',...frame}}>
    <Image source={require('../../assets/launch/approved-first-frame.png')} style={StyleSheet.absoluteFill} resizeMode="contain" resizeMethod="resize"/>
    {reduced!==true?<VideoBoundary onFailure={videoEnded}><VideoScene onComplete={videoEnded} enabled={reduced===false}/></VideoBoundary>:null}
   </View>
  </Animated.View>:null}
 </View>;
}
