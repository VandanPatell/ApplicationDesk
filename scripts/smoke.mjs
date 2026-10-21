import assert from 'node:assert/strict';
const base=process.env.APP_URL||'http://localhost:8080';
async function api(path,method='GET',body){const response=await fetch(base+'/api/'+path,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.ok(response.ok,`${method} ${path}: ${response.status}`);return response.json();}
let job,template;
try{
 assert.equal((await api('health')).ready,true);
 job=await api('jobs','POST',{company:'Smoke test (temporary)',role:'MERN developer',tags:['React','Node.js'],source:'WhatsApp',status:'Applied',appliedAt:new Date().toISOString(),followUpAt:new Date().toISOString(),email:'test@example.com'});
 assert.ok(job._id);
 assert.ok((await api('jobs')).some(j=>j._id===job._id));
 job=await api('jobs/'+job._id,'PUT',{...job,status:'Interview',replied:true,workMode:'Hybrid',location:'Bengaluru'});
 const persisted=(await api('jobs')).find(j=>j._id===job._id);
 assert.equal(persisted.replied,true);assert.equal(persisted.status,'Interview');
 assert.equal(persisted.workMode,'Hybrid');assert.equal(persisted.location,'Bengaluru');
 const invalidCity=await fetch(base+'/api/jobs/'+job._id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...job,location:''})});
 assert.equal(invalidCity.status,400);
 job=await api('jobs/'+job._id,'PUT',{...job,workMode:'Remote',location:''});
 const remote=(await api('jobs')).find(j=>j._id===job._id);
 assert.equal(remote.workMode,'Remote');assert.equal(remote.location,'');
 template=await api('templates','POST',{name:'Smoke test (temporary)',subject:'Hello {{candidate-name}}',body:'Application to {{company-name}}'});
 template=await api('templates/'+template._id,'PUT',{...template,name:'Smoke test updated'});
 assert.equal((await api('templates')).find(t=>t._id===template._id).name,'Smoke test updated');
 const variables=await api('variables');assert.equal(typeof variables,'object');
 console.log('PASS: service health, job creation/update/reload, reply flags, template creation/update/reload, variable retrieval');
}finally{
 if(job)await api('jobs/'+job._id,'DELETE');
 if(template)await api('templates/'+template._id,'DELETE');
}
if(job)assert.ok(!(await api('jobs')).some(j=>j._id===job._id));
if(template)assert.ok(!(await api('templates')).some(t=>t._id===template._id));
console.log('PASS: test records deleted and deletion verified');
