import React,{useEffect,useRef,useState,useId} from 'react';
import {Trash2,X} from 'lucide-react';

export default function ConfirmDialog({title,children,confirmLabel='Delete',onConfirm,onClose}){
 const dialog=useRef(null),cancel=useRef(null),pending=useRef(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const titleId=useId(),descriptionId=useId();
 useEffect(()=>{
  const element=dialog.current,trigger=document.activeElement;
  element.showModal();cancel.current?.focus();
  return()=>{element.close();if(trigger?.isConnected)trigger.focus();};
 },[]);
 async function confirm(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setError('');
  try{await onConfirm();onClose();}
  catch(err){setError(err.message||'Unable to delete. Please try again.');}
  finally{pending.current=false;setBusy(false);}
 }
 return <dialog ref={dialog} className="confirmation-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event=>{event.preventDefault();if(!pending.current)onClose();}}>
  <div className="modal-header"><span className="confirmation-icon"><Trash2 size={24}/></span><button type="button" className="icon-button" aria-label="Close confirmation" disabled={busy} onClick={onClose}><X size={21}/></button></div>
  <h2 id={titleId}>{title}</h2><div id={descriptionId} className="confirmation-description">{children}</div>
  {error&&<p className="missing" role="alert">{error}</p>}
  <div className="form-footer"><button type="button" ref={cancel} className="secondary" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="primary destructive-button" disabled={busy} onClick={confirm}>{busy?'Deleting…':confirmLabel}</button></div>
 </dialog>;
}
