// The retired web build must never be republished through the root firebase.json.
console.error('Retired website Hosting deployment is blocked. Use the reviewed Hosting-only legal-page release process; preserve Firebase auth helpers and app-link files.');
process.exitCode = 1;
