import { Component, useEffect, useState, type ReactNode } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { AccessibilityInfo, ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, withTiming } from 'react-native-reanimated';
import { colors } from './ui';

const enterBrand = () => {
  'worklet';
  return { initialValues: { opacity: 0, transform: [{ scale: 0.97 }] },
    animations: { opacity: withTiming(1, { duration: 260 }), transform: [{ scale: withTiming(1, { duration: 260 }) }] } };
};

/** One font-independent loading view for fonts, session, and community initialization. */
function OriginalBrandAnimation({reduced}:{reduced:boolean}) {
  return <Animated.View entering={reduced ? undefined : FadeIn.duration(220)} style={styles.page}
    accessibilityLabel="Loading TownLoop" accessibilityRole="progressbar" accessibilityState={{ busy: true }}>
    <Animated.View entering={reduced ? undefined : enterBrand} style={styles.content}>
      <Image source={require('../../assets/townloop-brand.png')} resizeMode="contain" style={styles.brand} accessible={false} />
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

// The original native animation is the only branded launch surface. It never
// creates a media player, audio session or decoder. Normal video remains unchanged.
let coldLaunchFinished = false;
let coldLaunchClaimed = false;
try { void SplashScreen.preventAutoHideAsync().catch(() => undefined); } catch {}
function hideSplash() { try { void SplashScreen.hideAsync().catch(() => undefined); } catch {} }
class LaunchBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.onFailure();}
  render(){return this.state.failed?null:this.props.children;}
}
export function StartupLoading({ready,children}:{ready:boolean;children:ReactNode}) {
  const [animationFinished,setAnimationFinished]=useState(coldLaunchFinished||coldLaunchClaimed);
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
  useEffect(()=>{
    if(reduced===null)return;
    if(coldLaunchFinished||coldLaunchClaimed){setAnimationFinished(true);return;}
    coldLaunchClaimed=true;
    // Native entry takes 260ms. Initialization runs concurrently, never waiting
    // on an animation callback, media promise or accessibility lookup.
    const timer=setTimeout(()=>{coldLaunchFinished=true;setAnimationFinished(true);},reduced?0:300);
    return()=>{clearTimeout(timer);coldLaunchFinished=true;};
  },[reduced]);
  useEffect(()=>{const timer=setTimeout(hideSplash,1200);return()=>clearTimeout(timer);},[]);
  const finish=()=>{coldLaunchFinished=true;setAnimationFinished(true);hideSplash();};
  return <View style={{flex:1,backgroundColor:colors.cream}} onLayout={hideSplash}>
    {ready&&<View style={{flex:1}}>{children}</View>}
    {!animationFinished&&<View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LaunchBoundary onFailure={finish}>{reduced!==null&&<OriginalBrandAnimation reduced={reduced}/>}</LaunchBoundary>
    </View>}
  </View>;
}
