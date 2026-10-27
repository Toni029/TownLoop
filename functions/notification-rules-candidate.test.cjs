const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('reply candidate changes only optional validated discussion reply metadata, preserving every unrelated rule',()=>{
 const root=path.resolve(__dirname,'..');const base=fs.readFileSync(root+'/firestore.rules','utf8');
 let candidate=fs.readFileSync(root+'/security/inbox-push/firestore-replies.candidate.rules','utf8');
 const start=candidate.indexOf('    // Optional direct-reply metadata;'),end=candidate.indexOf('    function socialComment(',start);
 assert(start>=0&&end>start);candidate=candidate.slice(0,start)+candidate.slice(end);
 candidate=candidate.replace('function socialComment(old, next, allowReplies)','function socialComment(old, next)')
  .replace("'text', 'timeAgo', 'replyToCommentId', 'replyToCommentIndex'])","'text', 'timeAgo'])")
  .replace("        (!added.keys().hasAny(['replyToCommentId', 'replyToCommentIndex']) || allowReplies) && validDiscussionReply(old, added) &&\n",'')
  .replace('socialComment(old, next, !market && !legacy))','socialComment(old, next))');
 assert.equal(candidate,base);
});
