import { memo, useEffect, useId, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, FadeIn, FadeOut, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from './hooks';
import type { HourlyForecast } from './weatherModel';
import { atmosphereFor } from './weatherAtmosphereModel';

type Scene = ReturnType<typeof atmosphereFor>;
// Static SVG geometry is composited with UI-thread transforms. No JS frame loop,
// per-droplet views, video, image downloads, blur filters or additional requests.
function useCycle(active: boolean, duration: number) {
  const phase = useSharedValue(0);
  useEffect(() => {
    if (active) phase.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    else { cancelAnimation(phase); phase.value = 0; }
    return () => cancelAnimation(phase);
  }, [active, duration, phase]);
  return phase;
}
export const WeatherAtmosphere = memo(function WeatherAtmosphere({ hour }: { hour: HourlyForecast }) {
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);
  const scene = atmosphereFor(hour);
  const [size, setSize] = useState({ width: 360, height: 440 });
  const active = focused && foreground && !reduced;
  const key = `${scene.condition}:${scene.drizzle}:${scene.heavy}:${scene.windy}:${scene.particles}`;
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    onLayout={e => { const { width, height } = e.nativeEvent.layout; setSize(old => old.width === width && old.height === height ? old : { width, height }); }}
    style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
    <Animated.View key={key} entering={reduced ? undefined : FadeIn.duration(650)} exiting={reduced ? undefined : FadeOut.duration(450)} style={StyleSheet.absoluteFill}>
      <SceneLayer scene={scene} active={active} width={size.width} height={size.height} />
    </Animated.View>
    {/* Stable text scrim: atmosphere never washes out the temperature or controls. */}
    <LinearGradient colors={['#0615264d', '#0717281a', '#06182d70']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
  </View>;
});
function SceneLayer({ scene, active, width, height }: { scene: Scene; active: boolean; width: number; height: number }) {
  const phase = useCycle(active, scene.windy ? 13000 : 24000);
  const glow = useAnimatedStyle(() => ({ opacity: 0.72 + Math.sin(phase.value * Math.PI * 2) * 0.12, transform: [{ scale: 1 + Math.sin(phase.value * Math.PI * 2) * 0.035 }] }));
  const clouds = useAnimatedStyle(() => ({ transform: [{ translateX: Math.sin(phase.value * Math.PI * 2) * (scene.windy ? 36 : 18) }] }));
  const mist = useAnimatedStyle(() => ({ opacity: 0.65 + Math.sin(phase.value * Math.PI * 2) * 0.12, transform: [{ translateX: -Math.sin(phase.value * Math.PI * 2) * 26 }, { translateY: Math.cos(phase.value * Math.PI * 2) * 5 }] }));
  // One gentle, localized cloud illumination per 24 seconds; no strobe/full-screen flash.
  const flash = useAnimatedStyle(() => ({ opacity: active && scene.storm ? interpolate(phase.value, [0, 0.74, 0.75, 0.77, 0.80, 1], [0, 0, 0.24, 0.10, 0, 0]) : 0 }));
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const sunny = scene.condition === 'sun' || scene.condition === 'cloudSun';
  return <>
    <LinearGradient colors={scene.colors} style={StyleSheet.absoluteFill} />
    {sunny && <Animated.View style={[StyleSheet.absoluteFill, glow]}>
      <Svg width="100%" height="100%" viewBox="0 0 400 440" preserveAspectRatio="xMidYMin slice">
        <Defs><RadialGradient id={`${id}sun`} cx="73%" cy="8%" r="80%">
          <Stop offset="0" stopColor="#fffdf1" stopOpacity={0.95} /><Stop offset="0.12" stopColor="#fff2bf" stopOpacity={0.7} /><Stop offset="0.4" stopColor="#ffe6a1" stopOpacity={0.22} /><Stop offset="1" stopColor="#e9f4ff" stopOpacity={0} />
        </RadialGradient></Defs>
        <Ellipse cx={280} cy={60} rx={340} ry={350} fill={`url(#${id}sun)`} />
        <Path d="M290 -40 L20 350 L205 170 Z M300 -40 L285 340 L340 180 Z" fill="#fff4cf" opacity={0.045} />
      </Svg>
    </Animated.View>}
    {scene.condition !== 'sun' && <Animated.View style={[styles.clouds, clouds]}><CloudBank id={`${id}cloud`} storm={scene.storm || scene.heavy} partly={scene.condition === 'cloudSun'} /></Animated.View>}
    {(scene.condition === 'fog' || scene.wet || scene.snow || scene.windy) && <Animated.View style={[styles.haze, mist]}>
      <Svg width="100%" height="100%" viewBox="0 0 500 400" preserveAspectRatio="none">
        <Defs><RadialGradient id={`${id}mist`}><Stop offset="0" stopColor="#dceaf1" stopOpacity={scene.condition === 'fog' ? 0.38 : 0.13} /><Stop offset="0.5" stopColor="#cedfe9" stopOpacity={scene.condition === 'fog' ? 0.18 : 0.05} /><Stop offset="1" stopColor="#c3d9e7" stopOpacity={0} /></RadialGradient></Defs>
        {[0, 1, 2].map(i => <Ellipse key={i} cx={i % 2 ? 360 : 110} cy={110 + i * 105} rx={340} ry={65 + i * 15} fill={`url(#${id}mist)`} />)}
      </Svg>
    </Animated.View>}
    {scene.particles > 0 && <><Precipitation scene={scene} active={active} width={width} height={height} far /><Precipitation scene={scene} active={active} width={width} height={height} /></>}
    {scene.storm && <Animated.View style={[StyleSheet.absoluteFill, flash]}>
      <Svg width="100%" height="100%" viewBox="0 0 400 440"><Defs><RadialGradient id={`${id}flash`}><Stop offset="0" stopColor="#dce8ff" /><Stop offset="1" stopColor="#a3c3ff" stopOpacity={0} /></RadialGradient></Defs><Ellipse cx={310} cy={40} rx={180} ry={150} fill={`url(#${id}flash)`} /><Path d="M310 0 L295 30 L306 32 L278 66 M296 30 L274 35 L265 46" fill="none" stroke="#ecf2ff" strokeWidth={1.2} opacity={0.55} /></Svg>
    </Animated.View>}
  </>;
}
function CloudBank({ id, storm, partly }: { id: string; storm: boolean; partly: boolean }) {
  return <Svg width="100%" height="100%" viewBox="0 0 500 260" preserveAspectRatio="none">
    <Defs>
      <RadialGradient id={`${id}body`} cx="50%" cy="32%" r="65%"><Stop offset="0" stopColor={storm ? '#6d7c90' : '#f3f6f5'} stopOpacity={partly ? 0.68 : 0.46} /><Stop offset="0.48" stopColor={storm ? '#42556d' : '#cbd9e0'} stopOpacity={0.3} /><Stop offset="1" stopColor="#9eb6c8" stopOpacity={0} /></RadialGradient>
      <RadialGradient id={`${id}shade`}><Stop offset="0" stopColor="#0c203a" stopOpacity={storm ? 0.65 : 0.23} /><Stop offset="1" stopColor="#162c47" stopOpacity={0} /></RadialGradient>
    </Defs>
    {[0, 1, 2, 3, 4, 5, 6].map(i => <Ellipse key={i} cx={partly ? 170 + i * 58 : i * 88 - 20} cy={30 + (i * 37) % 75} rx={100 + (i % 3) * 18} ry={48 + (i % 3) * 12} fill={`url(#${id}body)`} />)}
    <Ellipse cx={100} cy={130} rx={210} ry={65} fill={`url(#${id}shade)`} /><Ellipse cx={420} cy={105} rx={200} ry={70} fill={`url(#${id}shade)`} />
  </Svg>;
}
function Precipitation({ scene, active, width, height, far = false }: { scene: Scene; active: boolean; width: number; height: number; far?: boolean }) {
  const phase = useCycle(active, scene.snow ? (far ? 15000 : 10000) : scene.drizzle ? (far ? 2300 : 1700) : far ? 1300 : 850);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: phase.value * height }, { translateX: scene.snow ? Math.sin(phase.value * Math.PI * 2) * (scene.windy ? 16 : 5) : 0 }] }));
  const count = far ? Math.ceil(scene.particles * 0.6) : scene.particles;
  return <Animated.View style={[{ position: 'absolute', top: -height, left: -35, width: width + 70, height: height * 2, opacity: far ? 0.18 : scene.snow ? 0.55 : 0.28 }, style]}>
    <Svg width="100%" height="100%" viewBox={`0 0 ${width + 70} ${height * 2}`}>
      {[0, 1].flatMap(copy => Array.from({ length: count }, (_, i) => {
        const x = ((i * 137.508 + (far ? 47 : 0)) % (width + 70));
        const y = (i * 83.731 % height) + copy * height;
        const depth = 0.55 + (i % 5) / 6;
        return scene.snow ? <Circle key={`${copy}-${i}`} cx={x} cy={y} r={depth * (far ? 1.1 : 2.1)} fill="#f4faff" /> : <Path key={`${copy}-${i}`} d={`M${x} ${y} l${-Math.max(2, scene.wind / 3)} ${depth * (scene.drizzle ? 7 : scene.heavy ? 28 : 17)}`} stroke="#d4e9f5" strokeWidth={far || scene.drizzle ? 0.65 : 1} strokeLinecap="round" />;
      }))}
    </Svg>
  </Animated.View>;
}
const styles = StyleSheet.create({
  clouds: { position: 'absolute', left: -65, right: -65, top: -25, height: '72%' },
  haze: { position: 'absolute', left: -60, right: -60, top: 0, bottom: -30 },
});
