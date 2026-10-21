import {test} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {app} from '../src/app.js';
import {renderTemplate,validateJob} from '../src/domain.js';
test('templates replace repeated shared and job variables, retaining unresolved fields',()=>{assert.equal(renderTemplate('Hi {{candidate-name}} at {{ company-name }}: {{candidate-name}} {{missing}}',{'candidate-name':'Alex','company-name':'Acme'}),'Hi Alex at Acme: Alex {{missing}}');});
test('job validation checks required fields, statuses, dates and URLs',()=>{assert.ok(validateJob({company:'X'}));assert.ok(validateJob({company:'X',role:'Dev',status:'Invalid'}));assert.ok(validateJob({company:'X',role:'Dev',followUpAt:'bad'}));assert.ok(validateJob({company:'X',role:'Dev',url:'javascript:alert(1)'}));assert.equal(validateJob({company:'X',role:'Dev',status:'Applied',tags:['React']}),null);});
test('API rejects invalid input before database operations',async()=>{await request(app).post('/api/jobs').send({company:'X'}).expect(400);await request(app).post('/api/templates').send({}).expect(400);await request(app).put('/api/variables').send({'bad.key':'x'}).expect(400);});
test('work arrangements require a city for hybrid and on-site roles while supporting remote and legacy jobs',()=>{
 const job={company:'X',role:'Dev'};
 assert.equal(validateJob(job),null);
 assert.equal(validateJob({...job,workMode:'Remote'}),null);
 for(const workMode of ['Hybrid','On-site']){
  assert.ok(validateJob({...job,workMode,location:'  '}));
  assert.equal(validateJob({...job,workMode,location:'Bengaluru'}),null);
 }
 assert.ok(validateJob({...job,workMode:'Unknown'}));
});
