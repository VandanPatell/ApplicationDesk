import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {fileURLToPath} from 'node:url';
const compiled=await build({entryPoints:[fileURLToPath(new URL('../src/main.jsx',import.meta.url))],bundle:true,write:false,format:'iife',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"test"'},logLevel:'silent'});
const code=compiled.outputFiles[0].text;
async function waitFor(check){for(let i=0;i<200;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,10));}assert.fail('Expected career workflow state was not reached');}
async function workspace(){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:8080',runScripts:'outside-only',pretendToBeVisual:true}),{window}=dom,document=window.document;
 window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};window.scrollTo=()=>{};
 const job={_id:'111111111111111111111111',company:'Example employer',role:'Web Developer',status:'Saved',tags:['React'],description:'React Kubernetes',replied:false,createdAt:new Date().toISOString()},profile={name:'Alex Example',headline:'Web Developer',email:'alex@example.com',summary:'I build internal tools.',skills:['React'],languages:['English'],experience:[{title:'Developer',organization:'Example',details:'Built a dashboard.'}],education:[],projects:[],publications:[],references:[],sectionOrder:['experience','projects','education','publications','references']};
 const themes=Array.from({length:12},(_,index)=>({name:index===0?'Classic':index===1?'Forest':'Theme '+index,color:index===1?'#315744':'#252525',font:'Times-Roman'}));
 let documents=[],attachments=[],preferences={theme:'light'},requests=[];
 window.fetch=async(path,options={})=>{
  const body=options.body?JSON.parse(options.body):null;requests.push({path,method:options.method||'GET',body});let data={};
  if(path==='/api/session')data={enabled:false};else if(path==='/api/jobs')data=[job];else if(path==='/api/templates')data=[];else if(path==='/api/variables')data={'candidate-name':profile.name,'candidate-email':profile.email};
  else if(path==='/api/career/profile')data={profile,strength:75};else if(path==='/api/career/capabilities')data={themes,ai:{configured:false},sources:{}};
  else if(path==='/api/career/interviews'||path==='/api/career/discover')data=[];
  else if(path==='/api/career/preferences'){if(body)preferences=body;data=preferences;}
  else if(path==='/api/career/match')data={score:50,matched:['React'],gaps:['Kubernetes'],method:'Keyword overlap'};
  else if(path.startsWith('/api/career/documents?'))data=documents;
  else if(path==='/api/career/documents/generate'){documents=(body.jobId?['resume','coverLetter','email']:['resume']).map((kind,index)=>({_id:'document-'+index,kind,title:'Example',jobId:body.jobId||null,content:kind==='email'?'Subject: A considered application\n\nA factual email draft':'Alex Example\n\nSUMMARY\n\nI build internal tools.',theme:'Classic',versions:[{content:'Original version',instruction:'From saved facts',createdAt:new Date().toISOString()}]}));data={documents,match:body.jobId?{score:50,matched:['React'],gaps:['Kubernetes'],method:'Keyword overlap'}:null};}
  else if(path.endsWith('/attach')){const file={_id:'attachment-'+attachments.length,name:'document.pdf',size:1000};attachments.push(file);data=file;}
  else if(path.startsWith('/api/career/documents/')&&options.method==='PUT'){const id=path.split('/').at(-1);documents=documents.map(doc=>doc._id===id?{...doc,...body}:doc);data=documents.find(doc=>doc._id===id);}
  else if(path==='/api/attachments')data=attachments;
  else if(path==='/api/gmail/status')data={configured:false,connected:false};else if(path==='/api/gmail/history')data=[];
  return {ok:true,status:200,json:async()=>data};
 };
 window.eval(code);await waitFor(()=>document.querySelector('h1')?.textContent.includes('Alex'));
 const named=name=>[...document.querySelectorAll('button')].find(element=>element.textContent.trim()===name);
 const click=element=>{assert.ok(element,'Control must exist');element.focus();element.dispatchEvent(new window.MouseEvent('click',{bubbles:true}));};
 return {dom,window,document,named,click,requests};
}
test('profile sections expose saved facts and the resume studio creates, themes and saves a document',async()=>{
 const app=await workspace();try{
  app.click(app.named('Profile'));await waitFor(()=>[...app.document.querySelectorAll('input')].some(input=>input.value==='Alex Example'));
  assert.ok([...app.document.querySelectorAll('input')].some(input=>input.value==='alex@example.com'));
  app.click(app.named('Experience1'));await waitFor(()=>app.document.querySelector('.profile-entry'));assert.match(app.document.querySelector('.profile-entry').textContent,/Developer/);
  app.click(app.named('Base resume'));await waitFor(()=>app.named('Create base resume'));app.click(app.named('Create base resume'));await waitFor(()=>app.document.querySelector('[aria-label="Document content"]'));
  assert.equal(app.document.querySelectorAll('.theme-grid button').length,12);
  app.click([...app.document.querySelectorAll('.theme-grid button')].find(button=>button.textContent.endsWith('Forest')));await waitFor(()=>app.document.querySelector('.document-toolbar>span').textContent==='Unsaved changes');
  app.click(app.named('Save'));await waitFor(()=>app.document.querySelector('.document-toolbar>span').textContent==='Saved');
  assert.ok(app.requests.some(request=>request.method==='PUT'&&request.body.theme==='Forest'));assert.match(app.document.querySelector('.document-downloads a').getAttribute('href'),/\/pdf$/);
 }finally{app.dom.window.close();}
});
test('tailored document workflow surfaces gaps and carries generated PDF attachments into Email studio',async()=>{
 const app=await workspace();try{
  app.click(app.document.querySelector('[aria-label="View details for Example employer — Web Developer"]'));await waitFor(()=>app.named('Resume, cover letter & fit'));
  app.click(app.named('Resume, cover letter & fit'));await waitFor(()=>app.named('Create tailored drafts'));app.click(app.named('Create tailored drafts'));
  await waitFor(()=>app.document.querySelectorAll('.document-tabs button').length===3);assert.match(app.document.querySelector('.match-panel').textContent,/Kubernetes/);
  app.click(app.named('Prepare email & PDFs'));await waitFor(()=>app.document.querySelector('.email-workspace'));
  await waitFor(()=>app.document.querySelectorAll('.attachment-row input:checked').length===2);
  assert.ok([...app.document.querySelectorAll('textarea')].some(element=>element.value==='A factual email draft'));
  assert.equal(app.document.body.style.overflow,'');
 }finally{app.dom.window.close();}
});
test('calendar, discovery, inbox, agent and settings are reachable and appearance changes persist',async()=>{
 const app=await workspace();try{
  for(const [label,selector] of [['Calendar','.month-grid'],['Find jobs','.discovery-search'],['Startups','.discovery-search'],['Agent','.agent-settings'],['Inbox','.inbox-page'],['Settings','.appearance-options']]){app.click(app.named(label));await waitFor(()=>app.document.querySelector(selector));}
  app.click(app.named('Dark'));await waitFor(()=>app.document.documentElement.dataset.theme==='dark');
  assert.ok(app.requests.some(request=>request.path==='/api/career/preferences'&&request.body?.theme==='dark'));
  assert.ok(app.document.querySelector('a[href="/api/career/backup"]'));
 }finally{app.dom.window.close();}
});
