// Uses a disposable database and fake Google transport. Never sends real mail.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import express from 'express';
import {createMailRouter,GmailAccount,Attachment,SentEmail} from '../src/mail.js';
import {encrypt,decrypt} from '../src/mail-utils.js';
const original=process.env.MONGO_URI||'mongodb://mongo:27017/application-desk';
const dbName='application-desk-mail-test-'+crypto.randomUUID();
process.env.GOOGLE_CLIENT_ID='test-client';process.env.GOOGLE_CLIENT_SECRET='test-secret';
process.env.TOKEN_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');process.env.APP_ORIGIN='http://localhost:8080';
await mongoose.connect(original,{dbName});
const Job=mongoose.model('MailTestJob',new mongoose.Schema({company:String,status:String,appliedAt:Date}));
await SentEmail.init();
let deliveryCount=0,mode='success',lastRaw='';
const tokens={access_token:'fake-access',refresh_token:'fake-refresh',id_token:'fake-id',scope:'openid email https://www.googleapis.com/auth/gmail.send'};
const oauthFactory=()=>({
 credentials:{},generateCodeVerifierAsync:async()=>({codeVerifier:'verifier',codeChallenge:'challenge'}),
 generateAuthUrl:args=>'https://accounts.google.com/o/oauth2/v2/auth?state='+args.state,
 getToken:async()=>({tokens}),verifyIdToken:async()=>({getPayload:()=>({email:'sender@example.com',email_verified:true})}),
 setCredentials(value){this.credentials=value;},getAccessToken:async()=>({token:'fake-access'}),revokeCredentials:async()=>({})
});
const googleFetch=async(url,options)=>{deliveryCount++;lastRaw=JSON.parse(options.body).raw;if(mode==='timeout')throw Error('Network timeout');if(mode==='rejected')return new Response('{}',{status:403});return new Response(JSON.stringify({id:'fake-message-'+deliveryCount}),{status:200});};
const app=express();app.use(express.json());app.use('/api',createMailRouter({Job,oauthFactory,googleFetch}));
app.use((err,req,res,next)=>res.status(500).json({error:err.message}));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:'+server.address().port;
async function call(path,method='GET',data,expected=200){const form=data instanceof FormData;const response=await fetch(base+'/api/'+path,{method,headers:{'X-Requested-With':'ApplicationDesk',...(!form?{'Content-Type':'application/json'}:{})},...(data!==undefined?{body:form?data:JSON.stringify(data)}:{})});assert.equal(response.status,expected,await response.clone().text());return response.json();}
try{
 // Callback cannot connect without the browser-bound OAuth cookie.
 let connect=await fetch(base+'/api/gmail/connect',{method:'POST',headers:{'X-Requested-With':'ApplicationDesk'}});
 let state=new URL((await connect.json()).url).searchParams.get('state');
 const invalid=await fetch(base+'/api/gmail/callback?state='+state+'&code=fake',{redirect:'manual'});assert.equal(invalid.headers.get('location'),'/?gmail=invalid-state');
 connect=await fetch(base+'/api/gmail/connect',{method:'POST',headers:{'X-Requested-With':'ApplicationDesk'}});
 const cookie=connect.headers.get('set-cookie').split(';')[0];state=new URL((await connect.json()).url).searchParams.get('state');
 const callback=await fetch(base+'/api/gmail/callback?state='+state+'&code=fake',{headers:{cookie},redirect:'manual'});assert.equal(callback.headers.get('location'),'/?gmail=connected');
 const account=await GmailAccount.findById('personal');assert.equal(decrypt(account.credentials,process.env.TOKEN_ENCRYPTION_KEY).refresh_token,'fake-refresh');assert.ok(!account.credentials.includes('fake-refresh'));
 assert.equal((await call('gmail/status')).connected,true);
 const fileBytes=Buffer.from('%PDF-1.4 integration resume');const form=new FormData();form.append('file',new Blob([fileBytes],{type:'application/pdf'}),'Resume.pdf');
 const file=await call('attachments','POST',form,201);assert.equal(file.size,fileBytes.length);
 const metadata=await call('attachments');assert.equal(metadata[0].data,undefined);
 const downloaded=await fetch(base+'/api/attachments/'+file._id+'/download');assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),fileBytes);
 const job=await Job.create({company:'Test',status:'Saved'});
 const draft={from:'sender@example.com',to:'recruiter@example.com',subject:'Application — Vandan',body:'Hello team, this is a test.',attachmentIds:[file._id],requestId:crypto.randomUUID(),confirmed:true,jobId:String(job._id),markApplied:true};
 await call('gmail/send','POST',{...draft,from:'different@example.com'},409);assert.equal(deliveryCount,0);
 await call('gmail/send','POST',{...draft,confirmed:false},400);assert.equal(deliveryCount,0);
 const sent=await call('gmail/send','POST',draft);assert.equal(sent.record.state,'sent');assert.equal(deliveryCount,1);
 assert.ok(Buffer.from(lastRaw,'base64url').toString().includes(fileBytes.toString('base64')));
 assert.equal((await Job.findById(job._id)).status,'Applied');assert.ok((await Job.findById(job._id)).appliedAt);
 const duplicate=await call('gmail/send','POST',draft);assert.equal(duplicate.duplicate,true);assert.equal(deliveryCount,1);
 mode='timeout';const uncertain={...draft,requestId:crypto.randomUUID()};await call('gmail/send','POST',uncertain,502);await call('gmail/send','POST',uncertain,409);assert.equal(deliveryCount,2);
 assert.equal((await SentEmail.findOne({requestId:uncertain.requestId})).state,'unknown');
 mode='rejected';const rejected={...draft,requestId:crypto.randomUUID()};await call('gmail/send','POST',rejected,502);assert.equal((await SentEmail.findOne({requestId:rejected.requestId})).state,'failed');
 assert.equal((await call('gmail/history')).length,3);
 await call('attachments/'+file._id,'DELETE');assert.equal((await call('attachments')).length,0);
 await call('gmail/disconnect','POST',{});assert.equal((await call('gmail/status')).connected,false);
 console.log('PASS: OAuth state/cookie binding, encrypted tokens, upload/download, MIME bytes, reviewed send, tracking, duplicate prevention, uncertain/rejected outcomes, history, and disconnect. No Google requests or real emails.');
}finally{
 await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();
 console.log('Disposable mail test database removed.');
}
