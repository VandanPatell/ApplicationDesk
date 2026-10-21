import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ensureProfileLinks} from '../src/profile-links.js';
import {defaultTemplates,defaultVariables} from '../src/defaults.js';
import {buildMailtoUrl} from '../../frontend/src/mailto.js';
const profileLinks={'portfolio-url':'https://example.com/portfolio','resume-url':'https://example.com/resume.pdf','github-url':'https://github.com/example'};
test('every default template renders the portfolio and resume links while keeping GitHub separate',()=>{
 for(const template of defaultTemplates){
  const body=template.body.replace(/\{\{\s*([\w-]+)\s*\}\}/g,(match,key)=>profileLinks[key]??match);
  assert.ok(body.includes(profileLinks['portfolio-url']),template.name);
  assert.ok(body.includes(profileLinks['resume-url']),template.name);
  assert.ok(body.includes('GitHub: '+profileLinks['github-url']),template.name);
 }
});
test('fresh-install candidate variables contain no personal defaults',()=>{assert.ok(Object.values(defaultVariables).every(value=>value===''));});
test('custom templates gain missing profile links without duplicating existing placeholders or literal URLs',()=>{
 const original='My custom introduction';const updated=ensureProfileLinks(original);
 assert.ok(updated.startsWith(original));assert.ok(updated.includes('{{portfolio-url}}'));assert.ok(updated.includes('{{resume-url}}'));
 assert.equal(ensureProfileLinks(updated),updated);
 const literal=`Portfolio: ${profileLinks['portfolio-url']}\nResume: ${profileLinks['resume-url']}`;
 assert.equal(ensureProfileLinks(literal),literal);
 assert.equal(ensureProfileLinks('{{ portfolio-url }}\n{{resume-url}}'),'{{ portfolio-url }}\n{{resume-url}}');
});
test('mail app URI preserves links, Unicode and punctuation, uses CRLF, and never claims to carry attachments',()=>{
 const body=`Hello team,\nPortfolio: ${profileLinks['portfolio-url']}\nResume: ${profileLinks['resume-url']}`;
 const url=buildMailtoUrl({to:' recruiter@example.com ',subject:'Application — Node.js & APIs',body,files:[{name:'resume.pdf'}]});
 const query=new URLSearchParams(url.split('?')[1]);
 assert.equal(decodeURIComponent(url.slice(7).split('?')[0]),'recruiter@example.com');
 assert.equal(query.get('subject'),'Application — Node.js & APIs');assert.equal(query.get('body'),body.replace(/\n/g,'\r\n'));
 assert.deepEqual([...query.keys()],['subject','body']);assert.ok(!url.includes('attachment='));
});
