import {test} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {app} from '../src/app.js';
import {isAllowedOrigin} from '../src/request-origin.js';

test('local dashboard origins allow loopback aliases only on the same scheme and port',()=>{
 for(const host of ['localhost','127.0.0.1','[::1]'])assert.equal(isAllowedOrigin(`http://${host}:8080`,'http://localhost:8080'),true);
 assert.equal(isAllowedOrigin('http://127.0.0.1:8080','http://localhost:8080/'),true);
 assert.equal(isAllowedOrigin('http://localhost:80','http://127.0.0.1'),true);
 for(const origin of ['http://localhost:8081','https://localhost:8080','https://attacker.example','http://localhost.attacker.example:8080','http://127.0.0.1.attacker.example:8080','http://localhost:8080/path','http://user@localhost:8080','null'])assert.equal(isAllowedOrigin(origin,'http://localhost:8080'),false,origin);
});

test('hosted deployments accept their configured origin without trusting arbitrary forwarded hosts',()=>{
 assert.equal(isAllowedOrigin('https://desk.example','https://desk.example/'),true);
 assert.equal(isAllowedOrigin('http://localhost:8080','https://desk.example'),false);
 assert.equal(isAllowedOrigin('https://other.example','https://desk.example'),false);
});

test('career buttons accept localhost and numeric loopback origins but reject cross-site requests',async()=>{
 const text='Company: Example\nRole: React Developer';
 for(const origin of ['http://localhost:8080','http://127.0.0.1:8080','http://[::1]:8080']){
  const response=await request(app).post('/api/career/posting/extract').set('X-Requested-With','ApplicationDesk').set('Origin',origin).send({text}).expect(200);
  assert.equal(response.body.company,'Example');assert.equal(response.body.role,'React Developer');
 }
 await request(app).post('/api/career/posting/extract').set('Origin','http://127.0.0.1:8080').send({text}).expect(403);
 await request(app).post('/api/career/posting/extract').set('X-Requested-With','ApplicationDesk').set('Origin','https://attacker.example').set('X-Forwarded-Host','localhost:8080').send({text}).expect(403);
});

test('Google sign-in explains its registered callback host instead of losing the state cookie',async()=>{
 const keys=['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','TOKEN_ENCRYPTION_KEY','APP_ORIGIN'],previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 try{
  process.env.GOOGLE_CLIENT_ID='fake-test-client';process.env.GOOGLE_CLIENT_SECRET='fake-test-secret';process.env.TOKEN_ENCRYPTION_KEY='a'.repeat(64);process.env.APP_ORIGIN='http://localhost:8080';
  const response=await request(app).post('/api/gmail/connect').set('X-Requested-With','ApplicationDesk').set('Origin','http://127.0.0.1:8080').send({}).expect(400);
  assert.match(response.body.error,/For Google sign-in, open http:\/\/localhost:8080/);
 }finally{for(const key of keys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
});
