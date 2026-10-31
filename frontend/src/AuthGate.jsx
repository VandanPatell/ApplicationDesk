import React,{useState,useEffect} from 'react';
export default function AuthGate({children}){
 const [status,setStatus]=useState(null),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{fetch('/api/session').then(response=>response.json()).then(setStatus).catch(()=>setStatus({enabled:false}));},[]);
 if(!status)return <div className="auth-screen"><h1>Application Desk</h1><p>Opening your workspace…</p></div>;
 if(!status.enabled||status.authenticated)return children;
 return <div className="auth-screen"><form className="panel" onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');try{const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const data=await response.json();if(!response.ok)throw Error(data.error);setPassword('');setStatus({enabled:true,authenticated:true});}catch(err){setError(err.message);}finally{setBusy(false);}}}><span className="auth-monogram">A</span><h1>Welcome back.</h1><p>Your job search, in your own space.</p><label>Workspace password<input type="password" required autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)}/></label>{error&&<p className="alert" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Signing in…':'Open workspace'}</button></form></div>;
}
