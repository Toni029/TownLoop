import React, {type PropsWithChildren} from 'react';
import {Pressable,Text,View} from 'react-native';
import {recordDiagnostic} from './diagnostics';
export class AppErrorBoundary extends React.Component<PropsWithChildren,{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){recordDiagnostic('react_render_failure');}
 render(){
  if(!this.state.failed)return this.props.children;
  return <View style={{flex:1,justifyContent:'center',padding:32,gap:16,backgroundColor:'#f7f3ea'}}>
   <Text accessibilityRole="header" style={{fontSize:24,fontWeight:'700',color:'#243328'}}>TownLoop needs a moment</Text>
   <Text style={{fontSize:17,color:'#243328'}}>This screen could not open. You can try again. If it continues, reopen the app and contact the office.</Text>
   <Pressable accessibilityRole="button" style={{padding:16,borderRadius:16,backgroundColor:'#047857'}} onPress={()=>this.setState({failed:false})}><Text style={{textAlign:'center',color:'#fff',fontWeight:'700'}}>Try again</Text></Pressable>
  </View>;
 }
}
