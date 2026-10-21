import {readFile} from 'node:fs/promises';
import {basename} from 'node:path';
import assert from 'node:assert/strict';
const path=process.argv[2];if(!path)throw Error('Usage: node scripts/import-resume.mjs <resume.pdf>');
const base=process.env.APP_URL||'http://localhost:8080',bytes=await readFile(path),name=basename(path);
if(bytes.length>10*1024*1024)throw Error('Resume exceeds 10 MB.');
const listResponse=await fetch(base+'/api/attachments');assert.ok(listResponse.ok);const list=await listResponse.json();
let duplicate=false;
for(const file of list.filter(f=>f.name===name&&f.size===bytes.length)){
 const response=await fetch(base+'/api/attachments/'+file._id+'/download');
 if(response.ok&&Buffer.from(await response.arrayBuffer()).equals(bytes)){duplicate=true;break;}
}
if(duplicate)console.log('Resume already exists in the local attachment library.');
else{
 const form=new FormData();form.append('file',new Blob([bytes],{type:'application/pdf'}),name);
 const response=await fetch(base+'/api/attachments',{method:'POST',headers:{'X-Requested-With':'ApplicationDesk'},body:form});
 if(!response.ok)throw Error('Resume upload failed: '+response.status);
 const result=await response.json();assert.equal(result.size,bytes.length);console.log('Resume added to local attachment library. No email was sent.');
}
