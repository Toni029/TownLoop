import { memo, useEffect, useId, useState } from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, FadeIn, FadeOut, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from './hooks';
import type { HourlyForecast } from './weatherModel';
import { atmosphereFor } from './weatherAtmosphereModel';

type Scene = ReturnType<typeof atmosphereFor>;
// Bundled photographic cloud textures and fixed particle meshes are composited
// on the UI thread. No JS frame loop, video, blur filters or remote image loading.
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
  </View>;
});
function SceneLayer({ scene, active, width, height }: { scene: Scene; active: boolean; width: number; height: number }) {
  const phase = useCycle(active, scene.windy ? 18000 : 36000);
  const lighting = useCycle(active, 23000);
  const skyMotion = useAnimatedStyle(() => ({ transform: [{ translateX: Math.sin(phase.value * Math.PI * 2) * 9 }, { scale: 1.09 + Math.cos(phase.value * Math.PI * 2) * 0.025 }] }));
  const nearClouds = useAnimatedStyle(() => ({
    opacity: active ? interpolate(phase.value, [0, 0.12, 0.8, 1], [0, 0.85, 0.85, 0]) : 0.7,
    transform: [{ translateX: (phase.value - 0.5) * width * 0.85 }, { translateY: Math.sin(phase.value * Math.PI * 2) * 6 }],
  }));
  const distantClouds = useAnimatedStyle(() => ({ transform: [{ translateX: -Math.sin(phase.value * Math.PI * 2) * width * 0.11 }, { scaleX: -1 }] }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.87 + Math.sin(lighting.value * Math.PI * 2) * 0.1, transform: [{ scale: 1 + Math.sin(lighting.value * Math.PI * 2) * 0.035 }] }));
  const haze = useAnimatedStyle(() => ({ transform: [{ translateX: Math.sin(phase.value * Math.PI * 2) * width * 0.14 }, { scaleX: 1.45 }, { scaleY: 0.7 }], opacity: 0.7 + Math.cos(phase.value * Math.PI * 2) * 0.12 }));
  // Two isolated strikes per 23 seconds, not rapid strobing. Separate the
  // filament's quick discharge from the softer, longer cloud illumination.
  const flash = useAnimatedStyle(() => ({ opacity: active && scene.storm ? interpolate(lighting.value,
    [0, 0.08, 0.087, 0.105, 0.135, 0.54, 0.547, 0.565, 0.60, 1],
    [0, 0, 0.24, 0.12, 0, 0, 0.20, 0.10, 0, 0]) : 0 }));
  const discharge = useAnimatedStyle(() => ({ opacity: active && scene.storm ? interpolate(lighting.value,
    [0, 0.08, 0.083, 0.088, 0.102, 0.54, 0.543, 0.55, 0.565, 1],
    [0, 0, 0.92, 0.55, 0, 0, 0.78, 0.40, 0, 0]) : 0,
    transform: [{ scaleX: lighting.value < 0.4 ? 1 : -1 }],
  }));
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const sunny = scene.condition === 'sun' || scene.condition === 'cloudSun';
  const fog = scene.condition === 'fog';
  const dense = !sunny && scene.condition !== 'wind';
  return <>
    <LinearGradient colors={scene.colors} style={StyleSheet.absoluteFill} />
    {dense && <Animated.View style={[StyleSheet.absoluteFill, skyMotion, { opacity: fog ? 0.12 : scene.storm ? 0.40 : scene.wet ? 0.22 : 0.14 }]}>
      <Image source={require('../../assets/weather/storm-sky.jpg')} resizeMode="cover" fadeDuration={0} style={StyleSheet.absoluteFill} />
    </Animated.View>}
    {(fog || scene.snow || scene.condition === 'cloud' || scene.drizzle) && <LinearGradient colors={fog ? ['#9cabbc80', '#b3c2cb90', '#8298aa80'] : scene.snow ? ['#b9d7e94d', '#a4c6df66', '#668aa64d'] : ['#b2c3d833', '#8cabc03d', '#557a9840']} style={StyleSheet.absoluteFill} />}
    {sunny && <Animated.View style={[StyleSheet.absoluteFill, glow]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <RadialGradient id={`${id}air`}><Stop offset="0" stopColor="#fff4cb" stopOpacity={0.32} /><Stop offset="1" stopColor="#ffebbc" stopOpacity={0} /></RadialGradient>
          <RadialGradient id={`${id}lensRay`}><Stop offset="0" stopColor="#ffffff" stopOpacity={0.88} /><Stop offset="0.12" stopColor="#fff5d0" stopOpacity={0.48} /><Stop offset="0.48" stopColor="#ffe5ab" stopOpacity={0.16} /><Stop offset="1" stopColor="#ffe5ab" stopOpacity={0} /></RadialGradient>
          <RadialGradient id={`${id}lensGhost`}><Stop offset="0" stopColor="#b9f6ef" stopOpacity={0.03} /><Stop offset="0.65" stopColor="#b9f6ef" stopOpacity={0.05} /><Stop offset="0.86" stopColor="#d8fff3" stopOpacity={0.15} /><Stop offset="1" stopColor="#d8fff3" stopOpacity={0} /></RadialGradient>
        </Defs>
        {/* Optical diffraction streaks and faint lens reflections, beneath clouds and text. */}
        {[{ angle: -24, length: 0.82, thickness: 0.014 }, { angle: 36, length: 0.58, thickness: 0.008 }, { angle: 91, length: 0.36, thickness: 0.006 }].map(ray =>
          <Ellipse key={ray.angle} cx={width * 0.77} cy={height * 0.23}
            rx={width * ray.length} ry={width * ray.thickness}
            transform={`rotate(${ray.angle} ${width * 0.77} ${height * 0.23})`}
            fill={`url(#${id}lensRay)`} />)}
        {[{ x: 0.58, y: 0.40, r: 0.035 }, { x: 0.39, y: 0.57, r: 0.07 }, { x: 0.16, y: 0.78, r: 0.13 }].map(ghost =>
          <Circle key={ghost.x} cx={width * ghost.x} cy={height * ghost.y} r={width * ghost.r} fill={`url(#${id}lensGhost)`} />)}
        <Ellipse cx={width * 0.78} cy={height * 0.23} rx={width * 0.92} ry={height * 0.8} fill={`url(#${id}air)`} />
        {[0, 1, 2, 3, 4].map(i => <Path key={i} d={`M${width * 0.77} ${height * 0.23} L${width * (-0.4 + i * 0.35)} ${height * 0.92} L${width * (-0.33 + i * 0.35)} ${height * 0.92} Z`} fill={`url(#${id}air)`} opacity={0.14} />)}
      </Svg>
      <Image source={require('../../assets/weather/sun-radiance.png')}
        resizeMode="contain" fadeDuration={0}
        style={{ position: 'absolute', width: width * 0.92, height: width * 0.92,
          left: width * 0.31, top: height * 0.23 - width * 0.46 }} />
    </Animated.View>}
    {scene.condition !== 'sun' && <>
      <Animated.View style={[styles.cloudFar, distantClouds, { opacity: scene.storm ? 0.16 : fog ? 0.30 : 0.52 }]}>
        <Image source={require('../../assets/weather/cumulus.png')} resizeMode="contain" fadeDuration={0} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[styles.cloudNear, nearClouds]}>
        <Image source={require('../../assets/weather/cumulus.png')} resizeMode="contain" fadeDuration={0} style={[StyleSheet.absoluteFill, { opacity: scene.storm ? 0.20 : scene.heavy ? 0.30 : fog ? 0.34 : 0.82 }]} />
      </Animated.View>
    </>}
    {(fog || scene.wet || scene.snow || scene.windy) && <Animated.View style={[styles.mist, haze]}>
      <Image source={require('../../assets/weather/cumulus.png')} resizeMode="stretch" fadeDuration={0} style={[StyleSheet.absoluteFill, { opacity: fog ? 0.55 : scene.snow ? 0.15 : 0.09 }]} />
    </Animated.View>}
    {scene.particles > 0 && <><Precipitation scene={scene} active={active} width={width} height={height} far /><Precipitation scene={scene} active={active} width={width} height={height} /></>}
    {scene.storm && <Animated.View style={[styles.lightning, discharge]}>
      <Image source={require('../../assets/weather/lightning.png')} resizeMode="contain" fadeDuration={0} style={StyleSheet.absoluteFill} />
    </Animated.View>}
    {scene.storm && <Animated.View style={[StyleSheet.absoluteFill, flash]}>
      <Svg width="100%" height="100%" viewBox="0 0 400 440" preserveAspectRatio="none">
        <Defs><RadialGradient id={`${id}flash`}><Stop offset="0" stopColor="#eef4ff" /><Stop offset="0.35" stopColor="#c6dbff" stopOpacity={0.75} /><Stop offset="1" stopColor="#a3c3ff" stopOpacity={0} /></RadialGradient></Defs>
        <Ellipse cx={300} cy={70} rx={175} ry={155} fill={`url(#${id}flash)`} />
      </Svg>
    </Animated.View>}
  </>;
}
function Precipitation({ scene, active, width, height, far = false }: { scene: Scene; active: boolean; width: number; height: number; far?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const phase = useCycle(active, scene.snow ? (far ? 15000 : 10000) : scene.drizzle ? (far ? 2300 : 1700) : far ? 1300 : 850);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: phase.value * height }, { translateX: scene.snow ? Math.sin(phase.value * Math.PI * 2) * (scene.windy ? 16 : 5) : 0 }] }));
  const count = far ? Math.ceil(scene.particles * 0.6) : scene.particles;
  return <Animated.View style={[{ position: 'absolute', top: -height, left: -35, width: width + 70, height: height * 2, opacity: far ? 0.22 : scene.snow ? 0.75 : 0.50 }, style]}>
    <Svg width="100%" height="100%" viewBox={`0 0 ${width + 70} ${height * 2}`}>
      <Defs>
        <SvgGradient id={`${id}rain`} x1="0" y1="0" x2="0.8" y2="1"><Stop offset="0" stopColor="#d7ecfa" stopOpacity={0} /><Stop offset="0.7" stopColor="#dbedfa" stopOpacity={0.6} /><Stop offset="1" stopColor="#f0f8ff" stopOpacity={0.95} /></SvgGradient>
        <RadialGradient id={`${id}snow`}><Stop offset="0" stopColor="#fff" /><Stop offset="0.38" stopColor="#f2f8ff" stopOpacity={0.85} /><Stop offset="1" stopColor="#e7f1ff" stopOpacity={0} /></RadialGradient>
      </Defs>
      {[0, 1].flatMap(copy => Array.from({ length: count }, (_, i) => {
        const x = ((i * 137.508 + (far ? 47 : 0)) % (width + 70));
        const y = (i * 83.731 % height) + copy * height;
        const depth = 0.55 + (i % 5) / 6;
        return scene.snow ? <Circle key={`${copy}-${i}`} cx={x} cy={y} r={depth * (far ? 1.4 : 3.2)} fill={`url(#${id}snow)`} /> : <Path key={`${copy}-${i}`} d={`M${x} ${y} l${-Math.max(2, scene.wind / 3)} ${depth * (scene.drizzle ? 7 : scene.heavy ? 28 : 17)}`} stroke={`url(#${id}rain)`} strokeWidth={far || scene.drizzle ? 0.65 : 1} strokeLinecap="round" />;
      }))}
    </Svg>
  </Animated.View>;
}
const styles = StyleSheet.create({
  lightning: { position: 'absolute', top: '-5%', right: '-2%', width: '62%', height: '72%' },
  cloudFar: { position: 'absolute', left: '-22%', right: '-22%', top: '-18%', height: '72%' },
  cloudNear: { position: 'absolute', left: '-35%', right: '-35%', top: '-9%', height: '85%' },
  mist: { position: 'absolute', left: '-40%', right: '-40%', top: '5%', bottom: '-25%' },
});
