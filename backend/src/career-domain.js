export const profileSections=['experience','projects','education','publications','references'];
const text=(value,max=10000)=>typeof value==='string'?value.trim().slice(0,max):'';
export function cleanProfile(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))input={};
 const result={};
 for(const key of ['name','headline','email','phone','city','country','website','resumeUrl','linkedin','github','summary','resumeText'])result[key]=text(input[key],key==='resumeText'?60000:10000);
 for(const key of ['skills','languages'])result[key]=(Array.isArray(input[key])?input[key]:[]).slice(0,150).map(item=>text(item,100)).filter(Boolean);
 for(const key of profileSections)result[key]=(Array.isArray(input[key])?input[key]:[]).slice(0,60).filter(item=>item&&typeof item==='object').map(item=>({title:text(item.title,300),organization:text(item.organization,300),period:text(item.period,100),details:text(item.details),url:text(item.url,1000)}));
 result.sectionOrder=[...new Set([...(Array.isArray(input.sectionOrder)?input.sectionOrder:[]).filter(key=>profileSections.includes(key)),...profileSections])];
 return result;
}
export function profileStrength(profile){const values=[profile.name,profile.headline,profile.email,profile.summary,profile.skills?.length,profile.experience?.some(entry=>entry.title||entry.details)||profile.projects?.some(entry=>entry.title||entry.details),profile.education?.some(entry=>entry.title||entry.details),profile.city||profile.country];return Math.round(values.filter(Boolean).length/values.length*100);}
const skillNames=['React','Node.js','JavaScript','TypeScript','MongoDB','Express','MERN','Python','Java','SQL','PostgreSQL','Docker','Kubernetes','AWS','Azure','Git','HTML','CSS','Next.js','Angular','Vue','Django','Flask','FastAPI','GraphQL','REST','Redis','Linux','Figma','Excel','Machine Learning','TensorFlow','PyTorch','C++','C#','.NET','Go','Rust','PHP','Laravel','CI/CD'];
const pattern=skill=>new RegExp(`(^|[^a-z0-9])${skill.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}($|[^a-z0-9])`,'i');
export function matchJob(profile,job){
 const posting=[job.role,job.description,...(job.tags||[])].join(' '),facts=[...(profile.skills||[]),profile.headline,profile.summary,profile.resumeText,...profileSections.flatMap(section=>(profile[section]||[]).map(entry=>`${entry.title} ${entry.details}`))].join(' ');
 const seen=new Set();const requirements=[...skillNames,...(profile.skills||[])].filter(skill=>{if(typeof skill!=='string'||!skill.trim()||seen.has(skill.toLowerCase()))return false;seen.add(skill.toLowerCase());return pattern(skill).test(posting);});
 const matched=requirements.filter(skill=>pattern(skill).test(facts)),gaps=requirements.filter(skill=>!matched.includes(skill));
 return {score:requirements.length?Math.round(matched.length/requirements.length*100):null,matched,gaps,requirements,method:'Keyword overlap with your saved profile, not an eligibility decision.'};
}
export function extractPosting(value){
 const posting=text(value,60000),lines=posting.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 const field=label=>posting.match(new RegExp(`(?:^|\\n)(?:${label})\\s*[:–-]\\s*([^\\n]+)`,'i'))?.[1]?.trim()||'';
 const url=posting.match(/https?:\/\/[^\s<>]+/)?.[0]||'',email=posting.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0]||'';
 const workMode=/\bhybrid\b/i.test(posting)?'Hybrid':/\bremote\b/i.test(posting)?'Remote':/on[- ]site|work from office/i.test(posting)?'On-site':'';
 return {company:field('company|organization'),role:field('job title|role|position|title')||lines[0]?.slice(0,200)||'',description:posting,email,url,workMode,location:field('location|city'),salary:field('salary|compensation|ctc'),tags:skillNames.filter(skill=>pattern(skill).test(posting)),source:'Other',status:'Saved',replied:false};
}
export function resumeText(profile,{skills=profile.skills||[]}={}){
 const pieces=[profile.name,profile.headline,[profile.email,profile.phone,[profile.city,profile.country].filter(Boolean).join(', '),profile.website,profile.linkedin,profile.github].filter(Boolean).join(' | ')];
 if(profile.summary)pieces.push('SUMMARY',profile.summary);
 if(skills.length)pieces.push('SKILLS',skills.join(' · '));
 for(const section of profile.sectionOrder||profileSections){if(profile[section]?.length)pieces.push(section.toUpperCase(),...profile[section].map(entry=>[`${entry.title}${entry.organization?' — '+entry.organization:''}`,entry.period,entry.details,entry.url].filter(Boolean).join('\n')));}
 if(profile.languages?.length)pieces.push('LANGUAGES',profile.languages.join(', '));
 if(profile.resumeText&&!profile.experience?.length&&!profile.projects?.length)pieces.push('CAREER DETAILS',profile.resumeText);
 return pieces.filter(Boolean).join('\n\n');
}
export function createDraft(profile,job,tone='Professional'){
 const match=matchJob(profile,job),matched=new Set(match.matched.map(skill=>skill.toLowerCase())),skills=[...(profile.skills||[])].sort((a,b)=>Number(matched.has(b.toLowerCase()))-Number(matched.has(a.toLowerCase())));
 const greeting=`Dear ${job.company} hiring team,`,allFacts=[profile.summary,...(profile.experience||[]).slice(0,2).map(entry=>`${entry.title}${entry.organization?' at '+entry.organization:''}. ${entry.details}`)].filter(Boolean),facts=tone==='Concise'?allFacts.slice(0,1):allFacts;
 const intro=tone==='Concise'?`I am applying for ${job.role} at ${job.company}.`:tone==='Warm'?`I was excited to learn about the ${job.role} opportunity at ${job.company}.`:`I am writing to apply for the ${job.role} position at ${job.company}.`;
 const closing=[`Best regards,`,profile.name,profile.email,profile.website&&`Portfolio: ${profile.website}`,profile.resumeUrl&&`Resume: ${profile.resumeUrl}`].filter(Boolean).join('\n');
 return {resume:resumeText(profile,{skills}),coverLetter:[greeting,intro,...facts,match.matched.length?`My background includes ${match.matched.join(', ')}.`:'I would welcome the opportunity to discuss how my background fits your needs.',`Thank you for considering my application. I look forward to hearing from you.`,closing].join('\n\n'),email:[`Subject: Application for ${job.role} — ${profile.name||'Candidate'}`,greeting,intro,profile.summary||'',`Please find my resume and cover letter attached. I would welcome an opportunity to discuss the role.`,closing].filter(Boolean).join('\n\n'),match,source:'profile',tone};
}
export function icsEscape(text=''){return String(text).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');}
export function makeCalendar(events){const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Application Desk//Interviews//EN',...events.flatMap(event=>['BEGIN:VEVENT',`UID:${event._id}@applicationdesk.local`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(event.start)}`,`DTEND:${stamp(event.end)}`,`SUMMARY:${icsEscape(event.title)}`,`LOCATION:${icsEscape(event.location||event.meetingUrl)}`,`DESCRIPTION:${icsEscape(event.notes)}`,'END:VEVENT']),'END:VCALENDAR',''].join('\r\n');}
export const resumeThemes=[['Classic','#252525','Times-Roman'],['Modern','#263e55','Helvetica'],['Editorial','#514036','Times-Roman'],['Minimal','#353535','Helvetica'],['Slate','#475569','Helvetica'],['Forest','#315744','Times-Roman'],['Ocean','#245776','Helvetica'],['Burgundy','#783d48','Times-Roman'],['Sand','#826641','Times-Roman'],['Midnight','#343661','Helvetica'],['Terracotta','#9a523c','Times-Roman'],['Monochrome','#111111','Helvetica']].map(([name,color,font])=>({name,color,font}));
