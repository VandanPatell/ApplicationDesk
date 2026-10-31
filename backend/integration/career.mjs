import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {app,Job,Template,Settings} from '../src/app.js';
import {CareerProfile,CareerPreferences,CareerDocument,Interview,Discovery} from '../src/career.js';
import {Attachment,SentEmail} from '../src/mail.js';
await mongoose.connect(process.env.MONGO_URI||'mongodb://mongo:27017/application-desk',{dbName:'career-test-'+crypto.randomUUID()});
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
async function api(path,method='GET',body,status=200){const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/'+path,{method,headers:{'X-Requested-With':'ApplicationDesk',...(!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
try{
 await Job.init();const person={name:'Career Test',headline:'Web Developer',email:'career@example.com',skills:['React','Node.js'],summary:'I build internal tools.',website:'https://example.com',resumeUrl:'https://example.com/resume.pdf',experience:[{title:'Developer',organization:'Example',period:'2024–2026',details:'Built an internal dashboard.'}]};
 await api('career/profile','PUT',person);assert.equal((await api('career/profile')).profile.name,person.name);
 const form=new FormData();form.append('file',new Blob(['Career Test\ncareer@example.com\nReact developer']), 'resume.md');assert.match((await api('career/profile/import','POST',form)).text,/React developer/);
 const job=await api('jobs','POST',{company:'Example employer',role:'React Developer',description:'React, Node.js and Kubernetes',status:'Saved'},201);
 const generated=await api('career/documents/generate','POST',{jobId:job._id},201);assert.equal(generated.documents.length,3);assert.ok(generated.match.gaps.includes('Kubernetes'));
 let doc=generated.documents.find(item=>item.kind==='resume');const original=doc.content;
 doc=await api('career/documents/'+doc._id,'PUT',{content:doc.content+'\n\nManual note',theme:'Forest'});assert.equal(doc.versions.length,2);
 doc=await api('career/documents/'+doc._id+'/restore','POST',{index:0});assert.equal(doc.content,original);assert.equal(doc.versions.length,3);
 const pdf=await fetch('http://127.0.0.1:'+server.address().port+'/api/career/documents/'+doc._id+'/pdf');assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
 const attachment=await api('career/documents/'+doc._id+'/attach','POST',{},201);assert.ok(attachment.size>500);
 await api('career/interviews','POST',{title:'Interview',jobId:job._id,start:'2026-11-01T11:00:00Z',end:'2026-11-01T10:00:00Z'},400);
 const event=await api('career/interviews','POST',{title:'Technical interview',jobId:job._id,start:'2026-11-01T10:00:00Z',end:'2026-11-01T11:00:00Z'},201);assert.equal((await api('career/interviews')).length,1);
 await api('jobs/'+job._id,'PUT',{...job,status:'Interview'});assert.equal((await Job.findById(job._id)).statusHistory[0].status,'Interview');
 await Template.create({name:'Backed up starter',defaultKey:'common-starter',body:'Backed up text'});await Discovery.create({externalId:'common-posting',data:{company:'Example',role:'Developer'}});
 const exported=await api('career/backup');assert.equal(exported.documents.length,3);assert.equal(exported.attachments.length,1);assert.equal(exported.attachments[0].size,Buffer.from(exported.attachments[0].data,'base64').length);assert.ok(!JSON.stringify(exported).includes('credentials'));
 const preview=await api('career/backup/preview','POST',exported);assert.equal(preview.report.jobs.existing,1);
 await Job.updateOne({_id:job._id},{notes:'Keep current changes'});await CareerDocument.deleteMany({});await Attachment.deleteMany({});await Interview.deleteMany({});await Template.deleteMany({});await Template.create({name:'Keep fresh workspace template',defaultKey:'common-starter',body:'Do not overwrite'});await Discovery.deleteMany({});await Discovery.create({externalId:'common-posting',data:{company:'Keep current posting',role:'Developer'}});
 const restored=await api('career/backup/restore','POST',{confirmed:true,backup:exported});assert.equal(restored.restored.documents,3);assert.equal(restored.restored.templates,0);assert.equal(restored.restored.discoveries,0);assert.equal((await Template.findOne({defaultKey:'common-starter'})).name,'Keep fresh workspace template');assert.equal(restored.restored.attachments,1);assert.equal((await Job.findById(job._id)).notes,'Keep current changes');
 assert.equal((await Attachment.findById(attachment._id).select('+data')).data.length,attachment.size);assert.equal((await CareerDocument.findById(doc._id)).versions.length,3);
 await api('career/backup/restore','POST',{confirmed:true,backup:exported});assert.equal(await CareerDocument.countDocuments(),3);
 await api('career/interviews/'+event._id,'DELETE');assert.equal(await Interview.countDocuments(),0);
 console.log('PASS: profile import/CRUD, factual drafts, matching, revisions/restore, real PDFs/attachments, interviews, status history, complete backup preview, safe merge restore and idempotency.');
}finally{await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();console.log('Disposable career database removed.');}
