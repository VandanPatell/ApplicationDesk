import ExcelJS from 'exceljs';
import yauzl from 'yauzl';
import JSZip from 'jszip';
import {statuses,workModes,validateJob} from './domain.js';
export const IMPORT_COLUMNS=[
 ['Company name','company'],['Job title','role'],['Work arrangement','workMode'],['City / location','location'],
 ['Status','status'],['Applied on','appliedAt'],['Follow up on','followUpAt'],['Replied','replied'],
 ['Technology tags','tags'],['Contact email','email'],['Other contact details','contact'],['Posting URL','url'],
 ['Source','source'],['Salary / range','salary'],['Company description','description'],['Notes','notes']
];
export const MAX_IMPORT_ROWS=1000;
export class ImportError extends Error{constructor(message){super(message);this.status=400;}}
const normalize=value=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases=new Map(IMPORT_COLUMNS.flatMap(([label,key])=>[[normalize(label),key],[normalize(key),key]]));
for(const [label,key] of [['company','company'],['position','role'],['technologies','tags'],['tags','tags'],['email','email'],['city','location'],['location','location'],['work type','workMode'],['applied date','appliedAt'],['follow up date','followUpAt'],['has replied','replied'],['job url','url']])aliases.set(normalize(label),key);
async function validateZip(buffer){
 if(buffer.length>5*1024*1024)throw new ImportError('The Excel file must be 5 MB or smaller.');
 await new Promise((resolve,reject)=>yauzl.fromBuffer(buffer,{lazyEntries:true,validateEntrySizes:true},(error,zip)=>{
  if(error)return reject(new ImportError('Unable to read this .xlsx file. Save it as an Excel Workbook (.xlsx) and try again.'));
  let count=0,total=0,expanded=0,finished=false;
  const fail=message=>{if(finished)return;finished=true;zip.close();reject(new ImportError(message));};
  zip.on('error',()=>fail('The workbook archive is invalid.'));
  zip.on('entry',entry=>{
   count++;total+=entry.uncompressedSize;
   if(count>2000||total>30*1024*1024||entry.uncompressedSize>20*1024*1024)return fail('This workbook is too large after decompression. Split it into smaller files.');
   if(/vbaProject\.bin$/i.test(entry.fileName))return fail('Macro-enabled workbooks are not supported. Save a standard .xlsx workbook.');
   zip.openReadStream(entry,(error,stream)=>{
    if(error)return fail('The workbook archive is invalid.');
    stream.on('data',chunk=>{expanded+=chunk.length;if(expanded>30*1024*1024){stream.destroy();fail('This workbook is too large after decompression. Split it into smaller files.');}});
    stream.on('error',()=>fail('The workbook archive contains invalid compressed data.'));
    stream.on('end',()=>{if(!finished)zip.readEntry();});
   });
  });
  zip.on('end',()=>{if(!finished){finished=true;resolve();}});zip.readEntry();
 }));
}
function cellValue(cell,key){
 const value=cell.value;
 if(value===undefined||value===null)return '';
 if(typeof value==='object'&&!(value instanceof Date)){
  if(value.formula!==undefined||value.sharedFormula!==undefined)throw Error('Formula cells are not imported. Paste their values first.');
  if(value.error)throw Error('An Excel error cell must be corrected.');
  if(value.richText)return value.richText.map(part=>part.text).join('').trim();
  if(value.hyperlink)return key==='url'?value.hyperlink:String(value.text||'').trim();
  throw Error('Unsupported cell value. Paste plain text or a date.');
 }
 return typeof value==='string'?value.trim():value;
}
export function parseImportDate(value,label,date1904=false){
 if(value==='')return null;
 if(value instanceof Date){if(Number.isNaN(value.getTime()))throw Error(`${label}: invalid Excel date.`);return value.toISOString().slice(0,10);}
 if(typeof value==='number'&&Number.isFinite(value)&&value>=(date1904?0:1)&&value<2958466){
  const epoch=date1904?Date.UTC(1904,0,1):Date.UTC(1899,11,value<60?31:30);
  return new Date(epoch+Math.floor(value)*86400000).toISOString().slice(0,10);
 }
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error(`${label}: use an Excel date or YYYY-MM-DD.`);
 const date=new Date(value+'T00:00:00Z');if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value)throw Error(`${label}: invalid calendar date.`);
 return value;
}
export function normalizeImportRow(values,date1904=false){
 const data={};
 for(const [,key] of IMPORT_COLUMNS){
  const value=values[key]??'';
  if(['appliedAt','followUpAt','replied','tags'].includes(key))continue;
  if(typeof value==='object')throw Error(`${key}: enter text instead of a date.`);
  data[key]=String(value).trim();if(data[key].length>10000)throw Error(`${key}: limit text to 10,000 characters.`);
 }
 data.status=statuses.find(s=>normalize(s)===normalize(data.status))||(data.status?'':'Saved');
 if(values.status&&!data.status)throw Error('Status must be Saved, Applied, Interview, Offer, Rejected, or Withdrawn.');
 data.workMode=workModes.find(mode=>normalize(mode)===normalize(data.workMode))||(data.workMode?'invalid':'');
 const replied=String(values.replied??'').trim().toLowerCase();
 if(!['','true','false','yes','no','1','0','y','n'].includes(replied))throw Error('Replied must be Yes/No, True/False, or 1/0.');
 data.replied=['true','yes','1','y'].includes(replied);
 data.tags=[...new Set(String(values.tags??'').split(/[,;]/).map(t=>t.trim()).filter(Boolean))];
 data.appliedAt=parseImportDate(values.appliedAt??'','Applied on',date1904);
 data.followUpAt=parseImportDate(values.followUpAt??'','Follow up on',date1904);
 const error=validateJob(data);if(error)throw Error(error);
 if(data.email&&!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(data.email))throw Error('Contact email must be a single valid email address.');
 if(data.url)try{new URL(data.url);}catch{throw Error('Posting URL must be a valid http:// or https:// URL.');}
 return data;
}
export function duplicateKeys(job){
 const keys=['role:'+JSON.stringify([job.company,job.role,job.location,job.workMode].map(v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ')))];
 if(job.url)try{const url=new URL(job.url);url.hash='';for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||key==='fbclid')url.searchParams.delete(key);url.searchParams.sort();keys.push('url:'+url.href.replace(/\/$/,''));}catch{}
 return keys;
}
export function classifyRows(rows,existing=[]){
 const seen=new Set(existing.flatMap(duplicateKeys));
 return rows.map(row=>{
  if(row.errors?.length)return {...row,state:'invalid'};
  const keys=duplicateKeys(row.data);if(keys.some(k=>seen.has(k)))return {...row,state:'duplicate',errors:['Matches an existing application or an earlier valid row in this workbook.']};
  keys.forEach(k=>seen.add(k));return {...row,state:'ready',errors:[]};
 });
}
export async function readJobWorkbook(buffer){
 await validateZip(buffer);
 const workbook=new ExcelJS.Workbook();
 try{
  // ExcelJS's SAX reader expects unprefixed SpreadsheetML element names.
  // Preserve valid namespace-prefixed inputs by normalizing that namespace only.
  const archive=await JSZip.loadAsync(buffer);let changed=false;
  for(const [name,file] of Object.entries(archive.files)){
   if(file.dir||! /^xl\/.*\.xml$/.test(name))continue;
   let xml=await file.async('string');const original=xml;
   const prefixes=[...xml.matchAll(/xmlns:([\w-]+)=["']http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main["']/g)].map(match=>match[1]);
   for(const prefix of new Set(prefixes)){
    xml=xml.replace(new RegExp('(<\\/?)'+prefix+':','g'),'$1').replace(new RegExp('xmlns:'+prefix+'=(["\x27])http://schemas.openxmlformats.org/spreadsheetml/2006/main\\1','g'),'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"');
   }
   if(xml!==original){archive.file(name,xml);changed=true;}
  }
  await workbook.xlsx.load(changed?await archive.generateAsync({type:'nodebuffer'}):buffer);
 }catch{throw new ImportError('Unable to read this workbook. Password-protected, damaged, and older .xls files are not supported.');}
 return workbook;
}
export async function parseJobWorkbook(buffer){
 const workbook=await readJobWorkbook(buffer);
 const sheet=workbook.getWorksheet('Applications')||workbook.worksheets[0];
 if(!sheet)throw new ImportError('This workbook has no worksheets.');
 if(sheet.columnCount>64||sheet.rowCount>10001)throw new ImportError('Use at most 64 columns and keep the data within the first 10,000 rows.');
 const mapping=new Map(),unknown=[];
 sheet.getRow(1).eachCell((cell,index)=>{
  let header;try{header=String(cellValue(cell,'header'));}catch{throw new ImportError('Headers must be plain text in row 1.');}
  const key=aliases.get(normalize(header));
  if(!header)return;if(!key){unknown.push(header);return;}
  if([...mapping.values()].includes(key))throw new ImportError(`Multiple columns map to ${key}. Keep one column for each field.`);
  mapping.set(index,key);
 });
 if(![...mapping.values()].includes('company')||![...mapping.values()].includes('role'))throw new ImportError('Row 1 must include Company name and Job title headers. Download the template for the supported columns.');
 const rows=[];
 sheet.eachRow((row,rowNumber)=>{
  if(rowNumber===1)return;
  const values={},errors=[];
  for(const [column,key] of mapping)try{values[key]=cellValue(row.getCell(column),key);}catch(error){errors.push(`${row.getCell(column).address}: ${error.message}`);}
  if(!errors.length&&Object.values(values).every(value=>value===''))return;
  if(rows.length>=MAX_IMPORT_ROWS)throw new ImportError('Import at most 1,000 applications per file. Split the workbook and try again.');
  let data=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value instanceof Date?value.toISOString().slice(0,10):value]));
  if(!errors.length)try{data=normalizeImportRow(values,!!workbook.properties.date1904);}catch(error){errors.push(error.message);}
  rows.push({rowNumber,data,errors});
 });
 if(!rows.length)throw new ImportError('No application rows were found. Fill the Applications sheet below the headers, then upload it.');
 return {sheetName:sheet.name,rows,warnings:unknown.length?[`Ignored unrecognized columns: ${unknown.join(', ')}`]:[]};
}
