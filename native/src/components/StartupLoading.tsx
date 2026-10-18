import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '../home/hooks';
import { colors } from './ui';

const enterBrand = () => {
  'worklet';
  return { initialValues: { opacity: 0, transform: [{ scale: 0.97 }] },
    animations: { opacity: withTiming(1, { duration: 260 }), transform: [{ scale: withTiming(1, { duration: 260 }) }] } };
};

/** One font-independent loading view for fonts, session, and community initialization. */
export function StartupLoading() {
  const reduced = useReducedMotion();
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
