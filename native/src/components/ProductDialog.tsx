import { useEffect, useState, type PropsWithChildren } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Maximize2, Minimize2, X } from 'lucide-react-native';
import { Copy, s } from '../news/ui';
import { useReducedMotion } from '../home/hooks';
export function ProductDialog({ title, subtitle, children, busy = false, onClose, initiallyFull = false }: PropsWithChildren<{
  title: string; subtitle?: string; busy?: boolean; onClose: () => void; initiallyFull?: boolean;
}>) {
  const [full, setFull] = useState(initiallyFull);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const target = full ? height - insets.top - insets.bottom - 12 : Math.min(660, height * 0.72);
  const [size] = useState(() => new Animated.Value(target));
  const [open] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(0));
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const motion = Animated.parallel([
      Animated.timing(open, { toValue: 1, duration: reduced ? 0 : 430, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, delay: reduced ? 0 : 185, duration: reduced ? 0 : 570, useNativeDriver: true }),
    ]);
    motion.start(); return () => motion.stop();
  }, [open, fade, reduced]);
  useEffect(() => {
    const motion = Animated.timing(size, { toValue: target, duration: reduced ? 0 : 430, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: false });
    motion.start(); return () => motion.stop();
  }, [size, target, reduced]);
  const close = () => {
    if (busy || closing) return;
    setClosing(true);
    Animated.timing(open, { toValue: 0, duration: reduced ? 0 : 200, useNativeDriver: true }).start(({finished}) => { if (finished) onClose(); });
  };
  return <Modal transparent animationType="none" onRequestClose={close}>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{flex:1, backgroundColor:'#0c0a09a6', justifyContent:'center', padding:full ? 6 : 12, paddingTop:Math.max(insets.top,12), paddingBottom:Math.max(insets.bottom,12)}}>
        <Animated.View style={{height:size, maxWidth:full ? undefined : 512, width:'100%', alignSelf:'center'}}>
          <Animated.View style={{flex:1, backgroundColor:'#fff', borderRadius:full ? 18 : 24, overflow:'hidden', opacity:open, transform:[{translateY:open.interpolate({inputRange:[0,1],outputRange:[24,0]})},{scale:open.interpolate({inputRange:[0,1],outputRange:[0.88,1]})}]}}>
            <SafeAreaView edges={['left','right']} style={{flex:1}}>
              <View style={[s.row,{padding:18,borderBottomWidth:1,borderColor:'#e7e5e4',flexWrap:'nowrap'}]}>
                <View style={{flex:1}}><Copy weight="bold" style={{fontSize:18,lineHeight:25}}>{title}</Copy>{subtitle && <Copy style={{color:'#78716c'}}>{subtitle}</Copy>}</View>
                <Pressable accessibilityRole="button" accessibilityLabel={full ? 'Exit full screen' : 'Expand to full screen'} disabled={busy} onPress={() => setFull(v => !v)} style={{padding:10,borderRadius:22,backgroundColor:'#f5f5f4'}}>{full ? <Minimize2 size={18} color="#78716c"/> : <Maximize2 size={18} color="#78716c"/>}</Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={busy} onPress={close} style={{padding:10,borderRadius:22,backgroundColor:'#f5f5f4'}}><X size={18} color="#78716c"/></Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20}}><Animated.View style={{opacity:fade,gap:16}}>{children}</Animated.View></ScrollView>
            </SafeAreaView>
          </Animated.View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
