import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fitPortrait,menuBounds} from '../src/layout/phoneGeometry.ts';
const phones=[
 {width:320,height:568,insets:{top:20,bottom:0,left:0,right:0}},
 {width:375,height:667,insets:{top:20,bottom:0,left:0,right:0}},
 {width:393,height:852,insets:{top:59,bottom:34,left:0,right:0}},
 {width:440,height:956,insets:{top:62,bottom:34,left:0,right:0}},
 {width:480,height:1000,insets:{top:32,bottom:24,left:0,right:0}},
 {width:844,height:390,insets:{top:0,bottom:21,left:59,right:59}},
];
test('the entire approved portrait fits each phone, with an unchanged aspect ratio and safe centering',()=>{
 for(const {width,height,insets} of phones){
  const f=fitPortrait(width,height,insets);
  assert.ok(Math.abs(f.width/f.height-1320/2868)<1e-10);
  assert.ok(f.left>=insets.left&&f.top>=insets.top);
  assert.ok(f.left+f.width<=width-insets.right+1e-8);
  assert.ok(f.top+f.height<=height-insets.bottom+1e-8);
  assert.ok(Math.abs(f.left+f.width/2-(insets.left+(width-insets.left-insets.right)/2))<1e-8);
  assert.ok(f.width>=200||height<400);
 }
});
test('profile/account panels fit safe phone bounds, including short keyboard-resized viewports',()=>{
 for(const {width,height,insets} of phones){const p=menuBounds(width,height,insets);
  assert.ok(p.width<=width-insets.left-insets.right-24&&p.width>0);
  assert.ok(p.height<=height-insets.top-insets.bottom-24&&p.height>0);
 }
 assert.ok(menuBounds(320,180,{top:44,bottom:34,left:0,right:0}).height<=78);
});
test('native shell uses the phone width; dock labels fit without scaling the entire UI',()=>{
 const shell=readFileSync(new URL('../src/shell/TownLoopShell.tsx',import.meta.url),'utf8');
 assert.ok(shell.includes('maxWidth: Platform.OS === "web" ? 448 : undefined'));
 assert.ok(shell.includes('minimumFontScale={0.85}'));
 const profile=readFileSync(new URL('../src/profile/ProfileMenu.tsx',import.meta.url),'utf8');
 assert.ok(profile.includes('paddingLeft: insets.left + 12'));
 assert.ok(profile.includes('width: menuSize.width'));
});
