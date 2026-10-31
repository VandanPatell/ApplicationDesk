import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

import {app,Job} from '../src/app.js';
await mongoose.connect(process.env.MONGO_URI||'mongodb://mongo:27017/application-desk',{dbName:'timeline-test-'+crypto.randomUUID()});
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const request=()=>Object.fromEntries(['post','put','delete'].map(method=>[method,path=>{let body;const chain={send(value){body=value;return chain;},async expect(status){const response=await fetch('http://127.0.0.1:'+server.address().port+path,{method:method.toUpperCase(),headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return {body:data};}};return chain;}]));
try{
 const base={company:'Timeline test',role:'Developer',status:'Applied',replied:false};
 const created=await request(app).post('/api/jobs').send(base).expect(201);const id=created.body._id;
 await request(app).post(`/api/jobs/${id}/timeline`).send({body:'Call',occurredAt:new Date().toISOString()}).expect(409);
 const stale=(await request(app).put(`/api/jobs/${id}`).send({...base,replied:true}).expect(200)).body;
 for(const body of ['', ' '.repeat(5), 'a'.repeat(5001)])await request(app).post(`/api/jobs/${id}/timeline`).send({body,occurredAt:new Date().toISOString()}).expect(400);
 await request(app).post(`/api/jobs/${id}/timeline`).send({body:'Invalid date',occurredAt:'bad'}).expect(400);
 await Promise.all(['First call','Interview scheduled'].map(body=>request(app).post(`/api/jobs/${id}/timeline`).send({body,occurredAt:'2026-10-30T10:00:00+05:30'}).expect(201)));
 let saved=(await request(app).put(`/api/jobs/${id}`).send({...stale,notes:'Updated general notes',timeline:[]}).expect(200)).body;
 assert.equal(saved.timeline.length,2);assert.equal(saved.timeline[0].occurredAt,'2026-10-30T04:30:00.000Z');
 saved=(await request(app).put(`/api/jobs/${id}`).send({...saved,replied:false}).expect(200)).body;assert.equal(saved.timeline.length,2);
 const other=await Job.create({company:'Keep me',role:'Developer'});
 await request(app).delete(`/api/jobs/${id}`).expect(200);assert.equal(await Job.findById(id),null);assert.ok(await Job.findById(other._id));
 await request(app).delete(`/api/jobs/${id}`).expect(404);
 await request(app).post(`/api/jobs/${id}/timeline`).send({body:'Missing',occurredAt:new Date().toISOString()}).expect(404);
 console.log('PASS: reply gating, note validation, concurrent appends, timezone persistence, stale-update protection, retained timeline after unflagging, and isolated application deletion.');
}finally{await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();console.log('Disposable timeline database removed.');}
