import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {fileURLToPath} from 'node:url';

// Run the actual application against a disposable in-memory API, without a browser or MongoDB.
const compiled=await build({entryPoints:[fileURLToPath(new URL('../src/main.jsx',import.meta.url))],bundle:true,write:false,format:'iife',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"test"'},logLevel:'silent'});
const code=compiled.outputFiles[0].text;
async function waitFor(check){for(let i=0;i<150;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,10));}assert.fail('UI did not reach the expected state');}
async function workspace({board=false,fail=false,missing=false}={}){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:8080',runScripts:'outside-only',pretendToBeVisual:true});
 const {window}=dom;let deleted=0;
 window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 window.scrollTo=()=>{};
 window.confirm=()=>{assert.fail('Native confirmations must not be used');};
 if(board)window.localStorage.setItem('application-view','board');
 const job={_id:'test-application',company:'Disposable company',role:'Developer',tags:[],status:'Applied',replied:true};
 window.fetch=async(path,options={})=>{
  if(options.method==='DELETE'){deleted++;return {ok:!fail&&!missing,status:fail?500:missing?404:200,json:async()=>fail?{error:'Test deletion failed'}:{ok:true}};}
  return {ok:true,json:async()=>path==='/api/jobs'?[job]:path==='/api/templates'?[]:{}};
 };
 window.eval(code);await waitFor(()=>window.document.querySelector('[aria-label="View details for Disposable company — Developer"]'));
 const document=window.document;
 const click=element=>{assert.ok(element,'Expected control exists');element.focus();element.dispatchEvent(new window.MouseEvent('click',{bubbles:true}));};
 const named=name=>[...document.querySelectorAll('button')].find(element=>element.textContent.trim()===name);
 const label=value=>document.querySelector(`[aria-label="${value}"]`);
 return {dom,window,document,click,named,label,get deleted(){return deleted;}};
}

test('deleting from details closes every modal, unlocks scrolling, and returns to the remembered board',async()=>{
 const app=await workspace({board:true});try{
  app.click(app.named('Applications1'));await waitFor(()=>app.named('Kanban'));
  app.click(app.label('View Disposable company — Developer'));await waitFor(()=>app.document.querySelector('.application-details-modal'));
  assert.equal(app.document.body.style.overflow,'hidden');
  app.click(app.named('Delete application'));await waitFor(()=>app.document.querySelector('dialog[open]'));
  assert.equal(app.deleted,0);assert.equal(app.document.activeElement.textContent,'Cancel');
  app.click(app.document.querySelector('dialog .destructive-button'));
  await waitFor(()=>app.deleted===1&&!app.document.querySelector('dialog,.application-details-modal'));
  assert.equal(app.document.body.style.overflow,'');assert.ok(app.document.querySelector('.kanban-board'));
  assert.equal(app.label('View Disposable company — Developer'),null);
  app.click(app.named('Overview'));await waitFor(()=>app.document.querySelector('h1').textContent.includes('clearer path'));
 }finally{app.dom.window.close();}
});

test('cancel and Escape preserve the application and return focus to the details view',async()=>{
 const app=await workspace();try{
  app.click(app.label('View details for Disposable company — Developer'));await waitFor(()=>app.document.querySelector('.application-details-modal'));
  app.click(app.named('Delete application'));await waitFor(()=>app.document.querySelector('dialog[open]'));
  app.click(app.document.querySelector('dialog .secondary'));await waitFor(()=>!app.document.querySelector('dialog'));
  assert.equal(app.deleted,0);assert.ok(app.document.querySelector('.application-details-modal'));assert.equal(app.document.activeElement.textContent,'Delete application');
  app.click(app.named('Delete application'));await waitFor(()=>app.document.querySelector('dialog[open]'));
  app.document.querySelector('dialog').dispatchEvent(new app.window.Event('cancel',{cancelable:true}));
  await waitFor(()=>!app.document.querySelector('dialog'));assert.equal(app.deleted,0);
  app.click(app.label('Close application details'));await waitFor(()=>!app.document.querySelector('.application-details-modal'));assert.equal(app.document.body.style.overflow,'');
 }finally{app.dom.window.close();}
});

test('failed deletion stays in the popup, re-enables controls, and allows cancellation',async()=>{
 const app=await workspace({fail:true});try{
  app.click(app.label('Delete Disposable company application'));await waitFor(()=>app.document.querySelector('dialog[open]'));
  app.click(app.document.querySelector('dialog .destructive-button'));await waitFor(()=>app.document.querySelector('dialog [role="alert"]'));
  assert.match(app.document.querySelector('dialog [role="alert"]').textContent,/Test deletion failed/);
  assert.equal(app.document.querySelector('dialog .secondary').disabled,false);
  app.click(app.document.querySelector('dialog .secondary'));await waitFor(()=>!app.document.querySelector('dialog'));assert.ok(app.label('View details for Disposable company — Developer'));
 }finally{app.dom.window.close();}
});

test('deleting from the editor also handles an already-deleted application without trapping the screen',async()=>{
 const app=await workspace({missing:true});try{
  app.click(app.label('Edit Disposable company'));await waitFor(()=>app.document.querySelector('#job-title'));
  app.click(app.named('Delete'));await waitFor(()=>app.document.querySelector('dialog[open]'));
  app.click(app.document.querySelector('dialog .destructive-button'));await waitFor(()=>app.deleted===1&&!app.document.querySelector('dialog,#job-title'));
  assert.equal(app.label('View details for Disposable company — Developer'),null);
  assert.equal(app.document.querySelector('h1').textContent,'Every opportunity, in one place.');
 }finally{app.dom.window.close();}
});
