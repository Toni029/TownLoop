import {Component,useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {AccessibilityInfo,AppState,Platform,StyleSheet,View,useWindowDimensions} from 'react-native';
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
  const timer=setTimeout(()=>{if(!resolved)update(true);},1000);
  const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',update);
  void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(!resolved)update(value);}).catch(()=>{if(!resolved)update(true);});
  return()=>{alive=false;clearTimeout(timer);sub.remove();};
 },[]);
 return reduced;
}
class VideoBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){this.props.onFailure();}
 render(){return this.state.failed?null:this.props.children;}
}
function VideoScene({onComplete}:{onComplete:()=>void}){
 const [player]=useState(playerForLaunch),[visible,setVisible]=useState(false);
 const firstFrame=useRef<()=>void>(()=>{});
 const laidOut=useRef(false),startWhenReady=useRef<()=>void>(()=>{});
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
  };
  const subs:Array<{remove:()=>void}>=[];
  try{
   subs.push(player.addListener('playToEnd',finish));
   subs.push(player.addListener('statusChange',event=>{if(event.status==='error')finish();}));
   subs.push(AppState.addEventListener('change',state=>{if(state!=='active')finish();}));
   startWhenReady.current=()=>{
    if(!active||!prepared||!laidOut.current||started)return;started=true;
    void hideNativeSplash().then(()=>{
     if(active&&AppState.currentState==='active')player.play();else finish();
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
 return <VideoView player={player} style={[StyleSheet.absoluteFill,{opacity:visible?1:0}]} contentFit="contain" surfaceType="textureView"
  nativeControls={false} allowsPictureInPicture={false} fullscreenOptions={{enable:false}} useExoShutter={false}
  onLayout={()=>{laidOut.current=true;startWhenReady.current();}}
  onFirstFrameRender={()=>firstFrame.current()}/>;
}
/** Initialize concurrently, then play once; auth changes cannot shorten this playback. */
export function ApprovedStartup({ready,children}:{ready:boolean;children:ReactNode}){
 const reduced=useMotionPreference();
 const [phase,setPhase]=useState<'waiting'|'playing'|'done'>(completed?'done':'waiting');
 const {width,height}=useWindowDimensions(),insets=useSafeAreaInsets();
 const frame=fitPortrait(width,height,insets);
 const finish=useCallback(()=>{completed=true;setPhase('done');},[]);
 useEffect(()=>{
  if(phase==='done'||reduced===null)return;
  if(reduced){finish();return;}
  if(phase==='playing'||!ready)return;
  if(claimed){finish();return;}
  claimed=true;setPhase('playing');
 },[phase,ready,reduced,finish]);
 useEffect(()=>()=>{if(claimed)completed=true;},[]);
 if(phase==='done')return ready?children:null;
 if(phase==='waiting')return null;
 return <View style={{flex:1,backgroundColor:background}} accessibilityLabel="Starting TownLoop" accessibilityRole="progressbar">
  <LinearGradient pointerEvents="none" colors={['#f1e4d3','#f0e6d7','#f2e8d9','#f0e6d7','#f1e4d3']} locations={[0,.25,.5,.75,1]}
   style={{position:'absolute',left:0,right:0,top:frame.top,height:frame.height}}/>
  <View style={{position:'absolute',...frame}}>
   <VideoBoundary onFailure={finish}><VideoScene onComplete={finish}/></VideoBoundary>
  </View>
 </View>;
}
