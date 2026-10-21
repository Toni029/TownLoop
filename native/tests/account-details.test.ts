import test from 'node:test';
import assert from 'node:assert/strict';
import {accountDetails,profileRequestText,profileChanges} from '../src/profile/model.ts';
const user={id:'resident',name:'Resident',email:'resident@example.invalid',phone:'123',address:'Unit 4',emergency_contact:'Jane',wing:'Old wing',dietaryPreference:'Old preference'};
test('account retains legacy contact name and reads new personal/contact fields without inventing values',()=>{
 const legacy=accountDetails(user);assert.equal(legacy.emergencyContactName,'Jane');assert.equal(legacy.emergencyContactPhone,'');
 const person={...user,date_of_birth:'1950-03-02',marital_status:'Married',emergency_contact_phone:'456',emergency_contact_address:'Main Street'};
 const details=accountDetails(person);assert.equal(details.dateOfBirth,'1950-03-02');assert.equal(details.maritalStatus,'Married');assert.equal(details.emergencyContactPhone,'456');assert.equal(details.emergencyContactAddress,'Main Street');
 const nested=accountDetails({...user,emergencyContact:{name:'John',phone:'789',address:'Oak Street'}} as unknown as typeof user);
 assert.equal(nested.emergencyContactName,'John');assert.equal(nested.emergencyContactPhone,'789');assert.equal(nested.emergencyContactAddress,'Oak Street');
});
test('update requests include the revised account fields and never request clearing removed settings',()=>{
 const current=accountDetails(user);
 const body=profileRequestText(user,{...current,dateOfBirth:'1950-03-02',maritalStatus:'Single',emergencyContactPhone:'456'});
 assert.match(body,/Date of Birth.*1950-03-02/);assert.match(body,/Marital Status.*Single/);assert.match(body,/Emergency Contact Phone.*456/);
 assert.doesNotMatch(body,/Wing|Dietary/);assert.equal(user.wing,'Old wing');
 assert.throws(()=>profileRequestText(user,current),/at least one/);
});

test('pending proposals contain only edited fields and cannot change account access',()=>{
 const input={...accountDetails(user),emergencyContactName:' Jane Smith ',emergencyContactPhone:'456',role:'admin'};
 assert.deepEqual(profileChanges(user,input),{emergencyContactName:'Jane Smith',emergencyContactPhone:'456'});
 assert.equal(user.emergency_contact,'Jane');
});
