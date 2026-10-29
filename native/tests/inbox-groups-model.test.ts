import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationRemoval,type Thread} from '../src/profile/model.ts';
function group(activeCount:number,category:Thread['category']='friend'):Thread {
 return {id:'v3_fixture',category,name:'Fixture',subject:'Conversation',unread:false,messages:[],updatedAt:1,data:{schemaVersion:3,activeCount},recipient:{id:'other',name:'Other'}};
}
test('group removal applies to only the current member, including Office/Crew',()=>{
 for(const category of ['friend','office','maintenance'] as const){
  const label=conversationRemoval(group(2,category));assert.equal(label.label,'Leave Conversation');assert.match(label.description,/Only you/);assert(!label.description.includes('entire'));
 }
});
test('last-member confirmation accurately describes held cleanup instead of claiming completed deletion',()=>{
 const label=conversationRemoval(group(1));assert.equal(label.label,'Delete Conversation Permanently');assert.match(label.description,/disabled pending separate approval/);
});
