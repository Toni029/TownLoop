import {ActivityIndicator,Pressable,Text,View} from 'react-native';
import {AlertTriangle,Check,ChevronRight,ShieldCheck,Trash2} from 'lucide-react-native';
import {TextInput} from '../keyboard/KeyboardScrollView';
import {CLEANUP_CATEGORIES,CLEANUP_PHRASE,canConfirmCleanup,cleanupCanCancel,cleanupIsActive,cleanupOutcome} from './databaseCleanupModel';
import type {DatabaseCleanupController} from './useDatabaseCleanup';

export function DatabaseCleanup({controller:c,dark}:{controller:DatabaseCleanupController;dark:boolean}) {
  const ink=dark?'#f1f5f9':'#1c1917', muted=dark?'#b8c4d4':'#57534e', border=dark?'#475569':'#d6d3d1';
  const font=(size=13,bold=false)=>({fontFamily:bold?'JakartaBold':'Jakarta',fontSize:size,color:ink,lineHeight:size+7});
  const panel={padding:18,borderWidth:1,borderColor:border,borderRadius:18,backgroundColor:dark?'#1e293b':'#ffffff',gap:12} as const;
  const action=(label:string,onPress:()=>unknown,disabled=false,danger=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={()=>void onPress()}
    style={({pressed})=>({minHeight:48,paddingHorizontal:16,paddingVertical:12,borderRadius:12,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:danger?'#be123c':border,backgroundColor:danger?'#be123c':dark?'#334155':'#f5f5f4',opacity:disabled?0.45:pressed?0.75:1})}>
    <Text style={{...font(13,true),color:danger?'#fff':ink,textAlign:'center'}}>{label}</Text>
  </Pressable>;
  if(!c.allowed)return <Text style={font()}>Database Cleanup requires an approved Admin account.</Text>;
  const job=c.job, confirming=c.step==='confirmation' && job?.state==='review';
  const ready=canConfirmCleanup(job,CLEANUP_PHRASE,c.busy||c.needsStatus);
  return <View style={{gap:16,width:'100%',maxWidth:760,alignSelf:'center'}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
      <View style={{padding:12,borderRadius:14,backgroundColor:dark?'#4c1825':'#fff1f2'}}><Trash2 size={24} color={dark?'#fda4af':'#be123c'}/></View>
      <View style={{flex:1}}><Text accessibilityRole="header" style={font(22,true)}>Database Cleanup</Text><Text style={{...font(12),color:muted}}>Admin only · Permanent community data removal</Text></View>
    </View>
    <View style={[panel,{borderColor:dark?'#854d0e':'#fcd34d',backgroundColor:dark?'#302718':'#fffbeb'}]}>
      <View style={{flexDirection:'row',gap:8,alignItems:'center'}}><AlertTriangle size={19} color={dark?'#fcd34d':'#92400e'}/><Text style={{...font(14,true),flex:1}}>Review carefully. This cannot be undone.</Text></View>
      <Text style={{...font(),color:muted}}>Selected categories include real community data. Preview builds an inventory first; nothing is deleted until you review it and type the confirmation phrase.</Text>
    </View>
    {!!c.error&&<View accessibilityRole="alert" style={[panel,{borderColor:'#fb7185'}]}><Text style={{...font(),color:dark?'#fda4af':'#9f1239'}}>{c.error}</Text>{c.needsStatus&&<Text style={{...font(12),color:muted}}>The last response could not be verified. Refresh status before confirming or resuming; do not assume the request failed.</Text>}</View>}
    {!job&&<View style={panel}>
      <Text accessibilityRole="header" style={font(16,true)}>1. Choose what to remove</Text>
      <Text style={{...font(12),color:muted}}>Each category is independent. All options start unchecked.</Text>
      {CLEANUP_CATEGORIES.map(category=>{
        const checked=c.selected.includes(category.key);
        return <Pressable key={category.key} accessibilityRole="checkbox" accessibilityLabel={category.label} accessibilityState={{checked,disabled:c.busy}} disabled={c.busy} onPress={()=>c.toggle(category.key)}
          style={({pressed})=>({minHeight:64,flexDirection:'row',alignItems:'center',gap:12,padding:14,borderRadius:12,borderWidth:1,borderColor:checked?(dark?'#fbbf24':'#b45309'):border,backgroundColor:checked?(dark?'#3a2e1e':'#fffbeb'):dark?'#172130':'#fafaf9',opacity:c.busy?0.5:pressed?0.75:1})}>
          <View style={{height:24,width:24,borderWidth:2,borderRadius:6,borderColor:checked?'#b45309':muted,backgroundColor:checked?'#b45309':'transparent',alignItems:'center',justifyContent:'center'}}>{checked&&<Check size={17} color="#fff"/>}</View>
          <Text style={{...font(14,true),flex:1,flexShrink:1}}>{category.label}</Text>
        </Pressable>;
      })}
      {action(c.busy?'Preparing preview…':'Preview selected data',c.preview,c.busy||!c.selected.length)}
    </View>}
    {!!job&&<>
      <View style={panel}>
        <Text accessibilityRole="header" style={font(16,true)}>{confirming?'2. Confirm permanent deletion':'Selected inventory & progress'}</Text>
        <View accessibilityLiveRegion="polite" style={{gap:8}}>
          <Text style={{...font(13,true),color:job.state==='completed_with_holds'?(dark?'#fcd34d':'#92400e'):ink}}>{cleanupOutcome(job)}</Text>
          {!!job.message&&<Text style={{...font(12),color:muted}}>{job.message}</Text>}
          {(!job.enabled||(!job.completeInventory&&job.state==='review'))&&<Text style={{...font(12,true),color:dark?'#fcd34d':'#92400e'}}>{!job.enabled?'The cleanup service is not enabled. Confirmation is unavailable until the service is ready.':'The inventory is incomplete. Deletion is unavailable; refresh status or cancel this preview.'}</Text>}
          <Text selectable style={{...font(10),color:muted}}>Job {job.id}</Text>
          {CLEANUP_CATEGORIES.filter(category=>job.categories.includes(category.key)).map(category=>{
            const count=job.counts[category.key]!;
            return <View key={category.key} style={{gap:6,borderTopWidth:1,borderColor:border,paddingTop:12,marginTop:4}}>
              <Text style={font(14,true)}>{category.label}</Text>
              <Text style={{...font(12),color:muted}}>{`${count.records.toLocaleString()} records · ${count.documents.toLocaleString()} documents in inventory`}</Text>
              <View style={{flexDirection:'row',flexWrap:'wrap',columnGap:16,rowGap:4}}>
                <Text style={font(12)}>{count.deleted.toLocaleString()} documents deleted</Text>
                <Text style={font(12)}>{count.held.toLocaleString()} records held</Text>
                <Text style={font(12)}>{count.remaining.toLocaleString()} documents remaining</Text>
                <Text style={font(12)}>{count.failed.toLocaleString()} operations failed</Text>
                <Text style={font(12)}>{count.storageDeleted.toLocaleString()} files deleted</Text>
                <Text style={font(12)}>{count.storageHeld.toLocaleString()} media references held</Text>
              </View>
            </View>;
          })}
        </View>
        {(cleanupIsActive(job)||c.busy)&&<View style={{flexDirection:'row',alignItems:'center',gap:8}}><ActivityIndicator color={dark?'#fbbf24':'#b45309'}/><Text style={{...font(12),color:muted}}>{c.busy?'Contacting cleanup service…':'Status refreshes while this screen is active.'}</Text></View>}
        {confirming?<>
          <Text style={font(13,true)}>Permanently delete the selected inventory above?</Text>
          <Text style={{...font(12),color:muted}}>Protected records and held files stay in place. Type the phrase exactly to authorize the selected cleanup.</Text>
          <Text selectable style={{...font(15,true),letterSpacing:1}}>{CLEANUP_PHRASE}</Text>
          <TextInput accessibilityLabel="Confirmation phrase" placeholder={CLEANUP_PHRASE} placeholderTextColor={muted} value={c.phrase} onChangeText={c.setPhrase} editable={!c.busy&&!c.needsStatus} autoCapitalize="characters" autoCorrect={false} spellCheck={false} maxLength={80} keyboardActionSpace={150}
            style={{...font(14),borderWidth:1,borderColor:border,borderRadius:12,padding:14,minHeight:52,backgroundColor:dark?'#0f172a':'#fafaf9'}}/>
          {action('Delete selected data',c.confirm,!canConfirmCleanup(job,c.phrase,c.busy||c.needsStatus),true)}
          {action('Back to inventory',c.backToInventory,c.busy)}
        </>:job.state==='review'?<>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}><ChevronRight size={16} color={muted}/><Text style={{...font(12),color:muted}}>One more confirmation step is required.</Text></View>
          {action('Continue to confirmation',c.showConfirmation,!ready)}
        </>:null}
        {action('Refresh job status',c.refresh,c.busy)}
        {['paused','failed'].includes(job.state)&&action('Resume cleanup',c.resume,c.busy||c.needsStatus||!job.enabled)}
        {cleanupCanCancel(job)&&action(job.state==='planning'||job.state==='review'?'Cancel preview':'Cancel cleanup',c.cancel,c.busy)}
        {['completed','completed_with_holds','cancelled'].includes(job.state)&&action('Start a new selection',c.newSelection,c.busy)}
        {cleanupCanCancel(job)&&<Text style={{...font(11),color:muted}}>Cancellation stops further work when safe. Data already deleted cannot be restored.</Text>}
      </View>
    </>}
    <View style={panel}>
      <View style={{flexDirection:'row',gap:8,alignItems:'center'}}><ShieldCheck size={19} color={dark?'#6ee7b7':'#047857'}/><Text style={font(14,true)}>Protected data stays protected</Text></View>
      <Text style={{...font(12),color:muted}}>Resident accounts and profiles, private messages, app settings, audit records, and unselected categories are outside this cleanup. Files without verified ownership, or shared with protected or unselected records, are held and reported.</Text>
      <Text style={{...font(11),color:muted}}>Newsletters includes their related RSVP Events and Pinned Highlights. Preview does not authorize deletion. Leaving this screen stops status checks; it does not cancel or restart a confirmed server job.</Text>
    </View>
  </View>;
}
