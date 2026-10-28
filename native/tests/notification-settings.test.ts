import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const source=read('../src/profile/ProfileMenu.tsx');
const tree=ts.createSourceFile('ProfileMenu.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function branch(view:string){
 let result='';
 function visit(n:ts.Node){
  if(ts.isJsxExpression(n)&&n.expression&&n.expression.getText(tree).startsWith(`view === "${view}" &&`))result+=n.getText(tree);
  ts.forEachChild(n,visit);
 }
 visit(tree);return result;
}
test('Account places the amber bell Notifications entry directly after Edit Profile',()=>{
 const account=branch('account');
 assert.match(account,/title="Edit Profile"\s+onPress=\{editProfile\}\s*\/>\s*<Row title="Notifications" icon=\{Bell\} tone="#d97706" highlight onPress=\{\(\) => go\("notifications"\)\}/);
 assert.ok(source.includes('? (dark ? "#78350f" : "#fef3c7")'));
 assert.ok(source.includes('notifications: "Notifications"'));
});
test('four existing preferences appear only on Notifications, with OS status and a device-settings link',()=>{
 const settings=branch('notifications'),inbox=branch('inbox');
 for(const label of ['Private inbox','Marketplace messages','Discussion replies','Work orders updates'])assert.ok(settings.includes(`'${label}'`));
 assert.ok(settings.includes('value={push.preferences[category]}'));
 assert.ok(settings.includes('onValueChange={()=>push.toggle(category)}'));
 assert.ok(settings.includes('push.authorization'));
 assert.ok(settings.includes('Linking.openSettings()'));
 assert.ok(settings.includes('Blocked by your device'));
 assert.equal(inbox.includes('<Switch'),false);
 assert.equal((source.match(/value=\{push.preferences\[category\]\}/g)||[]).length,1);
});
test('native permission request is independent of Inbox UI and never displays the removed introduction',()=>{
 const provider=read('../src/notifications/InboxPushProvider.tsx');
 assert.equal(/Stay connected with TownLoop|Alert\.alert|explanationOpen|markExplained|setPreference\(/.test(provider),false);
 assert.match(provider,/if\(loading\|\|!navigation\?\.key\|\|!communityReady\|\|Platform.OS==='web'\)return/);
 assert.ok(provider.includes("AppState.currentState!=='active'"));
 assert.ok(provider.includes('requestAnimationFrame'));
 assert.equal(source.includes('requestPermissionsAsync'),false);
 assert.equal(branch('inbox').includes('refresh(true)'),false);
});


test('first-launch permission does not require login; category defaults are applied only during an approved account sync',()=>{
 const provider=read('../src/notifications/InboxPushProvider.tsx');
 assert.ok(provider.includes('await requestNativeNotificationPermission()'));
 assert.ok(provider.includes('await applyNotificationPermission(current.uid,osPermission)'));
 assert.ok(provider.indexOf('await applyNotificationPermission')<provider.indexOf('const result=await syncDevice'));
});
