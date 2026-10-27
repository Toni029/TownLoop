import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { AccessibilityInfo, ActivityIndicator, AppState, Image, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeIn, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors } from './ui';

// Same original opacity 0→1 / scale .97→1, now moving for the whole launch.
export const STARTUP_DURATION_MS = 3200;
const PREPARE_TIMEOUT_MS = 5000, COMPLETION_GRACE_MS = 2000;
let coldLaunchFinished = false, coldLaunchVisibleMs = 0;
try { void SplashScreen.preventAutoHideAsync().catch(() => undefined); } catch {}
async function hideSplash() { try { await SplashScreen.hideAsync(); } catch {} }

function OriginalBrandAnimation({reduced,onComplete}:{reduced:boolean;onComplete:()=>void}) {
  const [loaded,setLoaded]=useState(false),[laidOut,setLaidOut]=useState(false);
  const progress=useSharedValue(0);
  const motion=useAnimatedStyle(()=>({opacity:progress.value,transform:[{scale:0.97+0.03*progress.value}]}));
  useEffect(()=>{
    let disposed=false,starting=false,segmentAt:number|null=null,generation=0;
    let minimumDone=false,motionDone=false;
    let minimumTimer:ReturnType<typeof setTimeout>|undefined,recoveryTimer:ReturnType<typeof setTimeout>|undefined;
    let frame1:number|undefined,frame2:number|undefined;
    const active=()=>AppState.currentState!=='background'&&AppState.currentState!=='inactive';
    const finish=()=>{if(disposed)return;clearTimeout(minimumTimer);clearTimeout(recoveryTimer);onComplete();};
    const complete=()=>{if(active()&&minimumDone&&motionDone)finish();};
    const animationEnded=(token:number,success:boolean)=>{
      if(disposed||token!==generation||!active())return;
      if(!success){finish();return;}motionDone=true;complete();
    };
    const pause=()=>{
      ++generation;starting=false;
      if(segmentAt!==null)coldLaunchVisibleMs=Math.min(STARTUP_DURATION_MS,coldLaunchVisibleMs+Math.max(0,Date.now()-segmentAt));
      segmentAt=null;clearTimeout(minimumTimer);clearTimeout(recoveryTimer);
      if(frame1!==undefined)cancelAnimationFrame(frame1);if(frame2!==undefined)cancelAnimationFrame(frame2);
      cancelAnimation(progress);
    };
    const begin=()=>{
      if(disposed||coldLaunchFinished||!active()||starting||segmentAt!==null)return;
      clearTimeout(recoveryTimer);recoveryTimer=setTimeout(finish,PREPARE_TIMEOUT_MS);
      if(!loaded||!laidOut)return;
      starting=true;const token=++generation;
      // Decode + layout + splash dismissal precede the first visible animation frame.
      void hideSplash().then(()=>{
        if(disposed||token!==generation||!active())return;
        frame1=requestAnimationFrame(()=>{frame2=requestAnimationFrame(()=>{
          if(disposed||token!==generation||!active())return;
          starting=false;segmentAt=Date.now();
          const remaining=Math.max(0,STARTUP_DURATION_MS-coldLaunchVisibleMs);
          minimumDone=remaining===0;motionDone=reduced;
          clearTimeout(recoveryTimer);recoveryTimer=setTimeout(finish,remaining+COMPLETION_GRACE_MS);
          progress.value=reduced?1:coldLaunchVisibleMs/STARTUP_DURATION_MS;
          if(!reduced)progress.value=withTiming(1,{duration:remaining,easing:Easing.inOut(Easing.quad),reduceMotion:ReduceMotion.System},done=>{
            'worklet';runOnJS(animationEnded)(token,!!done);
          });
          minimumTimer=setTimeout(()=>{minimumDone=true;complete();},remaining);
          complete();
        });});
      });
    };
    const subscription=AppState.addEventListener('change',state=>{if(state==='background'||state==='inactive')pause();else begin();});
    begin();
    return()=>{disposed=true;pause();subscription.remove();};
  },[loaded,laidOut,reduced,onComplete,progress]);
  return <Animated.View entering={reduced ? undefined : FadeIn.duration(220)} style={styles.page} onLayout={()=>setLaidOut(true)}
    accessibilityLabel="Loading TownLoop" accessibilityRole="progressbar" accessibilityState={{ busy: true }}>
    <Animated.View style={[styles.content,motion]}>
      <Image source={require('../../assets/townloop-brand.png')} resizeMode="contain" style={styles.brand} accessible={false}
        onLoad={()=>setLoaded(true)} onError={onComplete} />
      <View style={styles.indicator}><ActivityIndicator color={colors.green} size="small" /></View>
    </Animated.View>
  </Animated.View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', gap: 24 },
  brand: { width: 200, height: 100 },
  indicator: { height: 24, justifyContent: 'center' },
});

class LaunchBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.onFailure();}
  render(){return this.state.failed?null:this.props.children;}
}
export function StartupLoading({ready,children}:{ready:boolean;children:ReactNode}) {
  const [animationFinished,setAnimationFinished]=useState(coldLaunchFinished);
  const brandedLaunch=useRef(!coldLaunchFinished).current;
  const [reduced,setReduced]=useState<boolean|null>(null);
  useEffect(()=>{
    if(coldLaunchFinished)return;
    let active=true;
    const timeout=setTimeout(()=>{if(active)setReduced(true);},1000);
    const change=(value:boolean)=>{if(active){clearTimeout(timeout);setReduced(value);}};
    const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',change);
    void Promise.resolve().then(()=>AccessibilityInfo.isReduceMotionEnabled()).then(change,()=>change(true));
    return()=>{active=false;clearTimeout(timeout);listener.remove();};
  },[]);
  useEffect(()=>{const timer=setTimeout(()=>{void hideSplash();},1200);return()=>clearTimeout(timer);},[]);
  const finish=useCallback(()=>{coldLaunchFinished=true;setAnimationFinished(true);void hideSplash();},[]);
  const open=ready&&animationFinished;
  return <View style={{flex:1,backgroundColor:colors.cream}} onLayout={()=>{void hideSplash();}}>
    {open&&<View style={{flex:1}}>{children}</View>}
    {!open&&<View style={StyleSheet.absoluteFill}>
      <LaunchBoundary onFailure={finish}>{brandedLaunch&&reduced!==null
        ? <OriginalBrandAnimation reduced={reduced} onComplete={finish}/>
        : <View style={styles.page}><ActivityIndicator color={colors.green}/></View>}
      </LaunchBoundary>
    </View>}
  </View>;
}
