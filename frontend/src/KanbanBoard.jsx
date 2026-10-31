import React,{useState} from 'react';
import {GripVertical,Mail,MapPin,Clock,Check,Plus} from 'lucide-react';

export default function KanbanBoard({jobs,stages,saving,onMove,onView,onEmail,onAdd}){
 const [draggedId,setDraggedId]=useState(null),[over,setOver]=useState(null);
 function drop(event,stage){
  event.preventDefault();
  const job=jobs.find(item=>item._id===draggedId);
  setDraggedId(null);setOver(null);
  if(!saving&&job&&job.status!==stage)onMove(job,stage);
 }
 return <div className="kanban-area" aria-busy={saving}>
  <div className="kanban-help"><span>Drag a card into a stage, or use its <strong>Move to</strong> menu.</span><span role="status" aria-live="polite">{saving?'Saving changes…':`${jobs.length} applications shown`}</span></div>
  <div className="kanban-board" aria-label="Application Kanban board">
   {stages.map(stage=>{const cards=jobs.filter(job=>job.status===stage);return <section key={stage} aria-label={`${stage} column`} className={'kanban-column '+(over===stage?'drop-target':'')} onDragOver={event=>{if(draggedId&&!saving){event.preventDefault();event.dataTransfer.dropEffect='move';setOver(stage);}}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOver(null);}} onDrop={event=>drop(event,stage)}>
    <header className="kanban-column-heading"><h3><span className={'dot '+stage.toLowerCase()}/>{stage}<span className="kanban-count">{cards.length}</span></h3><button className="icon-button" aria-label={`Add application in ${stage}`} onClick={()=>onAdd(stage)}><Plus size={17}/></button></header>
    <div className="kanban-cards">{cards.map(job=><article key={job._id} aria-label={`${job.company} — ${job.role}`} className={'kanban-card '+(draggedId===job._id?'dragging':'')} draggable={!saving} onDragStart={event=>{if(saving){event.preventDefault();return;}setDraggedId(job._id);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',job._id);}} onDragEnd={()=>{setDraggedId(null);setOver(null);}}>
     <div className="kanban-card-top"><span className="company-avatar">{job.company.slice(0,2).toUpperCase()}</span><GripVertical size={18} className="kanban-grip" aria-hidden="true"/></div>
     <button className="kanban-title" onClick={()=>onView(job)} aria-label={`View ${job.company} — ${job.role}`}><strong>{job.company}</strong><span>{job.role}</span></button>
     {(job.workMode||job.location)&&<p className="kanban-location"><MapPin size={14}/>{[job.workMode,job.location].filter(Boolean).join(' · ')}</p>}
     {!!job.tags?.length&&<div className="tags kanban-tags">{job.tags.slice(0,3).map((tag,index)=><span key={index}>{tag}</span>)}{job.tags.length>3&&<span>+{job.tags.length-3}</span>}</div>}
     <div className="kanban-meta">{job.replied&&<span className="kanban-replied"><Check size={14}/>Reply received</span>}{job.followUpAt&&<span><Clock size={14}/>Follow up {new Date(job.followUpAt).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'})}</span>}</div>
     <div className="kanban-card-footer"><label>Move to<select aria-label={`Move ${job.company} — ${job.role} to stage`} value={job.status} disabled={saving} onChange={event=>onMove(job,event.target.value)}>{stages.map(value=><option key={value}>{value}</option>)}</select></label><button className="icon-button" aria-label={`Email ${job.company} about ${job.role}`} title="Open in Email studio" onClick={()=>onEmail(job)}><Mail size={18}/></button></div>
    </article>)}{!cards.length&&<div className="kanban-empty">No applications here.<span>Drop a card or add an application.</span></div>}</div>
   </section>;})}
  </div>
 </div>;
}
