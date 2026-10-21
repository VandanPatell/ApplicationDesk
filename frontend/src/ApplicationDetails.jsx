import React,{useEffect,useRef} from 'react';
import {X,Mail,Pencil,ExternalLink,MapPin,Check,Clock} from 'lucide-react';
const date=value=>{
 if(!value)return 'Not set';
 const parsed=new Date(value);
 return Number.isNaN(parsed.getTime())?'Not set':parsed.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});
};
function webLink(value){try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:null;}catch{return null;}}
function Detail({label,children}){return <div className="application-detail"><dt>{label}</dt><dd>{children||'Not specified'}</dd></div>;}
export default function ApplicationDetails({job,onClose,onEdit,onEmail}){
 const dialog=useRef(null),closeButton=useRef(null);
 useEffect(()=>{
  const trigger=document.activeElement,previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';closeButton.current?.focus();
  const handleKey=event=>{
   if(event.key==='Escape'){event.preventDefault();onClose();}
   if(event.key==='Tab'){
    const elements=[...dialog.current.querySelectorAll('button:not([disabled]),a[href]')].filter(el=>el.getClientRects().length);
    const first=elements[0],last=elements[elements.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',handleKey);
  return()=>{document.removeEventListener('keydown',handleKey);document.body.style.overflow=previousOverflow;if(trigger?.isConnected)trigger.focus();};
 },[]);
 const posting=webLink(job.url);
 return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><section className="modal application-details-modal" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="application-details-title">
 <div className="modal-header"><span className="eyebrow">APPLICATION DETAILS</span><button ref={closeButton} className="icon-button" aria-label="Close application details" onClick={onClose}><X/></button></div>
 <div className="application-details-heading"><span className="company-avatar">{job.company.slice(0,2).toUpperCase()}</span><div><h2 id="application-details-title">{job.company}</h2><p>{job.role}</p></div></div>
 <div className="application-detail-badges"><span className={'status '+job.status.toLowerCase()}>{job.status}</span>{job.workMode&&<span className="detail-work-mode">{job.workMode}</span>}<span className={'detail-reply '+(job.replied?'received':'')}><Check size={15}/>{job.replied?'Reply received':'Awaiting reply'}</span>{job.location&&<span><MapPin size={15}/>{job.location}</span>}</div>
 <section className="application-detail-section"><h3>Opportunity</h3><dl className="application-detail-grid"><Detail label="Work arrangement">{job.workMode}</Detail><Detail label="City / location">{job.location}</Detail><Detail label="Salary / range">{job.salary}</Detail><Detail label="Source">{job.source}</Detail><div className="application-detail detail-wide"><dt>Technologies</dt><dd>{job.tags?.length?<div className="detail-technologies">{job.tags.map((tag,index)=><span key={index}>{tag}</span>)}</div>:'Not specified'}</dd></div></dl></section>
 <section className="application-detail-section"><h3>Contact & posting</h3><dl className="application-detail-grid"><Detail label="Contact email">{job.email?<a href={`mailto:${encodeURIComponent(job.email)}`}>{job.email}</a>:null}</Detail><Detail label="Other contact details">{job.contact}</Detail><div className="application-detail detail-wide"><dt>Job posting</dt><dd>{posting?<a className="posting-detail-link" href={posting} target="_blank" rel="noopener noreferrer">{job.url}<ExternalLink size={15}/></a>:job.url||'Not specified'}</dd></div></dl></section>
 <section className="application-detail-section"><h3><Clock size={16}/> Tracking</h3><dl className="application-detail-grid"><Detail label="Applied on">{date(job.appliedAt)}</Detail><Detail label="Follow up on">{date(job.followUpAt)}</Detail><Detail label="Added on">{date(job.createdAt)}</Detail><Detail label="Last updated">{date(job.updatedAt)}</Detail></dl></section>
 <section className="application-detail-section"><h3>Company description</h3><p className={'detail-long-text '+(!job.description?'not-provided':'')}>{job.description||'No company description added yet.'}</p></section>
 <section className="application-detail-section"><h3>Notes</h3><p className={'detail-long-text '+(!job.notes?'not-provided':'')}>{job.notes||'No notes added yet.'}</p></section>
 <div className="form-footer details-footer"><button className="text-button" onClick={onClose}>Close</button><div><button className="secondary" onClick={onEdit}><Pencil size={16}/>Edit application</button><button className="primary" onClick={onEmail}><Mail size={16}/>Open in Email studio</button></div></div>
 </section></div>;
}
