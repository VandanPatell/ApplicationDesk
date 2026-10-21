import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import {app} from '../src/app.js';
import {encrypt,decrypt,createRawMessage,validateDraft} from '../src/mail-utils.js';
const valid={to:'person@example.com',subject:'Application',body:'Hello, I am interested.',attachmentIds:[],requestId:crypto.randomUUID(),confirmed:true};
test('OAuth credentials encrypt, authenticate, and reject a different key',()=>{
 const key=crypto.randomBytes(32).toString('hex'),tokens={refresh_token:'private-token'};
 const sealed=encrypt(tokens,key);assert.ok(!sealed.includes('private-token'));assert.deepEqual(decrypt(sealed,key),tokens);
 assert.throws(()=>decrypt(sealed,crypto.randomBytes(32).toString('hex')));
 const pieces=sealed.split('.');pieces[2]=(parseInt(pieces[2].slice(0,2),16)^255).toString(16).padStart(2,'0')+pieces[2].slice(2);assert.throws(()=>decrypt(pieces.join('.'),key));
});
test('sending requires confirmation and rejects header injection, missing fields, duplicate attachments and unresolved placeholders',()=>{
 assert.equal(validateDraft(valid),null);
 for(const change of [{confirmed:false},{to:'a@example.com\r\nBcc: other@example.com'},{subject:'Hi\nBcc: x'},{body:'Hello {{candidate-name}}'},{requestId:'bad'},{attachmentIds:['bad']},{attachmentIds:['a'.repeat(24),'a'.repeat(24)]}])assert.ok(validateDraft({...valid,...change}));
});
test('MIME includes Unicode text and real attachment bytes without file or URL access',async()=>{
 const bytes=Buffer.from('%PDF-1.4 example');
 const raw=await createRawMessage({from:'me@example.com',...valid,subject:'Application — Vandan',body:'Hello team,\nRegards, Vandan',attachments:[{name:'Resume.pdf',mimeType:'application/pdf',data:bytes}]});
 const mime=Buffer.from(raw,'base64url').toString();
 assert.match(mime,/multipart\/mixed/);assert.match(mime,/filename=Resume.pdf/);assert.ok(mime.includes(bytes.toString('base64')));assert.ok(!mime.includes('{{'));assert.ok(!/[+/=]/.test(raw));
});
test('mail routes reject cross-origin actions and explain missing OAuth configuration',async()=>{
 await request(app).post('/api/gmail/send').send(valid).expect(403);
 await request(app).post('/api/gmail/connect').set('X-Requested-With','ApplicationDesk').set('Origin','https://untrusted.example').expect(403);
 await request(app).post('/api/gmail/connect').set('X-Requested-With','ApplicationDesk').expect(503);
 await request(app).post('/api/gmail/send').set('X-Requested-With','ApplicationDesk').send({...valid,confirmed:false}).expect(400);
 await request(app).post('/api/attachments').set('X-Requested-With','ApplicationDesk').expect(400);
});
