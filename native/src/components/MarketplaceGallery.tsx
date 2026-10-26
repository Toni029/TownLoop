import { PrivateImage } from './PrivateImage';
import { authenticatedStoragePath } from '../../../src/services/storageReferences';
import { storage } from '../lib/firebase';
import { ref } from 'firebase/storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, ReduceMotion, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import type { MediaAttachment } from '../../../src/types';
import { SystemBars } from './SystemBars';

const clamp = (n: number, limit: number) => { 'worklet'; return Math.max(-limit, Math.min(limit, n)); };
const timing = {duration: 200, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System};

/** Shared authenticated photo gallery; retains the original Storage references. */
export function MarketplaceGallery({media, initialIndex = 0, title, onClose}: {
  media: MediaAttachment[]; initialIndex?: number; title: string; onClose: () => void;
}) {
  const {width, height} = useWindowDimensions();
  const [index, setIndex] = useState(Math.max(0, Math.min(initialIndex, media.length - 1)));
  const [controls, setControls] = useState(true);
  const [loaded, setLoaded] = useState(false), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const [ratio, setRatio] = useState(1);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closed = useRef(false), closing = useRef(false);
  const alpha = useSharedValue(0), entrance = useSharedValue(.96), chrome = useSharedValue(1);
  const dismissOffset = useSharedValue(0);
  const scale = useSharedValue(1), x = useSharedValue(0), y = useSharedValue(0);
  const startScale = useSharedValue(1), startX = useSharedValue(0), startY = useSharedValue(0), locked = useSharedValue(false);
  const photoWidth = Math.min(width, height * ratio), photoHeight = Math.min(height, width / ratio);
  const reveal = useCallback(() => {
    setControls(true); clearTimeout(timer.current);
    timer.current = setTimeout(() => setControls(false), 4500);
  }, []);
  useEffect(() => {
    if (controls) timer.current = setTimeout(() => setControls(false), 4500);
    return () => clearTimeout(timer.current);
  }, [controls, index]);
  useEffect(() => { chrome.set(withTiming(controls ? 1 : 0, timing)); }, [controls, chrome]);
  useEffect(() => {
    for (const next of [index - 1, index + 1]) if (media[next] && !authenticatedStoragePath(media[next].url, ref(storage).bucket)) void Image.prefetch(media[next].url).catch(() => {});
  }, [index, media]);
  const imageUri = media[index]?.url;
  useEffect(() => {
    let active = true;
    if (imageUri && !authenticatedStoragePath(imageUri, ref(storage).bucket)) Image.getSize(imageUri, (w, h) => {
      if (active && w > 0 && h > 0) setRatio(w / h);
    }, () => { /* The image's onError presents retry UI. */ });
    return () => { active = false; };
  }, [imageUri, retry]);
  const finishClose = () => { if (!closed.current) { closed.current = true; onClose(); } };
  function close(velocityY = 0) {
    if (closed.current || closing.current) return;
    closing.current = true;
    clearTimeout(timer.current);
    locked.set(true);
    [entrance, scale, x, y].forEach(cancelAnimation);
    const swiped = y.get() > 0;
    const distance = swiped ? Math.max(32, height - y.get() + 32) : 28;
    const duration = swiped && velocityY > 0 ? Math.max(180, Math.min(280, distance / velocityY * 1000)) : 240;
    const exitTiming = {duration, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System};
    // Preserve the current zoom/drag position. Fade the entire gallery, never shrink the photo.
    dismissOffset.set(withTiming(distance, exitTiming));
    alpha.set(withTiming(0, exitTiming, done => { "worklet"; if (done) runOnJS(finishClose)(); }));
  }
  useEffect(() => {
    closed.current = false;
    closing.current = false;
    return () => {
      closed.current = true;
      clearTimeout(timer.current);
      [alpha, entrance, chrome, dismissOffset, scale, x, y].forEach(cancelAnimation);
    };
  }, [alpha, entrance, chrome, dismissOffset, scale, x, y]);
  function change(next: number) {
    if (closing.current || closed.current) return;
    setLoaded(false); setError(false); setRatio(1); setIndex(next); reveal();
    scale.set(1); x.set(0); y.set(0); locked.set(false);
    entrance.set(.97); entrance.set(withTiming(1, timing));
  }
  const pinch = Gesture.Pinch().onStart(() => { startScale.set(scale.get()); })
    .onUpdate(e => {
      if (locked.get()) return;
      scale.set(Math.max(1, Math.min(5, startScale.get() * e.scale)));
      x.set(clamp(x.get(), photoWidth * (scale.get() - 1) / 2));
      y.set(clamp(y.get(), photoHeight * (scale.get() - 1) / 2));
    });
  const pan = Gesture.Pan().minDistance(10).maxPointers(1)
    .onStart(() => { startX.set(x.get()); startY.set(y.get()); })
    .onUpdate(e => {
      if (locked.get()) return;
      if (scale.get() > 1.01) {
        x.set(clamp(startX.get() + e.translationX, photoWidth * (scale.get() - 1) / 2));
        y.set(clamp(startY.get() + e.translationY, photoHeight * (scale.get() - 1) / 2));
      } else if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        x.set(e.translationX * ((e.translationX > 0 && index === 0) || (e.translationX < 0 && index === media.length - 1) ? .2 : 1));
      } else { y.set(Math.max(0, e.translationY)); }
    })
    // Callback runs on the UI thread; refs are only accessed by runOnJS handlers.
    // eslint-disable-next-line react-hooks/refs
    .onEnd(e => {
      if (locked.get() || scale.get() > 1.01) return;
      if (y.get() > 120 || (y.get() > 35 && e.velocityY > 900)) { locked.set(true); runOnJS(close)(e.velocityY); return; }
      const next = index + (e.translationX < 0 ? 1 : -1);
      if (Math.abs(e.translationX) > Math.max(45, width * .18) && Math.abs(e.translationX) > Math.abs(e.translationY) && next >= 0 && next < media.length) {
        locked.set(true);
        x.set(withTiming(e.translationX < 0 ? -width : width, timing, done => { "worklet"; if (done) runOnJS(change)(next); }));
      } else { x.set(withTiming(0, timing)); y.set(withTiming(0, timing)); }
    }).onFinalize((_e, success) => { if (!success && scale.get() <= 1.01 && !locked.get()) {x.set(withTiming(0, timing)); y.set(withTiming(0, timing));} });
  const double = Gesture.Tap().numberOfTaps(2).onEnd((_e, success) => {
    if (!success || locked.get()) return;
    scale.set(withTiming(scale.get() > 1.01 ? 1 : 2.5, timing)); x.set(withTiming(0, timing)); y.set(withTiming(0, timing));
  });
  const tap = Gesture.Tap().onEnd((_e, success) => { if (success && !locked.get()) runOnJS(setControls)(!controls); });
  const stageStyle = useAnimatedStyle(() => ({opacity: alpha.value}));
  const background = useAnimatedStyle(() => ({opacity: Math.max(.35, 1 - Math.max(0, y.value) / height)}));
  const imageStyle = useAnimatedStyle(() => ({transform:[{translateX:x.value},{translateY:y.value + dismissOffset.value},{scale:scale.value * entrance.value}]}));
  const chromeStyle = useAnimatedStyle(() => ({opacity:chrome.value}));
  return <Modal transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => close()} onShow={() => {if (!closing.current) {alpha.set(withTiming(1, timing)); entrance.set(withTiming(1, timing));}}}>
    <SystemBars dark statusStyle="light" />
    <GestureHandlerRootView style={{flex:1}}>
      <Animated.View style={[{flex:1}, stageStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, {backgroundColor:'#080b10'}, background]} />
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(double, tap))}>
        <Animated.View style={[{flex:1}, imageStyle]}>
          <PrivateImage key={`${index}-${retry}`} source={{uri:media[index]?.url}} resizeMode="contain" accessibilityLabel={media[index]?.name || title}
            style={{width:'100%',height:'100%'}} onLoad={event => { const image = event.nativeEvent?.source; if(image?.width && image?.height) setRatio(image.width/image.height); setLoaded(true); }}
            onError={() => {setError(true); setLoaded(true);}} />
        </Animated.View>
      </GestureDetector>
      {!loaded && <View pointerEvents="none" style={[StyleSheet.absoluteFill,{justifyContent:'center',alignItems:'center'}]}><ActivityIndicator color="#fff" accessibilityLabel="Loading photo" /></View>}
      {error && <View style={[StyleSheet.absoluteFill,{justifyContent:'center',alignItems:'center',gap:16}]} pointerEvents="box-none">
        <Text style={styles.text}>Unable to load this photo.</Text><Pressable accessibilityRole="button" onPress={() => {setError(false);setLoaded(false);setRetry(n=>n+1);}} style={styles.button}><Text style={styles.text}>Retry</Text></Pressable>
      </View>}
      <SafeAreaView pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <Animated.View pointerEvents={controls ? 'box-none' : 'none'} style={[{flex:1,padding:16,justifyContent:'space-between'},chromeStyle]}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
            <Text style={[styles.text,{backgroundColor:'#151b25bb',paddingHorizontal:12,paddingVertical:8,borderRadius:20}]}>{media.length > 1 ? `${index+1} / ${media.length}` : 'Photo'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close photo gallery" onPress={() => close()} style={styles.button}><X size={23} color="#fff" /></Pressable>
          </View>
          {media.length > 1 && <View style={{flexDirection:'row',justifyContent:'space-between'}}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous photo" disabled={index===0} onPress={()=>change(index-1)} style={[styles.button,{opacity:index===0?.3:1}]}><ChevronLeft color="#fff" size={22}/></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Next photo" disabled={index===media.length-1} onPress={()=>change(index+1)} style={[styles.button,{opacity:index===media.length-1?.3:1}]}><ChevronRight color="#fff" size={22}/></Pressable>
          </View>}
        </Animated.View>
      </SafeAreaView>
      </Animated.View>
    </GestureHandlerRootView>
  </Modal>;
}
const styles=StyleSheet.create({text:{fontFamily:'JakartaMedium',color:'#fff',fontSize:13},button:{minWidth:44,minHeight:44,borderRadius:24,padding:10,backgroundColor:'#151b25bb',alignItems:'center',justifyContent:'center'}});
