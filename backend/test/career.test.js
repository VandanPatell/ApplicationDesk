import {test} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import crypto from 'node:crypto';
import {cleanProfile,profileStrength,matchJob,extractPosting,createDraft,resumeThemes,makeCalendar} from '../src/career-domain.js';
import {pdfBuffer,askAI} from '../src/career-services.js';
import {app} from '../src/app.js';
test('profile normalization preserves facts and section order without adding experience',()=>{
 const profile=cleanProfile({name:' Alex ',skills:['React','Python'],sectionOrder:['projects','projects','bogus'],experience:[{title:'Engineer',organization:'Acme',details:'Built an internal tool.'}]});
 assert.equal(profile.name,'Alex');assert.deepEqual(profile.skills,['React','Python']);assert.equal(profile.sectionOrder[0],'projects');assert.equal(profile.sectionOrder.length,5);assert.equal(profile.experience[0].details,'Built an internal tool.');assert.ok(profileStrength(profile)>0);assert.equal(profileStrength(cleanProfile({})),0);
});
test('job matching distinguishes known skills, gaps, and unavailable scores',()=>{
 const result=matchJob(cleanProfile({skills:['React','Node.js']}),{role:'React Engineer',description:'React, Node.js and Kubernetes required'});
 assert.ok(result.matched.includes('React'));assert.ok(result.gaps.includes('Kubernetes'));assert.ok(!result.matched.includes('Java'));assert.equal(result.score,67);assert.equal(matchJob({},{}).score,null);const duplicates=matchJob(cleanProfile({skills:['react']}),{tags:['React','react','Follow-up','WhatsApp'],description:'React'});assert.equal(duplicates.score,100);assert.equal(duplicates.requirements.length,1);
});
test('posting capture extracts contact, role, work mode and skills for review',()=>{
 const result=extractPosting('Company: Acme\nRole: MERN Developer\nLocation: Pune\nHybrid. React and Node.js. Email hiring@example.com https://example.com/jobs/12');
 assert.equal(result.company,'Acme');assert.equal(result.role,'MERN Developer');assert.equal(result.workMode,'Hybrid');assert.equal(result.location,'Pune');assert.equal(result.email,'hiring@example.com');assert.ok(result.tags.includes('React'));
});
test('default tailoring uses profile facts and does not claim missing qualifications',()=>{
 const profile=cleanProfile({name:'Alex',email:'alex@example.com',skills:['React'],summary:'I build web interfaces.',website:'https://example.com',resumeUrl:'https://example.com/resume.pdf'});
 const draft=createDraft(profile,{company:'Acme',role:'Developer',description:'React and Kubernetes'},'Warm');
 assert.match(draft.resume,/Alex/);assert.match(draft.coverLetter,/web interfaces/);assert.ok(!draft.coverLetter.includes('Kubernetes'));assert.match(draft.email,/https:\/\/example.com\/resume.pdf/);assert.equal(resumeThemes.length,12);
});
test('PDF generation produces a real PDF and calendar exports escape user text',async()=>{
 const buffer=await pdfBuffer('Alex\n\nSUMMARY\n\nWeb developer',{theme:'Forest'});assert.equal(buffer.subarray(0,5).toString(),'%PDF-');assert.ok(buffer.length>500);
 const calendar=makeCalendar([{_id:'example',title:'Interview, team; call',notes:'Line one\nLine two',start:'2026-11-01T10:00:00Z',end:'2026-11-01T11:00:00Z'}]);assert.match(calendar,/Interview\\, team\\; call/);assert.match(calendar,/DTSTART:20261101T100000Z/);assert.match(calendar,/Line one\\nLine two/);
});
test('AI adapters use the configured model and transport without any real external request',async()=>{
 const names=['AI_PROVIDER','AI_BASE_URL','AI_MODEL','AI_API_KEY'],previous=Object.fromEntries(names.map(key=>[key,process.env[key]]));
 try{
  process.env.AI_PROVIDER='openai-compatible';process.env.AI_BASE_URL='https://provider.invalid/v1';process.env.AI_MODEL='test-model';process.env.AI_API_KEY='fake-test-key';
  let captured;
  const answer=await askAI('Use only profile facts','Test profile',{fetcher:async(url,options)=>{captured={url:String(url),headers:options.headers,body:JSON.parse(options.body)};return new Response(JSON.stringify({choices:[{message:{content:'A factual test draft'}}]}));}});
  assert.equal(answer,'A factual test draft');assert.equal(captured.url,'https://provider.invalid/v1/chat/completions');assert.equal(captured.body.model,'test-model');assert.equal(captured.body.messages[0].role,'system');
  process.env.AI_PROVIDER='anthropic';process.env.AI_BASE_URL='https://anthropic.invalid/v1';
  await askAI('Facts only','Test document',{fetcher:async(url,options)=>{captured={url:String(url),body:JSON.parse(options.body),headers:options.headers};return new Response(JSON.stringify({content:[{type:'text',text:'Revised test draft'}]}));}});
  assert.equal(captured.url,'https://anthropic.invalid/v1/messages');assert.equal(captured.body.system,'Facts only');assert.equal(captured.headers['x-api-key'],'fake-test-key');
 }finally{for(const key of names)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
});
test('career mutation routes reject cross-origin actions and missing confirmations before DB access',async()=>{
 await request(app).post('/api/career/documents/generate').send({}).expect(403);
 await request(app).post('/api/career/backup/restore').set('X-Requested-With','ApplicationDesk').send({}).expect(400);
 await request(app).post('/api/career/posting/extract').set('X-Requested-With','ApplicationDesk').send({text:'short'}).expect(400);
});
test('optional authentication rejects invalid passwords and tampered sessions',async()=>{
 const oldHash=process.env.APP_PASSWORD_HASH,oldSecret=process.env.APP_SESSION_SECRET,salt='test-salt';
 process.env.APP_PASSWORD_HASH='scrypt$'+salt+'$'+crypto.scryptSync('correct-test-password',salt,32).toString('hex');process.env.APP_SESSION_SECRET='a'.repeat(64);
 try{
  await request(app).get('/api/jobs').expect(401);
  await request(app).post('/api/session').send({password:'wrong'}).expect(401);
  const signed=await request(app).post('/api/session').send({password:'correct-test-password'}).expect(200);
  const cookie=signed.headers['set-cookie'][0].split(';')[0];const status=await request(app).get('/api/session').set('Cookie',cookie).expect(200);assert.equal(status.body.authenticated,true);
  await request(app).get('/api/jobs').set('Cookie',cookie+'tampered').expect(401);
 }finally{if(oldHash===undefined)delete process.env.APP_PASSWORD_HASH;else process.env.APP_PASSWORD_HASH=oldHash;if(oldSecret===undefined)delete process.env.APP_SESSION_SECRET;else process.env.APP_SESSION_SECRET=oldSecret;}
});
