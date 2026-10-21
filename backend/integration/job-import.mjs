// Real HTTP/Excel/MongoDB integration, isolated from personal applications.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFile} from 'node:fs/promises';
import mongoose from 'mongoose';
import {readJobWorkbook} from '../src/job-import.js';
import {app,Job} from '../src/app.js';
import {JobImportBatch} from '../src/job-import-routes.js';
const dbName='app-import-test-'+crypto.randomUUID();
await mongoose.connect(process.env.MONGO_URI||'mongodb://mongo:27017/application-desk',{dbName});await Job.init();
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:'+server.address().port+'/api/job-import/';
const fixture=await readFile(new URL('./fixtures/job-import.xlsx',import.meta.url));
async function call(path,data,expected=200){const form=data instanceof FormData;const response=await fetch(base+path,{method:'POST',headers:{'X-Requested-With':'ApplicationDesk',...(!form?{'Content-Type':'application/json'}:{})},body:form?data:JSON.stringify(data)});assert.equal(response.status,expected,await response.clone().text());return response.json();}
function upload(name='jobs.xlsx'){const form=new FormData();form.append('file',new Blob([fixture],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),name);return form;}
try{
 const download=await fetch(base+'template');assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/Application-Desk-Import-Template.xlsx/);
 const template=await readJobWorkbook(Buffer.from(await download.arrayBuffer()));
 assert.equal(template.getWorksheet('Applications').getCell('A1').value,'Company name');assert.equal(template.getWorksheet('Applications').getCell('C2').dataValidation.type,'list');assert.ok(template.getWorksheet('Guide'));
 await call('preview',upload('old-format.xls'),400);
 const preview=await call('preview',upload());assert.deepEqual(preview.rows.map(r=>r.state),['ready','duplicate','invalid','ready','invalid','invalid']);assert.equal(await Job.countDocuments(),0);
 await call('commit',{batchId:preview.batchId,selectedRows:[4]},400);
 // A job added after preview must still be detected at commit, not overwritten.
 const existing=await Job.create({company:'Import fixture C',role:'Remote Developer',workMode:'Remote',location:'',notes:'Preserve this existing note'});
 const result=await call('commit',{batchId:preview.batchId,selectedRows:[2,5]});assert.equal(result.imported,1);assert.equal(result.duplicates,1);assert.equal(result.failed,0);assert.equal(await Job.countDocuments(),2);
 const imported=await Job.findOne({company:'Import fixture A'});assert.equal(imported.replied,true);assert.equal(imported.appliedAt.toISOString().slice(0,10),'2026-10-20');assert.deepEqual([...imported.tags],['Node.js','MongoDB']);
 assert.equal((await Job.findById(existing._id)).notes,'Preserve this existing note');
 const replay=await call('commit',{batchId:preview.batchId,selectedRows:[2,5]});assert.deepEqual(replay,result);assert.equal(await Job.countDocuments(),2);
 const repeat=await call('preview',upload());assert.equal(repeat.rows.filter(r=>r.state==='ready').length,0);assert.equal(repeat.rows.filter(r=>r.state==='duplicate').length,3);
 await JobImportBatch.updateOne({_id:preview.batchId},{expiresAt:new Date(Date.now()-1000)});await call('commit',{batchId:preview.batchId,selectedRows:[2]},400);
 console.log('PASS: template download/dropdowns, .xlsx preview, invalid rows/formulas, explicit row selection, commit-time duplicate detection, preserved existing data, date/tag/reply persistence, idempotent retry, repeat upload, and preview expiry.');
}finally{await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();console.log('Disposable import test database removed.');}
