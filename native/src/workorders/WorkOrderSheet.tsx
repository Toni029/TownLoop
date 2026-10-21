import { useEffect, useEffectEvent, useRef, useState, type ReactNode, type PropsWithChildren } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Maximize2, Minimize2, X } from 'lucide-react-native';
import { ScrollView } from '../keyboard/KeyboardScrollView';
import { usePresentation } from '../shell/TownLoopShell';
import { useReducedMotion } from '../home/hooks';
import { SystemBars } from '../components/SystemBars';
import { Copy, s } from '../news/ui';
import { sheetStops, sheetDestination } from './sheetGeometry';

/** Work Orders only. One UI-thread position drives both movement and visible scroll bounds. */
export function WorkOrderSheet({ title, subtitle, children, footer, busy = false, dismissRequested = false, onClose }: PropsWithChildren<{
  title: string; subtitle?: string; footer?: ReactNode; busy?: boolean; dismissRequested?: boolean; onClose: () => void;
}>) {
  const presentation = usePresentation(), dark = !!presentation?.dark;
  const { height, width } = useWindowDimensions(), insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [viewport, setViewport] = useState(0), [shown, setShown] = useState(false);
  const [full, setFull] = useState(false), [keyboard, setKeyboard] = useState(false);
  const largestViewport = useRef(height);
  const closing = useRef(false), opened = useRef(false), requestedFull = useRef(false);
  const position = useSharedValue(height + 24), start = useSharedValue(height), shade = useSharedValue(0);
  const phase = useSharedValue(0); // 0 opening/idle, 1 ready, 2 closing
  const stops = sheetStops(viewport || height, insets.top);
  const timing = { duration: reduced ? 0 : 240, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    if (!shown || !viewport || closing.current) return;
    const target = full || keyboard ? stops.full : stops.half;
    if (!opened.current) {
      opened.current = true;
      position.set(stops.hidden);
      position.set(withTiming(target, {duration: reduced ? 0 : 260, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System}, finished => { if (finished) phase.set(1); }));
      shade.set(withTiming(1, {duration: reduced ? 0 : 200}));
    } else {
      // Native viewport resize (keyboard/rotation) supplies its own geometry; no competing height spring.
      position.set(target);
      phase.set(1);
    }
  }, [shown, viewport, stops.full, stops.half, stops.hidden, full, keyboard, reduced, position, shade, phase]);
  useEffect(() => () => { cancelAnimation(position); cancelAnimation(shade); }, [position, shade]);
  function close() {
    if (busy || closing.current) return;
    closing.current = true;
    phase.set(2);
    Keyboard.dismiss();
    shade.set(withTiming(0, {duration: reduced ? 0 : 180}));
    position.set(withTiming(Math.max(largestViewport.current, height, viewport) + 24, { ...timing, duration: reduced ? 0 : 210 }, finished => { if (finished) runOnJS(onClose)(); }));
  }
  const closeFromEffect = useEffectEvent(close);
  useEffect(() => { if (dismissRequested && !busy) closeFromEffect(); }, [dismissRequested, busy]);
  function finishSnap(nextFull: boolean) {
    requestedFull.current = nextFull;
    setFull(nextFull);
  }
  function snap(nextFull: boolean) {
    if (busy || closing.current) return;
    requestedFull.current = nextFull;
    position.set(withTiming(nextFull ? stops.full : stops.half, timing, finished => {
      if (finished) runOnJS(finishSnap)(nextFull);
    }));
  }
  const pan = Gesture.Pan().enabled(!busy && !keyboard).activeOffsetY([-10, 10]).failOffsetX([-24, 24])
    .onStart(() => { if (phase.get() !== 1) return; cancelAnimation(position); start.set(position.get()); })
    .onUpdate(event => { if (phase.get() === 1) position.set(Math.max(stops.full, Math.min(stops.hidden, start.get() + event.translationY))); })
    // Gesture callbacks execute on the UI thread; refs are read only by scheduled JS handlers.
    // eslint-disable-next-line react-hooks/refs
    .onEnd(event => {
      if (phase.get() !== 1) return;
      const destination = sheetDestination(position.get(), event.velocityY, stops.full, stops.half);
      if (destination === 'close') runOnJS(close)();
      else runOnJS(snap)(destination === 'full');
    })
    // eslint-disable-next-line react-hooks/refs
    .onFinalize((_event, success) => { if (!success && phase.get() === 1) runOnJS(snap)(full); });
  const card = useAnimatedStyle(() => ({
    transform: [{ translateY: position.value }],
    height: Math.max(1, (viewport || height) - position.value),
    borderTopLeftRadius: position.value <= stops.full + 1 ? 0 : 32,
    borderTopRightRadius: position.value <= stops.full + 1 ? 0 : 32,
  }));
  const backdrop = useAnimatedStyle(() => ({opacity: shade.value}));
  return <Modal transparent animationType="none" statusBarTranslucent navigationBarTranslucent onShow={() => setShown(true)} onRequestClose={close}>
    <SystemBars dark statusStyle="light" />
    <GestureHandlerRootView style={{flex:1}}>
      <Animated.View style={[StyleSheet.absoluteFill, backdrop]}>
        {!!presentation?.blurTarget && <BlurView blurTarget={presentation.blurTarget} blurMethod="dimezisBlurViewSdk31Plus" intensity={40} tint={dark ? 'dark' : 'default'} style={StyleSheet.absoluteFill} />}
        <View style={[StyleSheet.absoluteFill,{backgroundColor:'#0c0a09a6'}]} />
      </Animated.View>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{flex:1,overflow:'hidden'}} onLayout={event => { const next = event.nativeEvent.layout.height; if (next > 0) { largestViewport.current = Math.max(largestViewport.current, next); setViewport(next); } }}>
          <Animated.View style={[{position:'absolute',top:0,width:'100%',maxWidth:width >= 640 && !full ? 512 : undefined,alignSelf:'center',backgroundColor:dark ? '#0f172a':'#fff',overflow:'hidden'},card]}>
            <SafeAreaView edges={['left','right','bottom']} style={{flex:1}}>
              <GestureDetector gesture={pan}><View>
                <View style={{alignItems:'center',paddingTop:12,paddingBottom:10}}><View style={{width:full ? 64:48,height:6,borderRadius:3,backgroundColor:full ? '#059669':dark ? '#334155':'#d6d3d1'}} /></View>
                <View style={[s.row,{padding:20,paddingBottom:12,borderBottomWidth:1,borderColor:dark?'#1e293b':'#e7e5e4',flexWrap:'nowrap',gap:6}]}>
                  <View style={{flex:1}}><Copy accessibilityRole="header" weight="bold" style={{fontFamily:'NewsBold',fontSize:16,lineHeight:24}}>{title}</Copy>
                    {!!subtitle && <Copy style={{color:'#78716c',lineHeight:16,marginTop:2}}>{subtitle}</Copy>}</View>
                  <Pressable accessibilityRole="button" accessibilityLabel={full ? 'Exit full screen':'Expand to full screen'} disabled={busy || keyboard} onPress={() => snap(!requestedFull.current)} hitSlop={8} style={{width:32,height:32,alignItems:'center',justifyContent:'center',borderRadius:16,backgroundColor:dark?'#1e293b':'#f5f5f4'}}>{full ? <Minimize2 size={16} color="#78716c"/>:<Maximize2 size={16} color="#78716c"/>}</Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={busy} onPress={close} hitSlop={8} style={{width:32,height:32,alignItems:'center',justifyContent:'center',borderRadius:16,backgroundColor:dark?'#1e293b':'#f5f5f4'}}><X size={16} color="#78716c"/></Pressable>
                </View>
              </View></GestureDetector>
              <ScrollView style={{flex:1}} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" extraKeyboardSpace contentContainerStyle={{padding:20,paddingTop:6,gap:12}}>{children}</ScrollView>
              {!!footer && <View style={{paddingHorizontal:20,paddingTop:10,paddingBottom:16,gap:10}}>{footer}</View>}
            </SafeAreaView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  </Modal>;
}
