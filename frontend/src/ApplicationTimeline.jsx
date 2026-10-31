import React,{useState} from 'react';
import {Clock,Plus} from 'lucide-react';
const localNow=()=>{const date=new Date();return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);};
export default function ApplicationTimeline({job,onSaved}){
 const [body,setBody]=useState(''),[occurredAt,setOccurredAt]=useState(localNow),[saving,setSaving]=useState(false),[error,setError]=useState('');
 async function submit(event){
  event.preventDefault();setSaving(true);setError('');
  try{
   const response=await fetch(`/api/jobs/${job._id}/timeline`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body,occurredAt:new Date(occurredAt).toISOString()})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to save note.');
   onSaved(data);setBody('');setOccurredAt(localNow());
  }catch(err){setError(err.message);}finally{setSaving(false);}
 }
 const entries=[...(job.timeline||[])].sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt)||new Date(b.createdAt)-new Date(a.createdAt));
 return <section className="application-detail-section conversation-section"><h3><Clock size={17}/> Conversation timeline</h3><p className="subtle">Keep interview updates, recruiter calls and next steps in one place. Newest first; times use your local timezone.</p>
 {job.replied?<form className="timeline-composer" onSubmit={submit}><label>Conversation date & time<input type="datetime-local" required value={occurredAt} disabled={saving} onChange={event=>setOccurredAt(event.target.value)}/></label><label>Timeline note<textarea required maxLength={5000} rows={3} placeholder="What did they say? What happens next?" value={body} disabled={saving} onChange={event=>setBody(event.target.value)}/></label>{error&&<p role="alert" className="missing">{error}</p>}<button className="primary" disabled={saving||!body.trim()}><Plus size={16}/>{saving?'Saving…':'Add timeline note'}</button></form>:<p className="timeline-hint">Mark this company as replied to add conversation notes. Existing notes remain available here.</p>}
 {entries.length?<ol className="conversation-timeline">{entries.map(entry=><li key={entry._id}><time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</time><p>{entry.body}</p></li>)}</ol>:<p className="not-provided" role="status">No conversation notes yet.</p>}
 </section>;
}
