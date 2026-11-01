const localHosts=new Set(['localhost','127.0.0.1','[::1]']);

function parseOrigin(value){
 try{
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;
  return url;
 }catch{return null;}
}

export function isAllowedOrigin(origin,configured=process.env.APP_ORIGIN||'http://localhost:8080'){
 // Non-browser clients may omit Origin. Mutating dashboard routes still require their custom header.
 if(!origin)return true;
 const actual=parseOrigin(origin),expected=parseOrigin(configured);
 if(!actual||!expected)return false;
 if(actual.origin===expected.origin)return true;
 // The default local installation can be opened through either loopback address.
 // Never use Host/forwarded headers to expand trust, or allow arbitrary hosts or ports.
 return localHosts.has(actual.hostname)&&localHosts.has(expected.hostname)&&actual.protocol===expected.protocol&&actual.port===expected.port;
}

export function dashboardRequestAllowed(req){
 return req.get('X-Requested-With')==='ApplicationDesk'&&isAllowedOrigin(req.get('Origin'));
}

export function requestOriginError(req){
 return req.get('X-Requested-With')!=='ApplicationDesk'?'Unable to verify this request. Reload the dashboard and try again.':'This page address is not allowed. Open the configured dashboard URL or update APP_ORIGIN.';
}
