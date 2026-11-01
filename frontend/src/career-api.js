export async function career(path,method='GET',body,options={}){
 const response=await fetch('/api/career/'+path,{method,signal:options.signal,headers:{'X-Requested-With':'ApplicationDesk',...(!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});
 let data;try{data=await response.json();}catch{throw Error('The workspace service is unavailable. Please try again.');}
 if(!response.ok)throw Error(data.error||'Unable to complete the request.');return data;
}
export const blankProfile={name:'',headline:'',email:'',phone:'',city:'',country:'',website:'',linkedin:'',github:'',resumeUrl:'',summary:'',skills:[],languages:[],experience:[],projects:[],education:[],publications:[],references:[],resumeText:'',sectionOrder:['experience','projects','education','publications','references']};
export function downloadJSON(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();URL.revokeObjectURL(url);}
export function localDateTime(value){const date=value?new Date(value):new Date();return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
