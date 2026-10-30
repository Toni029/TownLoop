import {View} from 'react-native';
import {Building2,Users,Wrench} from 'lucide-react-native';
import type {Category} from './model';
/** Shared list/header artwork; Office direct messages retain the Office identity. */
export function InboxThreadIcon({category,officeDirect=false}:{category:Category;officeDirect?:boolean}){
 const office=category==='office'||officeDirect;
 const tone=office?'#2563eb':category==='maintenance'?'#d97706':'#059669';
 const Glyph=office?Building2:category==='maintenance'?Wrench:Users;
 return <View style={{width:32,height:32,borderRadius:12,backgroundColor:tone+'20',borderWidth:1,borderColor:tone+'33',alignItems:'center',justifyContent:'center'}}><Glyph size={16} color={tone}/></View>;
}
