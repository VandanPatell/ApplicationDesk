import crypto from 'node:crypto';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
export const MAX_ATTACHMENT_BYTES=10*1024*1024;
export const MAX_TOTAL_BYTES=18*1024*1024;
export function encrypt(value,key){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);
 const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return [iv.toString('hex'),cipher.getAuthTag().toString('hex'),bytes.toString('hex')].join('.');
}
export function decrypt(value,key){
 const [iv,tag,bytes]=value.split('.');const cipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),Buffer.from(iv,'hex'));
 cipher.setAuthTag(Buffer.from(tag,'hex'));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(bytes,'hex')),cipher.final()]).toString());
}
export function validateDraft({to,subject,body,attachmentIds,requestId,confirmed}){
 if(confirmed!==true)return 'Review and confirm the email before sending.';
 if(typeof to!=='string'||! /^[^\s<>@,;\r\n]+@[^\s<>@,;\r\n]+\.[^\s<>@,;\r\n]+$/.test(to))return 'Enter a single valid recipient email address.';
 if(typeof subject!=='string'||!subject.trim()||/[\r\n]/.test(subject)||subject.length>998)return 'Enter a subject without line breaks (maximum 998 characters).';
 if(typeof body!=='string'||!body.trim()||body.length>100000)return 'Enter an email body (maximum 100,000 characters).';
 if(/\{\{[^}]+\}\}/.test(subject+' '+body))return 'Fill in all template variables before sending.';
 if(!Array.isArray(attachmentIds)||attachmentIds.length>5||new Set(attachmentIds).size!==attachmentIds.length||attachmentIds.some(id=>typeof id!=='string'||! /^[a-f\d]{24}$/i.test(id)))return 'Select up to five valid attachments.';
 if(typeof requestId!=='string'||! /^[a-f\d-]{36}$/i.test(requestId))return 'Invalid send request identifier.';
 return null;
}
export async function createRawMessage({from,to,subject,body,attachments=[]}){
 const message=await new MailComposer({from,to,subject,text:body,attachments:attachments.map(a=>({filename:a.name,content:a.data,contentType:a.mimeType})),disableFileAccess:true,disableUrlAccess:true}).compile().build();
 return message.toString('base64url');
}
