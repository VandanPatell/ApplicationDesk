import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import {fileURLToPath} from 'node:url';
import {parseJobWorkbook,classifyRows,duplicateKeys,ImportError} from './job-import.js';
const batchSchema=new mongoose.Schema({fileName:String,sheetName:String,rows:[mongoose.Schema.Types.Mixed],warnings:[String],state:{type:String,default:'preview'},result:mongoose.Schema.Types.Mixed,expiresAt:{type:Date,index:{expires:0}}},{timestamps:true});
export const JobImportBatch=mongoose.model('JobImportBatch',batchSchema);
const route=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
export function createJobImportRouter({Job}){
 const router=express.Router();
 router.use((req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(req.method==='POST'&&(req.get('X-Requested-With')!=='ApplicationDesk'||(req.get('Origin')&&req.get('Origin')!==(process.env.APP_ORIGIN||'http://localhost:8080'))))return res.status(403).json({error:'Import applications from the dashboard.'});
  next();
 });
 router.get('/template',(req,res)=>res.download(fileURLToPath(new URL('../assets/job-import-template.xlsx',import.meta.url)),'Application-Desk-Import-Template.xlsx'));
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:0}});
 router.post('/preview',upload.single('file'),route(async(req,res)=>{
  if(!req.file||! /\.xlsx$/i.test(req.file.originalname))throw new ImportError('Choose a standard Excel Workbook (.xlsx). Older .xls and CSV files must be saved as .xlsx first.');
  const parsed=await parseJobWorkbook(req.file.buffer);
  if(Buffer.byteLength(JSON.stringify(parsed.rows))>4*1024*1024)throw new ImportError('This workbook contains too much text. Split it into smaller files.');
  const existing=await Job.find().select('company role location workMode url').lean();
  const rows=classifyRows(parsed.rows,existing);
  const batch=await JobImportBatch.create({fileName:req.file.originalname,sheetName:parsed.sheetName,rows,warnings:parsed.warnings,expiresAt:new Date(Date.now()+30*60*1000)});
  res.json({batchId:batch._id,fileName:batch.fileName,sheetName:batch.sheetName,expiresAt:batch.expiresAt,rows,warnings:batch.warnings});
 }));
 router.post('/commit',route(async(req,res)=>{
  const {batchId,selectedRows}=req.body;
  if(!mongoose.isValidObjectId(batchId)||!Array.isArray(selectedRows)||!selectedRows.length||selectedRows.length>1000||new Set(selectedRows).size!==selectedRows.length||selectedRows.some(n=>!Number.isInteger(n)))throw new ImportError('Select one or more valid preview rows to import.');
  const preview=await JobImportBatch.findById(batchId);
  if(!preview||preview.expiresAt<Date.now())throw new ImportError('This import preview expired. Upload the workbook again.');
  if(preview.state==='completed')return res.json(preview.result);
  if(selectedRows.some(n=>!preview.rows.some(row=>row.rowNumber===n&&row.state==='ready')))throw new ImportError('Only rows marked Ready can be imported.');
  const batch=await JobImportBatch.findOneAndUpdate({_id:batchId,state:'preview',expiresAt:{$gt:new Date()}},{$set:{state:'importing'}},{new:true});
  if(!batch)return res.status(409).json({error:'This batch is already being imported. Wait, then retry this same import to retrieve its result. If the service restarted, re-upload the workbook; saved rows will be detected as duplicates.'});
  const result={imported:0,duplicates:0,failed:0,notSelected:batch.rows.length-selectedRows.length,issues:[]};
  try{
   const existing=await Job.find().select('company role location workMode url').lean(),seen=new Set(existing.flatMap(duplicateKeys));
   for(const row of batch.rows.filter(row=>selectedRows.includes(row.rowNumber))){
    const keys=duplicateKeys(row.data);
    if(keys.some(k=>seen.has(k))){result.duplicates++;result.issues.push({rowNumber:row.rowNumber,message:'An application with the same posting URL or company, role, city, and work arrangement now exists.'});continue;}
    try{
     const saved=await Job.updateOne({importBatchId:String(batch._id),importRow:row.rowNumber},{$setOnInsert:{...row.data,importBatchId:String(batch._id),importRow:row.rowNumber}},{upsert:true,runValidators:true});
     if(saved.upsertedCount)result.imported++;else result.duplicates++;
     keys.forEach(key=>seen.add(key));
    }catch{result.failed++;result.issues.push({rowNumber:row.rowNumber,message:'This row could not be saved. Re-upload to retry; existing applications will be skipped.'});}
   }
   await JobImportBatch.updateOne({_id:batch._id},{state:'completed',result});
  }catch(error){
   // Retain the importing state: never retry a partially completed batch silently.
   return res.status(503).json({error:'The import could not be fully confirmed. Refresh applications to check saved rows, then re-upload; existing applications will be detected as duplicates.'});
  }
  res.json(result);
 }));
 router.use((error,req,res,next)=>{
  if(error instanceof ImportError)return res.status(400).json({error:error.message});
  if(error instanceof multer.MulterError)return res.status(400).json({error:error.code==='LIMIT_FILE_SIZE'?'The Excel file must be 5 MB or smaller.':'Upload one Excel file at a time.'});
  next(error);
 });
 return router;
}
