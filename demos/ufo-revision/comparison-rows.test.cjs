const assert=require('node:assert/strict');
const {align}=require('./comparison-rows.js');
const a=['相同的开头','要删除的整段','相同的中段','相同的末段'];
const b=['相同的开头','相同的中段','插入的新段','相同的末段'];
assert.deepEqual(align(a,b),[
 {before:a[0],after:b[0],kind:'same'},
 {before:a[1],after:null,kind:'removed'},
 {before:a[2],after:b[1],kind:'same'},
 {before:null,after:b[2],kind:'added'},
 {before:a[3],after:b[3],kind:'same'}
]);
assert.deepEqual(align([],[]),[]);
console.log('PASS: whole-paragraph deletion/insertion each reserve the other column, unchanged starts remain paired.');
