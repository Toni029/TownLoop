// Scoped incremental patch for the deployed Stage A rules; never deploys.
function patchLegacyLeaveRules(source){
 if(!source.includes('function legacyGroupAccess(data)')||!source.includes('match /inbox_conversations/'))throw Error('Reviewed Stage A baseline required.');
 if(source.includes('function legacyMaySend('))throw Error('Legacy leave correction already present; review instead of applying twice.');
 let rules=source.replace("return !('groupConversationId' in data) || (groupAccess(data.groupConversationId) &&", "return data.get('leftBy', {}).get(request.auth.uid, false) != true && (!('groupConversationId' in data) || (groupAccess(data.groupConversationId) &&").replace('data.legacyVisibility);','data.legacyVisibility));');
 if(rules===source)throw Error('Unexpected legacy authorization baseline.');
 const helper=`    function legacyMaySend(source, data) {
      let left = data.get('leftBy', {});
      return source == 'resident_chats'
        ? left.get(data.participantIds[0], false) != true && left.get(data.participantIds[1], false) != true
        : left.get(data.residentId, false) != true && data.get('sideLeft', {}).get('resident', false) != true && data.get('sideLeft', {}).get('team', false) != true;
    }
`;
 rules=rules.replace('    function legacyGroupAccess(data)',helper+'    function legacyGroupAccess(data)');
 for(const name of ['resident_chats','office_chats','maintenance_chats']){
  const start=rules.indexOf(`match /${name}/{chatId}`),end=rules.indexOf('\n    }',start);
  if(start<0||end<0)throw Error('Unexpected legacy collection baseline.');
  const old=rules.slice(start,end),next=old.replace('allow update: if ',`allow update: if legacyGroupAccess(resource.data) && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['messages']) || legacyMaySend('${name}', resource.data)) && `);
  if(next===old)throw Error('Missing legacy update guard.');
  rules=rules.slice(0,start)+next+rules.slice(end);
 }
 return rules;
}
module.exports={patchLegacyLeaveRules};
