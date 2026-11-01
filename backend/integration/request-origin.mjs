// Exercise the reported button routes with realistic browser Origin headers.
// Uses an isolated database and injected job sources, never real searches or applications.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import {Job,Template,Settings} from '../src/app.js';
import {CareerProfile,createCareerRouter} from '../src/career.js';
await mongoose.connect(process.env.MONGO_URI||'mongodb://mongo:27017/application-desk',{dbName:'origin-regression-'+crypto.randomUUID()});
let jobSearches=0,startupSearches=0;
const {router}=createCareerRouter({Job,Template,Settings,
 jobSearch:async()=>{jobSearches++;return [{externalId:'origin-regression-job',company:'Example',role:'React Developer',description:'React role',source:'Remotive',url:'https://example.com/job',tags:['React']}];},
 startupSearch:async()=>{startupSearches++;return [{externalId:'origin-regression-startup',company:'Startup example',role:'Developer',description:'React role',source:'Hacker News',url:'https://example.com/startup',tags:['React']}];}
});
const app=express();app.use(express.json());app.use('/api/career',router);app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.message}));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
async function post(path,origin,body,status){const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/career/'+path,{method:'POST',headers:{Origin:origin,'X-Requested-With':'ApplicationDesk','Content-Type':'application/json'},body:JSON.stringify(body)});const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;}
try{
 await CareerProfile.create({_id:'personal',data:{name:'Origin Test',summary:'I build web tools.',skills:['React'],experience:[],projects:[],education:[],publications:[],references:[]}});
 for(const origin of ['http://localhost:8080','http://127.0.0.1:8080','http://[::1]:8080']){
  const documents=await post('documents/generate',origin,{},201);assert.equal(documents.documents[0].kind,'resume');
  const jobs=await post('discover/search',origin,{provider:'remotive',query:'React'},200);assert.equal(jobs[0].data.company,'Example');
  const startups=await post('discover/search',origin,{provider:'hackerNews',query:'React'},200);assert.equal(startups[0].data.company,'Startup example');
 }
 assert.equal(jobSearches,3);assert.equal(startupSearches,3);
 await post('documents/generate','https://attacker.example',{},403);
 await post('discover/search','http://localhost:8081',{provider:'remotive'},403);
 assert.equal(jobSearches,3);
 console.log('PASS: Create base resume, Find jobs and Find startups succeed through localhost, 127.0.0.1 and IPv6 loopback origins; unrelated sites and wrong ports remain blocked. No real searches or user-data changes.');
}finally{await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();console.log('Disposable origin regression database removed.');}
