import express from 'express';
import mongoose from 'mongoose';
import { statuses, workModes, validateJob } from './domain.js';
import {createMailRouter} from './mail.js';
import {ensureProfileLinks} from './profile-links.js';
import {createJobImportRouter} from './job-import-routes.js';
const jobSchema = new mongoose.Schema({
  company: {type:String,required:true,trim:true}, role:{type:String,required:true,trim:true}, description:String,
  tags:[String], email:String, contact:String, url:String, source:String, location:String, workMode:{type:String,enum:['',...workModes],default:''}, salary:String,
  status:{type:String,enum:statuses,default:'Saved'}, replied:{type:Boolean,default:false},
  appliedAt:Date, followUpAt:Date, notes:String, importBatchId:String, importRow:Number
}, {timestamps:true});
const templateSchema = new mongoose.Schema({name:{type:String,required:true},subject:{type:String,default:''},body:{type:String,default:''},defaultKey:{type:String,unique:true,sparse:true}}, {timestamps:true});
const settingsSchema = new mongoose.Schema({_id:String,variables:{type:Map,of:String},resumeDefaultsVersion:String,starterDefaultsVersion:String,profileLinksVersion:String});
jobSchema.index({importBatchId:1,importRow:1},{unique:true,partialFilterExpression:{importBatchId:{$exists:true}}});
export const Job = mongoose.model('Job',jobSchema);
export const Template = mongoose.model('Template',templateSchema);
export const Settings = mongoose.model('Settings',settingsSchema);
export const app = express();
app.disable('x-powered-by');
app.use(express.json({limit:'1mb'}));
app.use('/api/job-import',createJobImportRouter({Job}));
const route = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
app.get('/api/health', (req,res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ready:mongoose.connection.readyState === 1}));
app.get('/api/jobs',route(async(req,res)=>res.json(await Job.find().sort({createdAt:-1}))));
app.post('/api/jobs',route(async(req,res)=>{const error=validateJob(req.body);if(error)return res.status(400).json({error});res.status(201).json(await Job.create(req.body));}));
app.put('/api/jobs/:id',route(async(req,res)=>{const error=validateJob(req.body);if(error)return res.status(400).json({error});const job=await Job.findByIdAndUpdate(req.params.id,{$set:req.body},{new:true,runValidators:true});res.status(job?200:404).json(job||{error:'Job not found'});}));
app.delete('/api/jobs/:id',route(async(req,res)=>{const job=await Job.findByIdAndDelete(req.params.id);res.status(job?200:404).json(job?{ok:true}:{error:'Job not found'});}));
app.get('/api/templates',route(async(req,res)=>res.json(await Template.find().sort({createdAt:-1}))));
app.post('/api/templates',route(async(req,res)=>{if(!req.body.name?.trim())return res.status(400).json({error:'Template name is required.'});res.status(201).json(await Template.create({...req.body,body:ensureProfileLinks(req.body.body)}));}));
app.put('/api/templates/:id',route(async(req,res)=>{if(!req.body.name?.trim())return res.status(400).json({error:'Template name is required.'});const item=await Template.findByIdAndUpdate(req.params.id,{$set:{...req.body,body:ensureProfileLinks(req.body.body)}},{new:true,runValidators:true});res.status(item?200:404).json(item||{error:'Template not found'});}));
app.delete('/api/templates/:id',route(async(req,res)=>{const item=await Template.findByIdAndDelete(req.params.id);res.status(item?200:404).json(item?{ok:true}:{error:'Template not found'});}));
app.get('/api/variables',route(async(req,res)=>res.json((await Settings.findById('profile'))?.variables||{})));
app.put('/api/variables',route(async(req,res)=>{if(!req.body||Array.isArray(req.body)||Object.entries(req.body).some(([k,v])=>!/^[-\w]+$/.test(k)||typeof v!=='string'))return res.status(400).json({error:'Use text values and variable names containing letters, numbers, hyphens or underscores.'});await Settings.findByIdAndUpdate('profile',{variables:req.body},{upsert:true,runValidators:true});res.json(req.body);}));
app.use('/api',createMailRouter({Job}));
app.use((err,req,res,next)=>{const client=['ValidationError','CastError','StrictModeError'].includes(err.name)||err.status===400;res.status(client?400:500).json({error:client?'Invalid request. Check the supplied fields.':'Unable to complete request. Please try again.'});});
