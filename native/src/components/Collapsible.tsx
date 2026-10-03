import { useEffect, useState, type PropsWithChildren } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useReducedMotion } from '../home/hooks';
/** One measured height transition: no second layout animation on the parent. */
export function Collapsible({open, children}: PropsWithChildren<{open:boolean}>) {
  const [height,setHeight] = useState(0);
  const [present,setPresent] = useState(open);
  if (open && !present) setPresent(true);
  const [size] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  useEffect(() => {
    const motion = Animated.parallel([
      Animated.timing(size,{toValue:open ? height : 0,duration:reduced ? 0 : 280,easing:Easing.bezier(0.22,1,0.36,1),useNativeDriver:false}),
      Animated.timing(opacity,{toValue:open ? 1 : 0,duration:reduced ? 0 : 200,useNativeDriver:true}),
    ]);
    motion.start(({finished}) => { if (finished && !open) {setPresent(false);setHeight(0);} }); return () => motion.stop();
  },[size,opacity,open,height,reduced]);
  return <Animated.View style={{height:size,overflow:'hidden'}} pointerEvents={open ? 'auto' : 'none'} accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}>
    {present && <Animated.View style={{position:'absolute',top:0,left:0,right:0,opacity}}><View onLayout={e => setHeight(e.nativeEvent.layout.height)} style={{paddingTop:14,gap:14}}>{children}</View></Animated.View>}
  </Animated.View>;
}
