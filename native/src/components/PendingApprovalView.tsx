import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Clock3, Info, LogOut, RefreshCw, Users } from 'lucide-react-native';
import { MotionPressable } from '../motion/Pressable';

const cream = '#faf6ed', green = '#087d5c', ink = '#0b203b', muted = '#5c6e7c';
const artwork = require('../../assets/approval/approved-reference.png');
/** Only the approved illustration region is displayed; all copy and controls are native. */
function ApprovalArtwork({width}:{width:number}) {
  const scale = width / 852;
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{width,height:540*scale,overflow:'hidden',zIndex:1}}>
    <Image source={artwork} resizeMode="stretch" fadeDuration={0}
      style={{position:'absolute',left:0,top:-183*scale,width,height:1846*scale}}/>
  </View>;
}
function ApprovalStages() {
  return <View accessible accessibilityLabel="Information submitted: completed. Awaiting approval: current. Access granted: pending." style={styles.stages}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.stageIcons}>
      <View style={[styles.stageCircle,{backgroundColor:'#75af7d'}]}><Check size={25} strokeWidth={3} color="#fff"/></View>
      <View style={styles.connector}>{Array.from({length:7},(_,i)=><View key={i} style={[styles.dot,{backgroundColor:i===6?'#b8cfb2':'#6aa583'}]}/>)}</View>
      <View style={[styles.stageCircle,{backgroundColor:'#f5b32e'}]}><Clock3 size={25} strokeWidth={2.5} color="#fff"/></View>
      <View style={styles.connector}>{Array.from({length:7},(_,i)=><View key={i} style={[styles.dot,{backgroundColor:'#b7babc'}]}/>)}</View>
      <View style={[styles.stageCircle,{backgroundColor:'#e1e0dc'}]}><Users size={24} color="#7d8c94"/></View>
    </View>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.stageLabels}>
      <Text style={styles.stageLabel}>{'Information\nsubmitted'}</Text>
      <Text style={[styles.stageLabel,styles.currentStage]}>{'Awaiting\napproval'}</Text>
      <Text style={styles.stageLabel}>{'Access\ngranted'}</Text>
    </View>
  </View>;
}
export function PendingApprovalView({error,retry,onSignOut}:{error?:string|null;retry:()=>void;onSignOut:()=>void}) {
  const screen = useWindowDimensions(), insets = useSafeAreaInsets();
  const width = Math.max(1,Math.min(520,screen.width-insets.left-insets.right)), scale=width/852;
  return <SafeAreaView edges={['left','right','bottom']} style={styles.page}>
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={{width,maxWidth:'100%',alignSelf:'center'}}>
        <ApprovalArtwork width={width}/>
        <View style={[styles.card,{marginHorizontal:45*scale,marginTop:-248*scale,paddingTop:270*scale}]}>
          <Text accessibilityRole="header" style={[styles.heading,{fontSize:width<360?24:28,lineHeight:width<360?32:37}]}>
            {error ? 'Unable to load your account' : 'Awaiting approval'}
          </Text>
          <Text accessibilityRole={error?'alert':undefined} style={styles.explanation}>
            {error || 'Your community office must approve your account before you can enter TownLoop.'}
          </Text>
          {!error && <ApprovalStages/>}
          <View style={styles.actions}>
            <MotionPressable accessibilityRole="button" accessibilityLabel="Try again" onPress={retry} style={styles.retry}>
              <RefreshCw size={22} strokeWidth={2.5} color="#fff"/><Text style={styles.retryText}>Try again</Text>
            </MotionPressable>
            <MotionPressable accessibilityRole="button" accessibilityLabel="Sign Out" onPress={onSignOut} style={styles.signOut}>
              <LogOut size={22} strokeWidth={2.5} color={green}/><Text style={styles.signOutText}>Sign Out</Text>
            </MotionPressable>
          </View>
          {!error && <View style={styles.information}>
            <Info size={24} strokeWidth={2.5} color={green} style={{marginTop:2,flexShrink:0}}/>
            <View style={{flex:1,minWidth:0,gap:3}}>
              <Text style={styles.infoTitle}>Please check back later.</Text>
              <Text style={styles.infoBody}>Your account is awaiting approval from your community office. You can return to TownLoop anytime to check your status.</Text>
            </View>
          </View>}
        </View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:cream},
  scroll:{flexGrow:1,paddingBottom:30},
  card:{backgroundColor:'#fcf9f1',borderRadius:26,borderWidth:1,borderColor:'#e4dccd',paddingHorizontal:17,paddingBottom:18,boxShadow:'0px 12px 32px rgba(75,57,25,0.10)'},
  heading:{fontFamily:'JakartaBold',color:ink,textAlign:'center',letterSpacing:-0.7},
  explanation:{fontFamily:'Jakarta',fontSize:17,lineHeight:24,color:muted,textAlign:'center',marginTop:10,paddingHorizontal:6},
  stages:{marginTop:23,paddingTop:13,borderTopWidth:1,borderColor:'#e9e3d7'},
  stageIcons:{flexDirection:'row',alignItems:'center',paddingHorizontal:23},
  stageCircle:{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center'},
  connector:{flex:1,flexDirection:'row',justifyContent:'space-evenly',alignItems:'center',paddingHorizontal:5},
  dot:{width:3.5,height:3.5,borderRadius:2},
  stageLabels:{flexDirection:'row',marginTop:7},
  stageLabel:{flex:1,fontFamily:'Jakarta',fontSize:12,lineHeight:17,color:muted,textAlign:'center'},
  currentStage:{fontFamily:'JakartaBold',color:ink},
  actions:{gap:8,marginTop:22},
  retry:{minHeight:49,paddingVertical:11,paddingHorizontal:18,borderRadius:28,backgroundColor:green,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:13},
  retryText:{fontFamily:'JakartaBold',fontSize:17,lineHeight:24,color:'#fff',flexShrink:1},
  signOut:{minHeight:49,paddingVertical:10,paddingHorizontal:18,borderWidth:1.5,borderColor:green,borderRadius:28,backgroundColor:'#f2f5e9',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:13},
  signOutText:{fontFamily:'JakartaBold',fontSize:17,lineHeight:24,color:green,flexShrink:1},
  information:{marginTop:15,backgroundColor:'#e9f0e3',borderRadius:15,padding:15,flexDirection:'row',alignItems:'flex-start',gap:13},
  infoTitle:{fontFamily:'JakartaBold',fontSize:15,lineHeight:21,color:green},
  infoBody:{fontFamily:'Jakarta',fontSize:13,lineHeight:19,color:muted},
});
