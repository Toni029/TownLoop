const fs=require('node:fs');
const before=`    match /newsletters/{newsletterId} {
      allow read: if isApproved();
      allow write: if isManager();

      match /chunks/{chunkId} {
        allow read: if isApproved();
        allow write: if isManager();
      }
    }`;
const after=`    // Server-owned fences prevent late clients recreating discarded PDFs.
    function newsletterDraftFenced(id) {
      return exists(/databases/$(database)/documents/newsletter_draft_cleanup/$(id));
    }
    match /newsletter_draft_cleanup/{id} {
      allow read, write: if false;
    }
    match /newsletters/{newsletterId} {
      allow read: if isApproved();
      allow write: if isManager() && !newsletterDraftFenced(newsletterId) &&
        (newsletterId != 'current' || request.method == 'delete' ||
          !newsletterDraftFenced(request.resource.data.id));

      match /chunks/{chunkId} {
        allow read: if isApproved();
        allow write: if isManager() && !newsletterDraftFenced(newsletterId);
      }
    }`;
function patch(source){if(source.includes('newsletterDraftFenced')||source.split(before).length!==2)throw Error('Rules differ from the reviewed newsletter block. Stop and review; do not overwrite live rules.');return source.replace(before,after);}
module.exports={patch};
if(require.main===module){const [input,output]=process.argv.slice(2);if(!input||!output||input===output)throw Error('Provide a fresh read-only live-rules snapshot and a different output file.');fs.writeFileSync(output,patch(fs.readFileSync(input,'utf8')));console.log('Prepared only the newsletter fence patch. Nothing deployed.');}
