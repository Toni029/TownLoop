import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { Copy, Action, s } from '../news/ui';
import type { MediaAttachment } from '../../../src/types';
import { useVideoPlayer, VideoView } from 'expo-video';
export function Video({uri}: {uri:string}) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} style={{width:'100%',height:260}} nativeControls contentFit="contain"/>;
}
export function MediaViewer({media,initialIndex=0,title,onClose}:{media:MediaAttachment[];initialIndex?:number;title:string;onClose:()=>void}) {
  const [index,setIndex]=useState(initialIndex);
  const item=media[index];
  return <Modal animationType="fade" onRequestClose={onClose}><SafeAreaView style={{flex:1,backgroundColor:'#0c0a09'}}>
    <View style={[s.row,{padding:14}]}><Copy weight="bold" style={{flex:1,color:'#fff'}}>{title}</Copy><Pressable accessibilityRole="button" accessibilityLabel="Close media" onPress={onClose} style={{padding:12}}><X size={24} color="#fff"/></Pressable></View>
    {item?.type === 'video' ? <View style={{flex:1,justifyContent:'center'}}><Video key={item.url} uri={item.url}/></View> : <ScrollView style={{flex:1}} contentContainerStyle={{flexGrow:1,justifyContent:'center'}} maximumZoomScale={4} minimumZoomScale={1} centerContent><Image source={{uri:item?.url}} accessibilityLabel={item?.name || title} resizeMode="contain" style={{width:'100%',height:550}}/></ScrollView>}
    <View style={[s.row,{justifyContent:'center',padding:14}]}><Action label="Previous" icon={ChevronLeft} disabled={index===0} onPress={()=>setIndex(i=>i-1)}/><Copy style={{color:'#fff'}}>{index+1} / {media.length}</Copy><Action label="Next" icon={ChevronRight} disabled={index>=media.length-1} onPress={()=>setIndex(i=>i+1)}/></View>
  </SafeAreaView></Modal>;
}
