export function ensureProfileLinks(body=''){
 let result=body;
 for(const [key,label] of [['portfolio-url','Portfolio'],['resume-url','Resume']]){
  const hasVariable=new RegExp('\\{\\{\\s*'+key+'\\s*\\}\\}').test(result);
  const hasLink=new RegExp(label+':\\s*https?://\\S+','i').test(result);
  if(!hasVariable&&!hasLink)result+=`${result.trim()?'\n\n':''}${label}: {{${key}}}`;
 }
 return result;
}
export async function initializeProfileLinks(Template,Settings){
 const profile=await Settings.findById('profile');
 if(profile?.profileLinksVersion)return;
 const variables=Object.fromEntries(profile?.variables||[]);
 for(const key of ['github-url','portfolio-url','resume-url'])variables[key]??='';
 for await(const template of Template.find().cursor()){
  const body=ensureProfileLinks((template.body||'').replace(/GitHub: \{\{\s*portfolio-url\s*\}\}/g,'GitHub: {{github-url}}').replace(/My GitHub is \{\{\s*portfolio-url\s*\}\}/g,'My GitHub is {{github-url}}'));
  if(body!==template.body)await Template.updateOne({_id:template._id},{$set:{body}});
 }
 await Settings.findByIdAndUpdate('profile',{variables,profileLinksVersion:'generic-links-v1'},{upsert:true});
}
