import {useSyncExternalStore} from 'react';import {View} from 'react-native';
import {Weather} from './Weather';import type{createWeatherViewport}from './weatherViewport';
export function VisibleWeather({viewport}:{viewport:ReturnType<typeof createWeatherViewport>}){
 const visible=useSyncExternalStore(viewport.subscribe,viewport.snapshot,()=>true);
 return <View onLayout={event=>viewport.card(event.nativeEvent.layout.y,event.nativeEvent.layout.height)}><Weather visible={visible}/></View>;
}
