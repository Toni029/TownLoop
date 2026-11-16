// Local candidate generation only. No Firebase access or deployment.
const fs=require('fs'),crypto=require('crypto');
let s=fs.readFileSync('security/account-deletion/firestore.default.candidate.rules','utf8');
const helpers=`
    function recordMediaTicket(collectionName, recordId) {
      return get(/databases/$(database)/documents/safety_limits/$(request.auth.uid)).data.get('recordMediaAuthorizations', {}).get(collectionName + ':' + recordId, {});
    }
    function recordMediaApproved(t, collectionName, recordId) {
      return t.get('collection', '') == collectionName && t.get('recordId', '') == recordId &&
        t.get('ownerUid', '') == resource.data.get('userId', resource.data.get('authorId', '')) && t.expiresAt > request.time;
    }
    function emptyMediaCreate() {
      return request.resource.data.get('media', []) == [] && request.resource.data.get('mediaUrl', '') == '' &&
        request.resource.data.get('photos', []) == [] && request.resource.data.get('photoUrl', '') == '';
    }
    function socialMediaTicketMatches(collectionName, recordId) {
      let t=recordMediaTicket(collectionName, recordId);
      return recordMediaApproved(t, collectionName, recordId) && request.resource.data.get('media', []) == t.desired.media && request.resource.data.get('mediaUrl', '') == t.desired.mediaUrl;
    }
    function socialMediaOwned(collectionName, recordId) {
      let a = request.resource.data; let b = resource.data;
      return (a.get('media', []) == b.get('media', []) && a.get('mediaUrl', '') == b.get('mediaUrl', '')) ||
        (a.get('media', []) == [] && a.get('mediaUrl', '') == '') ||
        socialMediaTicketMatches(collectionName, recordId);
    }
    function orderMediaTicketMatches(orderId) {
      let t=recordMediaTicket('work_orders', orderId);
      return recordMediaApproved(t, 'work_orders', orderId) && request.resource.data.get('photos', []) == t.desired.photos && request.resource.data.get('photoUrl', '') == t.desired.photoUrl;
    }
    function orderMediaOwned(orderId) {
      let a=request.resource.data; let b=resource.data;
      return (a.get('photos', []) == b.get('photos', []) && a.get('photoUrl', '') == b.get('photoUrl', '')) ||
        (a.get('photos', []) == [] && a.get('photoUrl', '') == '') ||
        orderMediaTicketMatches(orderId);
    }
    function orderCommentTicketMatches(photo, orderId) {
      let t=recordMediaTicket('work_orders', orderId);
      return recordMediaApproved(t, 'work_orders', orderId) && photo == t.desired.commentPhoto;
    }
    function orderCommentPhotoAllowed(photo, orderId) {
      return photo == '' || photo == resource.data.get('photoUrl', '') || photo in resource.data.get('photos', []) ||
        orderCommentTicketMatches(photo, orderId);
    }
`;
s=s.replace('    function mediaDraft(data) {',helpers+'    function mediaDraft(data) {');
for(const collection of ['marketplace_posts','discussion_feed','posts','marketItems']){
 const re=new RegExp('(match /'+collection+'/\\{([^}]+)\\} \\{)([\\s\\S]*?)(\\n    \\})');
 s=s.replace(re,(_all,head,id,body,end)=>head+body.replace('allow create: if isApproved()', 'allow create: if emptyMediaCreate() && isApproved()').replace('allow update: if isApproved()',`allow update: if socialMediaOwned('${collection}', ${id}) && isApproved()`)+end);
}
s=s.replace('function validResolutionRevision()', 'function validResolutionRevision(orderId)').replace('validResolutionRevision())','validResolutionRevision(orderId))');
s=s.replace("after.text == request.resource.data.resolutionNote &&", "after.text == request.resource.data.resolutionNote && (after.get('photoUrl', '') == before.get('photoUrl', '') || orderCommentPhotoAllowed(after.get('photoUrl', ''), orderId)) &&");
s=s.replace('function validNewResolution()', 'function validNewResolution(orderId)').replace('validNewResolution()','validNewResolution(orderId)');
s=s.replace("added.role == 'Maintenance Crew' && added.kind == 'resolution' &&", "added.role == 'Maintenance Crew' && added.kind == 'resolution' && orderCommentPhotoAllowed(added.get('photoUrl', ''), orderId) &&");
s=s.replace('function validWorkOrderTransition()', 'function validWorkOrderTransition(orderId)').replace('validWorkOrderTransition()', 'validWorkOrderTransition(orderId)');
s=s.replace("request.resource.data.comments[request.resource.data.comments.size() - 1].text.size() <= 10000)))", "request.resource.data.comments[request.resource.data.comments.size() - 1].text.size() <= 10000 && orderCommentPhotoAllowed(request.resource.data.comments[request.resource.data.comments.size()-1].get('photoUrl', ''), orderId))))");
s=s.replace("request.resource.data.status == 'Queued' &&", "request.resource.data.status == 'Queued' && request.resource.data.comments == [] &&");
s=s.replace("allow create: if isApproved() && mediaParentMayCreate('work_orders', orderId)","allow create: if emptyMediaCreate() && isApproved() && mediaParentMayCreate('work_orders', orderId)");
s=s.replace("match /work_orders/{orderId} {\n", "match /work_orders/{orderId} {\n");
const start=s.indexOf('    match /work_orders/{orderId} {'),end=s.indexOf('\n    }',start);s=s.slice(0,start)+s.slice(start,end).replace('allow update: if isApproved()', 'allow update: if orderMediaOwned(orderId) && isApproved()')+s.slice(end);
s=s.replace("data.itemTitle == listing.get('title', '') &&", "data.get('itemMediaUrl', '') == (listing.get('media', []).size() > 0 ? listing.media[0].url : listing.get('mediaUrl', '')) && data.itemTitle == listing.get('title', '') &&");
fs.writeFileSync('security/post-media-deletion/firestore.ownership.rules',s);
fs.writeFileSync('functions/recordMediaRulesPin.json',JSON.stringify({sha256:crypto.createHash('sha256').update(s).digest('hex')},null,2)+'\n');
console.log('Prepared local default-database ownership rules; no deployment.');
