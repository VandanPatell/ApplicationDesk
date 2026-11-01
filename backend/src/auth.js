import {isAllowedOrigin} from './request-origin.js';
import crypto from 'node:crypto';
export function sessionMiddleware(req,res,next){
 const hash=process.env.APP_PASSWORD_HASH,secret=process.env.APP_SESSION_SECRET;
 const enabled=!!hash;
 if(enabled&&(!secret||secret.length<32))return res.status(503).json({error:'Set APP_SESSION_SECRET to at least 32 random characters before enabling password protection.'});
 function valid(){try{const cookie=(req.get('Cookie')||'').split(';').map(value=>value.trim()).find(value=>value.startsWith('desk_session='))?.slice(13);if(!cookie)return false;const [expires,nonce,signature]=cookie.split('.'),expected=crypto.createHmac('sha256',secret).update(expires+'.'+nonce).digest('hex');return Number(expires)>Date.now()&&signature?.length===expected.length&&crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected));}catch{return false;}}
 if(req.path==='/api/session'&&req.method==='GET')return res.json({enabled,authenticated:!enabled||valid()});
 if(req.path==='/api/session'&&req.method==='POST'){
  if(!isAllowedOrigin(req.get('Origin')))return res.status(403).json({error:'Sign in from the dashboard.'});
  if(!enabled)return res.json({ok:true});
  const bucket=req.ip||'local',record=attempts.get(bucket);if(record&&record.until>Date.now()&&record.count>=8)return res.status(429).json({error:'Too many attempts. Try again in 15 minutes.'});
  const [algorithm,salt,key]=hash.split('$');let matches=false;try{if(algorithm==='scrypt'&&/^[a-f\d]{64}$/i.test(key)&&typeof req.body.password==='string'&&req.body.password.length<1000){const candidate=crypto.scryptSync(req.body.password,salt,32);matches=crypto.timingSafeEqual(candidate,Buffer.from(key,'hex'));}}catch{}
  if(!matches){attempts.set(bucket,{count:record?.until>Date.now()?record.count+1:1,until:Date.now()+15*60000});return res.status(401).json({error:'Incorrect password.'});}
  attempts.delete(bucket);const expires=Date.now()+12*3600000,nonce=crypto.randomBytes(16).toString('hex'),signature=crypto.createHmac('sha256',secret).update(expires+'.'+nonce).digest('hex');res.cookie('desk_session',`${expires}.${nonce}.${signature}`,{httpOnly:true,sameSite:'strict',secure:(process.env.APP_ORIGIN||'').startsWith('https:'),maxAge:12*3600000,path:'/'});return res.json({ok:true});
 }
 if(req.path==='/api/session'&&req.method==='DELETE'){res.clearCookie('desk_session',{path:'/'});return res.json({ok:true});}
 if(enabled&&req.path.startsWith('/api/')&&!['/api/health','/api/gmail/callback'].includes(req.path)&&!valid())return res.status(401).json({error:'Sign in to your workspace first.'});
 next();
}
const attempts=new Map();
