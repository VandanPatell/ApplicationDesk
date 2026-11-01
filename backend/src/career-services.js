import {createResumeLayout,pdfFromLayout} from './resume-layout.js';
export function pdfBuffer(text,options={}){return pdfFromLayout(createResumeLayout(text,options));}
export function aiConfiguration(){const provider=process.env.AI_PROVIDER||'openai-compatible';return {provider,configured:!!process.env.AI_MODEL&&(!!process.env.AI_API_KEY||provider==='ollama'),model:process.env.AI_MODEL||'',baseUrl:process.env.AI_BASE_URL||(provider==='ollama'?'http://host.docker.internal:11434/v1':'https://api.openai.com/v1')};}
export async function askAI(system,prompt,{fetcher=fetch}={}){
 const config=aiConfiguration();if(!config.configured)throw Object.assign(Error('Configure an AI model in your environment first. Profile-based drafts work without AI.'),{status:400});
 const base=new URL(config.baseUrl);if(!['http:','https:'].includes(base.protocol))throw Error('Invalid AI endpoint');
 const key=process.env.AI_API_KEY||'',messages=[{role:'user',content:prompt.slice(0,100000)}];let url,body,headers={'Content-Type':'application/json'};
 if(config.provider==='anthropic'){
  url=new URL('messages',config.baseUrl.replace(/\/?$/,'/'));headers['x-api-key']=key;headers['anthropic-version']='2023-06-01';body={model:config.model,max_tokens:6000,system,messages};
 }else{
  url=new URL('chat/completions',config.baseUrl.replace(/\/?$/,'/'));headers.Authorization=`Bearer ${key||'local'}`;body={model:config.model,messages:[{role:'system',content:system},...messages],temperature:.2};
 }
 let response;try{response=await fetcher(url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});}catch{throw Object.assign(Error('The AI service is unreachable or timed out. Check the endpoint and model service, then try again.'),{status:400});}
 if(!response.ok)throw Object.assign(Error(`AI provider returned HTTP ${response.status}. Check the configured model and credentials.`),{status:400});
 const data=await response.json(),answer=config.provider==='anthropic'?data.content?.filter(part=>part.type==='text').map(part=>part.text).join('\n'):data.choices?.[0]?.message?.content;
 if(!answer||answer.length>100000)throw Object.assign(Error('The model returned an empty or oversized answer.'),{status:400});return answer;
}
const plain=text=>String(text||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').slice(0,30000);
async function getJSON(url,headers={}){let response;try{response=await fetch(url,{headers,signal:AbortSignal.timeout(25000)});}catch{throw Object.assign(Error('The job source is unreachable or timed out. Please try again later.'),{status:400});}if(!response.ok)throw Object.assign(Error(`Job source returned HTTP ${response.status}. Please try again later.`),{status:400});return response.json();}
let remoteCache=null,remoteExpires=0,remotePending=null;
async function remoteJobs(){if(remoteCache&&remoteExpires>Date.now())return remoteCache;if(!remotePending)remotePending=getJSON('https://remotive.com/api/remote-jobs').then(data=>{remoteCache=data;remoteExpires=Date.now()+6*3600000;return data;}).finally(()=>{remotePending=null;});return remotePending;}
export async function searchJobs({query='',location='',provider='remotive'}={}){
 const q=String(query).slice(0,200),place=String(location).slice(0,100);
 if(provider==='remotive'){
  const data=await remoteJobs(),terms=q.toLowerCase().split(/\s+/).filter(Boolean);return (data.jobs||[]).filter(item=>terms.every(term=>(item.title+' '+item.company_name+' '+(item.tags||[]).join(' ')+' '+plain(item.description)).toLowerCase().includes(term))).filter(item=>!place||String(item.candidate_required_location||'').toLowerCase().includes(place.toLowerCase())||/worldwide|anywhere/i.test(item.candidate_required_location||'')).slice(0,35).map(item=>({externalId:'remotive:'+item.id,company:item.company_name,role:item.title,description:plain(item.description),location:item.candidate_required_location,workMode:'Remote',url:item.url,salary:item.salary,tags:(item.tags||[]).slice(0,15),source:'Remotive'}));
 }
 if(provider==='adzuna'){
  if(!process.env.ADZUNA_APP_ID||!process.env.ADZUNA_APP_KEY)throw Object.assign(Error('Configure ADZUNA_APP_ID and ADZUNA_APP_KEY first.'),{status:400});
  const country=process.env.ADZUNA_COUNTRY||'in',url=new URL(`https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/search/1`);Object.entries({app_id:process.env.ADZUNA_APP_ID,app_key:process.env.ADZUNA_APP_KEY,what:q,where:place,results_per_page:'35'}).forEach(([key,value])=>url.searchParams.set(key,value));
  const data=await getJSON(url);return (data.results||[]).map(item=>({externalId:`adzuna:${item.id}`,company:item.company?.display_name,role:item.title,description:plain(item.description),location:item.location?.display_name,url:item.redirect_url,workMode:'',tags:[],source:'Adzuna',salary:item.salary_min?`${item.salary_min} – ${item.salary_max||item.salary_min}`:''}));
 }
 if(provider==='jsearch'){
  if(!process.env.JSEARCH_API_KEY)throw Object.assign(Error('Configure JSEARCH_API_KEY first.'),{status:400});
  const url=new URL('https://jsearch.p.rapidapi.com/search');url.searchParams.set('query',`${q} ${place}`);url.searchParams.set('num_pages','1');
  const data=await getJSON(url,{'X-RapidAPI-Key':process.env.JSEARCH_API_KEY,'X-RapidAPI-Host':'jsearch.p.rapidapi.com'});return (data.data||[]).slice(0,35).map(item=>({externalId:`jsearch:${item.job_id}`,company:item.employer_name,role:item.job_title,description:plain(item.job_description),location:[item.job_city,item.job_country].filter(Boolean).join(', '),url:item.job_apply_link,workMode:item.job_is_remote?'Remote':'',tags:[],source:'JSearch'}));
 }
 throw Object.assign(Error('Choose a supported job source.'),{status:400});
}
export async function startupJobs(query=''){
 const threads=await getJSON('https://hn.algolia.com/api/v1/search_by_date?query=Ask%20HN%3A%20Who%20is%20hiring&tags=story&hitsPerPage=5');
 const thread=threads.hits?.find(item=>/^Ask HN: Who is hiring\?/i.test(item.title||''));if(!thread)return [];
 const data=await getJSON(`https://hn.algolia.com/api/v1/items/${thread.objectID}`);
 return (data.children||[]).filter(item=>item.text&&!item.deleted).map(item=>{const description=plain(item.text),first=description.split(/\n| {2,}/)[0].slice(0,180);return {externalId:`hn:${item.id}`,company:first.split('|')[0].trim().slice(0,100),role:first,description,workMode:/remote/i.test(first)?'Remote':'',location:first.split('|').slice(1,3).join(' | ').slice(0,100),email:description.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0]||'',url:`https://news.ycombinator.com/item?id=${item.id}`,tags:[],source:'Hacker News'};}).filter(item=>!query||item.description.toLowerCase().includes(query.toLowerCase())).slice(0,40);
}
