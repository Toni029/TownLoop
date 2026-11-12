import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Keyboard,KeyboardAvoidingView,Modal,Platform,Pressable,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeftRight,Languages,X} from 'lucide-react-native';
import {ScrollView} from '../keyboard/KeyboardScrollView';
import {Action,Copy,ErrorNotice,Field} from '../news/ui';
import {usePresentation} from '../shell/TownLoopShell';
import {canTranslateWorkOrder,isCrew} from '../../../src/utils/permissions';
import type {UserProfile} from '../../../src/types';
import {translateCrewResponse,type TranslationLanguage} from './translator';
export function TranslationComposer({draft,user,onUse,onClose,disabled=false}:{draft:string;user:UserProfile|null;disabled?:boolean;onUse:(text:string)=>void;onClose:()=>void}){
 const dark=!!usePresentation()?.dark;
 const [source,setSource]=useState<TranslationLanguage>('es'),[input,setInput]=useState(draft),[output,setOutput]=useState('');
 const target:TranslationLanguage=source==='es'?'en':'es';
 const [busy,setBusy]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[choose,setChoose]=useState(false);
 const live=useRef(true),lock=useRef(false),request=useRef<AbortController|null>(null);
 useEffect(()=>{live.current=true;return()=>{live.current=false;request.current?.abort();};},[]);
 const allowed=isCrew(user)&&canTranslateWorkOrder(user);
 function reset(){setOutput('');setReady(false);setError('');setChoose(false);}
 function language(next:TranslationLanguage){if(lock.current||next===source)return;setSource(next);reset();}
 function close(){live.current=false;request.current?.abort();Keyboard.dismiss();onClose();}
 async function translate(){
  if(!allowed||lock.current||!input.trim())return;
  lock.current=true;setBusy(true);reset();Keyboard.dismiss();
  const controller=new AbortController();request.current=controller;
  try{const result=await translateCrewResponse(input,source,target,controller.signal);if(live.current&&!controller.signal.aborted){setOutput(result);setReady(true);}}
  catch(e){if(live.current&&!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to translate. Please retry.');}
  finally{lock.current=false;if(live.current)setBusy(false);}
 }
 function insert(mode:'replace'|'append'){
  if(!allowed||disabled||lock.current||!ready||!output.trim())return;
  onUse(mode==='append'&&draft?`${draft}\n\n${output}`:output);close();
 }
 const names={es:'Spanish',en:'English'};
 function selector(kind:'Source'|'Target',selected:TranslationLanguage){return <View style={{flex:1,minWidth:0,gap:6}}>
  <Copy weight="bold">{kind==='Source'?'From':'To'}</Copy>
  {(['es','en'] as const).map(lang=><Pressable key={lang} accessibilityRole="radio" accessibilityLabel={`${kind}: ${names[lang]}`} accessibilityState={{checked:selected===lang,disabled:busy}} disabled={busy}
   onPress={()=>language(kind==='Source'?lang:lang==='es'?'en':'es')}
   style={({pressed})=>({minHeight:44,justifyContent:'center',alignItems:'center',padding:8,borderRadius:12,borderWidth:1,borderColor:selected===lang?'#059669':dark?'#475569':'#d6d3d1',backgroundColor:selected===lang?(dark?'#064e3b':'#d1fae5'):(dark?'#1e293b':'#fff'),opacity:pressed?0.75:1})}>
   <Copy weight={selected===lang?'bold':'regular'} style={{fontSize:14,textAlign:'center'}}>{names[lang]}</Copy>
  </Pressable>)}
 </View>;}
 if(!allowed)return null;
 return <Modal transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
  <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1,backgroundColor:'#0c0a0980'}}>
   <SafeAreaView edges={['top','bottom','left','right']} style={{flex:1,padding:12,alignItems:'center'}}>
    <View accessibilityViewIsModal style={{flex:1,width:'100%',maxWidth:680,borderRadius:24,overflow:'hidden',backgroundColor:dark?'#0f172a':'#fffcf5'}}>
     <View style={{flexDirection:'row',alignItems:'center',gap:10,padding:18,borderBottomWidth:1,borderColor:dark?'#334155':'#e7e5e4'}}>
      <Languages size={24} color="#059669"/>
      <Copy accessibilityRole="header" weight="bold" style={{flex:1,fontSize:20,lineHeight:27}}>Translate your response</Copy>
      <Pressable accessibilityRole="button" accessibilityLabel="Close translation" onPress={close} hitSlop={6} style={{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:dark?'#1e293b':'#f5f5f4'}}><X size={22} color={dark?'#f1f5f9':'#57534e'}/></Pressable>
     </View>
     <ScrollView style={{flex:1}} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" extraKeyboardSpace contentContainerStyle={{padding:18,gap:16}}>
      <View style={{flexDirection:'row',gap:10,alignItems:'center'}}>
       {selector('Source',source)}
       <Pressable accessibilityRole="button" accessibilityLabel="Swap languages" accessibilityState={{disabled:busy}} disabled={busy} onPress={()=>language(target)} style={{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:dark?'#064e3b':'#d1fae5'}}><ArrowLeftRight size={22} color="#059669"/></Pressable>
       {selector('Target',target)}
      </View>
      <Field label="Original message" labelCase="natural" value={input} editable={!busy} onChangeText={text=>{setInput(text);reset();}} multiline maxLength={25000} keyboardActionSpace={60} placeholder={source==='es'?'Escribe tu respuesta aquí…':'Write your response here…'} style={{minHeight:144,fontSize:16,lineHeight:23}}/>
      <Action label="Translate" icon={Languages} tone="light" fullWidth size="large" disabled={busy||!input.trim()} onPress={()=>void translate()}/>
      {busy&&<View accessibilityLiveRegion="polite" style={{flexDirection:'row',gap:10,alignItems:'center'}}><ActivityIndicator color="#059669"/><Copy>Translating…</Copy></View>}
      {!!error&&<ErrorNotice message={error}/>}
      <Field label="Translated message" labelCase="natural" value={output} editable={ready&&!busy} onChangeText={text=>{setOutput(text);setChoose(false);}} multiline keyboardActionSpace={70} placeholder="Your translation will appear here." style={{minHeight:144,fontSize:16,lineHeight:23}}/>
      {ready&&<Copy accessibilityLiveRegion="polite" style={{color:'#047857'}}>Translation ready. Review names, dates, quantities and instructions before using.</Copy>}
      <Action label="USE THIS" fullWidth size="large" disabled={disabled||busy||!ready||!output.trim()} onPress={()=>{if(draft.trim())setChoose(true);else insert('replace');}}/>
      {choose&&<View style={{gap:10,padding:14,borderRadius:16,backgroundColor:dark?'#064e3b':'#ecfdf5'}}>
       <Copy weight="bold">You already have a response draft.</Copy>
       <Copy>Replace it with the translation, or append the translation below it.</Copy>
       <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}><Action label="Replace" onPress={()=>insert('replace')}/><Action label="Append" tone="light" onPress={()=>insert('append')}/></View>
      </View>}
     </ScrollView>
    </View>
   </SafeAreaView>
  </KeyboardAvoidingView>
 </Modal>;
}
