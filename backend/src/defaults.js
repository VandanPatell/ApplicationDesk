// Starter templates are generic. Existing workspaces retain their saved templates.
export const defaultVariables={
 'candidate-name':'','candidate-email':'','candidate-phone':'','candidate-city':'',
 'experience':'','skills':'','portfolio-url':'','resume-url':'','github-url':'','linkedin-url':''
};
const signature='Best regards,\n{{candidate-name}}\n{{candidate-email}} | {{candidate-phone}}\nPortfolio: {{portfolio-url}}\nResume: {{resume-url}}\nGitHub: {{github-url}}\nLinkedIn: {{linkedin-url}}';
export const defaultTemplates=[
 {defaultKey:'backend-v1',name:'Backend application',subject:'Application for {{job-title}} — {{candidate-name}}',body:`Hello {{company-name}} hiring team,\n\nI would like to apply for the {{job-title}} position. I have {{experience}} of experience, with a background in {{skills}}.\n\nI would welcome an opportunity to discuss how my experience and projects could support your backend engineering team. My work is available at {{portfolio-url}}, and my resume is linked below.\n\nThank you for your consideration.\n\n${signature}`},
 {defaultKey:'fullstack-v1',name:'Full-stack application',subject:'Full-stack opportunity: {{job-title}} — {{candidate-name}}',body:`Hello {{company-name}} team,\n\nI am interested in your {{job-title}} opening. My background includes {{experience}} of experience and skills in {{skills}}.\n\nI would appreciate the chance to discuss the role and share relevant examples of my work. You can review my projects at {{portfolio-url}} and my resume below.\n\n${signature}`},
 {defaultKey:'specialist-v1',name:'Specialist role application',subject:'Application: {{job-title}} — {{candidate-name}}',body:`Hello {{company-name}} team,\n\nI would like to be considered for {{job-title}}. My relevant skills include {{skills}}, with {{experience}} of experience.\n\nI would welcome a conversation about your requirements and the projects that best demonstrate my fit. My portfolio and resume are linked below.\n\n${signature}`},
 {defaultKey:'posting-response-v1',name:'WhatsApp / LinkedIn posting response',subject:'Interested in {{job-title}} at {{company-name}} — {{candidate-name}}',body:`Hello {{company-name}} team,\n\nI came across your {{job-title}} opening and would like to apply. I have {{experience}} of experience, with a focus on {{skills}}.\n\nCould you let me know the next steps for this opportunity? My portfolio and resume are linked below.\n\n${signature}`},
 {defaultKey:'followup-v1',name:'Application follow-up',subject:'Following up: {{job-title}} — {{candidate-name}}',body:`Hello {{company-name}} hiring team,\n\nI am following up on my application for {{job-title}}. I remain interested in the opportunity and would appreciate any update on the hiring process.\n\nI would be happy to provide any additional information. Thank you for your time and consideration.\n\n${signature}`},
 {defaultKey:'referral-v1',name:'Referral / recruiter introduction',subject:'Exploring {{job-title}} opportunities at {{company-name}}',body:`Hello,\n\nI am {{candidate-name}}, based in {{candidate-city}}, with {{experience}} of experience. I am exploring {{job-title}} opportunities at {{company-name}} and would appreciate your guidance on the hiring process or an appropriate contact.\n\nMy background includes {{skills}}. If you feel my experience is relevant, I would be grateful for a referral or introduction. My portfolio and resume are linked below.\n\nThank you for your time.\n\n${signature}`}
];
export async function initializeDefaults(Template,Settings){
 const current=await Settings.findById('profile');
 if(current?.resumeDefaultsVersion||current?.starterDefaultsVersion)return;
 for(const item of defaultTemplates)await Template.updateOne({defaultKey:item.defaultKey},{$setOnInsert:item},{upsert:true});
 const variables={...defaultVariables,...Object.fromEntries(current?.variables||[])};
 await Settings.findByIdAndUpdate('profile',{variables,starterDefaultsVersion:'generic-v1'},{upsert:true});
}
