// Disposable database and mocked Google transport. No real Google calls, permissions or messages.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import {Job} from '../src/app.js';
import {Interview} from '../src/career.js';
import {createMailRouter,GmailAccount} from '../src/mail.js';
import {encrypt} from '../src/mail-utils.js';
process.env.GOOGLE_CLIENT_ID='test-client';process.env.GOOGLE_CLIENT_SECRET='test-secret';process.env.TOKEN_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');
await mongoose.connect(process.env.MONGO_URI||'mongodb://mongo:27017/application-desk',{dbName:'google-career-test-'+crypto.randomUUID()});
let requestedScopes=[],requests=0,posts=0;
const send='https://www.googleapis.com/auth/gmail.send',read='https://www.googleapis.com/auth/gmail.readonly',calendar='https://www.googleapis.com/auth/calendar.events';
const oauthFactory=()=>({credentials:{},setCredentials(value){this.credentials=value;},getAccessToken:async()=>({token:'fake'}),generateCodeVerifierAsync:async()=>({codeVerifier:'verifier',codeChallenge:'challenge'}),generateAuthUrl(args){requestedScopes=args.scope;return 'https://accounts.google.com/?state='+args.state;}});
const start=new Date(Date.now()+86400000).toISOString(),end=new Date(Date.now()+90000000).toISOString();
const remoteEvents=new Map([['external-event',{id:'external-event',summary:'Remote interview',start:{dateTime:start},end:{dateTime:end},updated:new Date().toISOString()}]]);
const googleFetch=async(value,options={})=>{
 requests++;const url=String(value),method=options.method||'GET';let data;
 if(url.includes('gmail/v1/users/me/messages?'))data={messages:[{id:'message-1'}]};
 else if(url.includes('gmail/v1/users/me/messages/message-1'))data={id:'message-1',internalDate:String(Date.now()),snippet:'Please join an interview.',payload:{mimeType:'text/plain',headers:[{name:'From',value:'Recruiter <recruiter@example.com>'},{name:'Subject',value:'Interview invitation'}],body:{data:Buffer.from('Please join an interview.').toString('base64url')}}};
 else if(url.includes('/calendar/v3/')&&method==='GET')data={items:[...remoteEvents.values()]};
 else if(url.includes('/calendar/v3/')){const body=JSON.parse(options.body);const id=method==='POST'?'uploaded-'+(++posts):decodeURIComponent(url.split('/').at(-1));data={...body,id,updated:new Date().toISOString()};remoteEvents.set(id,data);}
 else throw Error('Unexpected Google endpoint: '+url);
 return new Response(JSON.stringify(data),{status:200});
};
const app=express();app.use(express.json());app.use('/api',createMailRouter({Job,oauthFactory,googleFetch}));app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.message}));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
async function call(path,method='GET',body,status=200){const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/'+path,{method,headers:{'X-Requested-With':'ApplicationDesk','Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
try{
 await GmailAccount.create({_id:'personal',credentials:encrypt({scope:send,refresh_token:'fake-refresh'},process.env.TOKEN_ENCRYPTION_KEY)});
 await call('gmail/inbox','GET',undefined,400);await call('google/calendar/sync','POST',{},400);assert.equal(requests,0);
 await call('gmail/connect','POST',{readInbox:true,calendar:true});assert.ok(requestedScopes.includes(read));assert.ok(requestedScopes.includes(calendar));
 await GmailAccount.updateOne({_id:'personal'},{credentials:encrypt({scope:[send,read,calendar].join(' '),refresh_token:'fake-refresh'},process.env.TOKEN_ENCRYPTION_KEY)});
 const job=await Job.create({company:'Example',role:'Developer',email:'recruiter@example.com'});
 const messages=await call('gmail/inbox');assert.equal(String(messages[0].jobId),String(job._id));assert.equal(messages[0].body,'Please join an interview.');
 await call('gmail/inbox/message-1/link','POST',{jobId:job._id});await call('gmail/inbox/message-1/link','POST',{jobId:job._id});const linked=await Job.findById(job._id);assert.equal(linked.replied,true);assert.equal(linked.timeline.length,1);await Job.updateOne({_id:job._id},{replied:false});await call('gmail/inbox/message-1/link','POST',{jobId:job._id});assert.equal((await Job.findById(job._id)).replied,true);assert.equal((await Job.findById(job._id)).timeline.length,1);
 const local=await Interview.create({title:'Local interview',start,end,jobId:job._id});
 const synced=await call('google/calendar/sync','POST',{});assert.equal(synced.pulled,1);assert.equal(synced.pushed,1);assert.equal(await Interview.countDocuments(),2);
 const repeated=await call('google/calendar/sync','POST',{});assert.equal(repeated.pushed,0);assert.equal(await Interview.countDocuments(),2);
 remoteEvents.get('external-event').summary='Edited in Google';remoteEvents.get('external-event').updated=new Date(Date.now()+1000).toISOString();await call('google/calendar/sync','POST',{});assert.equal((await Interview.findOne({googleId:'external-event'})).title,'Edited in Google');
 await Interview.updateOne({_id:local._id},{title:'Edited locally',googleSyncedAt:new Date(0)});await call('google/calendar/sync','POST',{});assert.equal(remoteEvents.get('uploaded-1').summary,'Edited locally');
 console.log('PASS: opt-in scope requests, send-only scope preservation, inbox matching, idempotent reply linking, calendar import/export, repeat synchronization, and edits in both directions. No real Google requests.');
}finally{await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();console.log('Disposable Google career database removed.');}
