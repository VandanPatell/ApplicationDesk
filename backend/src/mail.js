import express from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import multer from 'multer';
import {OAuth2Client} from 'google-auth-library';
import {encrypt,decrypt,validateDraft,createRawMessage,MAX_ATTACHMENT_BYTES,MAX_TOTAL_BYTES} from './mail-utils.js';
const authSchema=new mongoose.Schema({_id:String,email:String,credentials:String,reconnect:{type:Boolean,default:false}});
const attachmentSchema=new mongoose.Schema({name:String,mimeType:String,size:Number,data:{type:Buffer,select:false}}, {timestamps:true});
const sentSchema=new mongoose.Schema({requestId:{type:String,unique:true},jobId:{type:mongoose.Schema.Types.ObjectId,ref:'Job'},to:String,subject:String,from:String,attachments:[String],state:{type:String,enum:['sending','sent','failed','unknown']},googleMessageId:String,sentAt:Date}, {timestamps:true});
export const GmailAccount=mongoose.model('GmailAccount',authSchema);
export const Attachment=mongoose.model('Attachment',attachmentSchema);
export const SentEmail=mongoose.model('SentEmail',sentSchema);
const route=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
export function createMailRouter({Job,oauthFactory,googleFetch=fetch}={}){
 const router=express.Router(),states=new Map();
 const config=()=>({id:process.env.GOOGLE_CLIENT_ID,secret:process.env.GOOGLE_CLIENT_SECRET,key:process.env.TOKEN_ENCRYPTION_KEY,origin:process.env.APP_ORIGIN||'http://localhost:8080'});
 const configured=()=>{const c=config();return !!(c.id&&c.secret&&/^[a-f\d]{64}$/i.test(c.key||''));};
 const client=()=>{const c=config();return oauthFactory?oauthFactory():new OAuth2Client(c.id,c.secret,c.origin+'/api/gmail/callback');};
 router.use((req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&(req.get('X-Requested-With')!=='ApplicationDesk'||(req.get('Origin')&&req.get('Origin')!==config().origin)))return res.status(403).json({error:'This action must be made from the dashboard.'});
  next();
 });
 router.get('/gmail/status',route(async(req,res)=>{const account=await GmailAccount.findById('personal').select('email reconnect');res.json({configured:configured(),connected:!!account&&!account.reconnect&&configured(),email:account?.email||'',reconnect:!!account?.reconnect});}));
 router.post('/gmail/connect',route(async(req,res)=>{
  if(!configured())return res.status(503).json({error:'Gmail setup is required. Follow docs/GMAIL_SETUP.md to configure Google OAuth credentials.'});
  for(const [key,value] of states)if(value.expires<Date.now())states.delete(key);
  if(states.size>50)return res.status(429).json({error:'Too many connection attempts. Try again later.'});
  const state=crypto.randomBytes(32).toString('hex'),binding=crypto.randomBytes(32).toString('hex');
  const oauth=client(),{codeVerifier,codeChallenge}=await oauth.generateCodeVerifierAsync();
  states.set(state,{binding,codeVerifier,expires:Date.now()+600000});
  res.cookie('gmail_oauth',binding,{httpOnly:true,sameSite:'lax',secure:config().origin.startsWith('https:'),path:'/api/gmail',maxAge:600000});
  res.json({url:oauth.generateAuthUrl({access_type:'offline',prompt:'consent',scope:['openid','email','https://www.googleapis.com/auth/gmail.send'],state,code_challenge:codeChallenge,code_challenge_method:'S256'})});
 }));
 router.get('/gmail/callback',route(async(req,res)=>{
  const state=typeof req.query.state==='string'?req.query.state:'';
  const pending=states.get(state);states.delete(state);
  const binding=(req.get('Cookie')||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('gmail_oauth='))?.slice(12);
  res.clearCookie('gmail_oauth',{path:'/api/gmail'});
  if(!configured()||!pending||pending.expires<Date.now()||binding!==pending.binding)return res.redirect('/?gmail=invalid-state');
  if(req.query.error||typeof req.query.code!=='string')return res.redirect('/?gmail=cancelled');
  try{
   const oauth=client();const {tokens}=await oauth.getToken({code:req.query.code,codeVerifier:pending.codeVerifier});
   if(!tokens.scope?.split(' ').includes('https://www.googleapis.com/auth/gmail.send')||!tokens.refresh_token||!tokens.id_token)throw Error('Incomplete consent');
   const ticket=await oauth.verifyIdToken({idToken:tokens.id_token,audience:config().id});
   const identity=ticket.getPayload();if(!identity?.email_verified||!identity.email)throw Error('Email not verified');
   await GmailAccount.findByIdAndUpdate('personal',{email:identity.email,credentials:encrypt(tokens,config().key),reconnect:false},{upsert:true});
   return res.redirect('/?gmail=connected');
  }catch{return res.redirect('/?gmail=failed');}
 }));
 router.post('/gmail/disconnect',route(async(req,res)=>{
  const account=await GmailAccount.findById('personal');let revoked=true;
  if(account&&configured())try{const oauth=client();oauth.setCredentials(decrypt(account.credentials,config().key));await oauth.revokeCredentials();}catch{revoked=false;}
  await GmailAccount.deleteOne({_id:'personal'});res.json({ok:true,revoked});
 }));
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:MAX_ATTACHMENT_BYTES,files:1,fields:0}});
 router.get('/attachments',route(async(req,res)=>res.json(await Attachment.find().sort({createdAt:-1}))));
 router.post('/attachments',upload.single('file'),route(async(req,res)=>{
  if(!req.file)return res.status(400).json({error:'Choose a file to upload.'});
  const name=req.file.originalname.replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,180)||'attachment';
  const file=await Attachment.create({name,mimeType:req.file.mimetype||'application/octet-stream',size:req.file.size,data:req.file.buffer});
  res.status(201).json({_id:file._id,name:file.name,mimeType:file.mimeType,size:file.size});
 }));
 router.get('/attachments/:id/download',route(async(req,res)=>{
  const file=await Attachment.findById(req.params.id).select('+data');if(!file)return res.status(404).json({error:'Attachment not found.'});
  res.set('Content-Type','application/octet-stream');res.set('X-Content-Type-Options','nosniff');res.attachment(file.name);res.send(file.data);
 }));
 router.delete('/attachments/:id',route(async(req,res)=>{const file=await Attachment.findByIdAndDelete(req.params.id);res.status(file?200:404).json(file?{ok:true}:{error:'Attachment not found.'});}));
 router.get('/gmail/history',route(async(req,res)=>res.json(await SentEmail.find().sort({createdAt:-1}).limit(50))));
 router.post('/gmail/send',route(async(req,res)=>{
  const error=validateDraft(req.body);if(error)return res.status(400).json({error});
  if(!configured())return res.status(503).json({error:'Configure Google OAuth before sending.'});
  const previous=await SentEmail.findOne({requestId:req.body.requestId});
  if(previous)return previous.state==='sent'?res.json({ok:true,record:previous,duplicate:true}):res.status(409).json({error:'This send request was already processed or has an uncertain outcome. Check Gmail Sent before trying a new send.'});
  const account=await GmailAccount.findById('personal');if(!account||account.reconnect)return res.status(401).json({error:'Connect or reconnect Gmail before sending.'});
  if(req.body.from!==account.email)return res.status(409).json({error:'The connected sender changed. Refresh Gmail status and review the draft again.'});
  const {to,subject,body,attachmentIds,requestId,jobId,markApplied}=req.body;
  const job=jobId?await Job.findById(jobId):null;
  if(jobId&&!job)return res.status(404).json({error:'Application not found.'});
  const files=await Attachment.find({_id:{$in:attachmentIds}}).select('+data');
  if(files.length!==attachmentIds.length)return res.status(400).json({error:'An attachment was removed. Refresh and review the draft.'});
  if(files.reduce((n,f)=>n+f.size,0)>MAX_TOTAL_BYTES)return res.status(400).json({error:'Attachments must total 18 MB or less.'});
  const oauth=client();let accessToken;
  try{
   oauth.setCredentials(decrypt(account.credentials,config().key));
   accessToken=(await oauth.getAccessToken()).token;if(!accessToken)throw Error('No token');
   await GmailAccount.updateOne({_id:'personal'},{credentials:encrypt(oauth.credentials,config().key)});
  }catch{await GmailAccount.updateOne({_id:'personal'},{reconnect:true});return res.status(401).json({error:'Gmail authorization expired or could not be refreshed. Reconnect Gmail.'});}
  const raw=await createRawMessage({from:account.email,to,subject,body,attachments:files});
  let record;try{record=await SentEmail.create({requestId,jobId:job?._id,to,subject,from:account.email,attachments:files.map(f=>f.name),state:'sending'});}catch(e){if(e.code===11000)return res.status(409).json({error:'This email is already being processed. Check send history.'});throw e;}
  let sent;
  try{
   const response=await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({raw}),signal:AbortSignal.timeout(60000)});
   if(!response.ok){await SentEmail.updateOne({_id:record._id},{state:response.status>=500?'unknown':'failed'});if(response.status===401)await GmailAccount.updateOne({_id:'personal'},{reconnect:true});return res.status(502).json({error:response.status>=500?'Gmail returned a server error; delivery is uncertain. Check Gmail Sent before sending again.':`Gmail rejected the email (HTTP ${response.status}). Check authorization, Gmail API setup, and account sending limits.`});}
   sent=await response.json();if(!sent.id)throw Error('No send receipt');
  }catch{await SentEmail.updateOne({_id:record._id},{state:'unknown'});return res.status(502).json({error:'Delivery could not be confirmed. Check Gmail Sent before sending again; this request will not be retried automatically.'});}
  const sentAt=new Date();let warning='';
  try{record=await SentEmail.findByIdAndUpdate(record._id,{state:'sent',googleMessageId:sent.id,sentAt},{new:true});}catch{warning='Email sent, but local history could not be updated. Do not resend.';}
  if(job&&markApplied===true)try{await Job.updateOne({_id:job._id},{$set:{...(!job.appliedAt?{appliedAt:sentAt}:{}),...(job.status==='Saved'?{status:'Applied'}:{})}});}catch{warning+=' Email sent, but application tracking could not be updated.';}
  res.json({ok:true,record,warning});
 }));
 router.use((err,req,res,next)=>{if(err instanceof multer.MulterError)return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'Each attachment must be 10 MB or smaller.':'Upload one attachment at a time.'});next(err);});
 return router;
}
