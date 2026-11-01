import PDFDocument from 'pdfkit';
import {fileURLToPath} from 'node:url';
import {resumeThemes,fontFiles} from './resume-templates.js';

export const PAGE_WIDTH=595.28,PAGE_HEIGHT=841.89;
const INK='#26313b',MUTED='#62707a',LIGHT='#e2e7eb';
const measure=new PDFDocument({autoFirstPage:false});
function registerFonts(doc){for(const [key,file] of Object.entries(fontFiles))doc.registerFont(key,fileURLToPath(new URL('../assets/fonts/'+file,import.meta.url)));}
registerFonts(measure);
const fontKey=(serif=false,weight='regular')=>(serif?'PTSerif':'Lato')+(weight==='bold'?'Bold':weight==='italic'?'Italic':'');
function textWidth(text,font,size){return measure.font(font).fontSize(size).widthOfString(text,{features:['kern']});}
function ascent(font,size){measure.font(font);return measure._font.ascender/1000*size;}
function wrap(text,font,size,width){
 const words=String(text).trim().split(/\s+/).filter(Boolean),lines=[];let current='';
 for(const word of words){
  if(textWidth(current?current+' '+word:word,font,size)<=width){current=current?current+' '+word:word;continue;}
  if(current){lines.push(current);current='';}
  if(textWidth(word,font,size)<=width){current=word;continue;}
  let piece='';for(const char of word){if(piece&&textWidth(piece+char,font,size)>width){lines.push(piece);piece='';}piece+=char;}current=piece;
 }
 if(current)lines.push(current);return lines.length?lines:[''];
}
const knownHeadings=new Set(['SUMMARY','PROFESSIONAL SUMMARY','PROFILE','ABOUT ME','EXPERIENCE','WORK EXPERIENCE','PROFESSIONAL EXPERIENCE','EMPLOYMENT','PROJECTS','SELECTED PROJECTS','KEY PROJECTS','EDUCATION','QUALIFICATIONS','SKILLS','TECHNICAL SKILLS','TECHNOLOGIES','LANGUAGES','CERTIFICATIONS','CERTIFICATES','ACHIEVEMENTS','AWARDS','PUBLICATIONS','REFERENCES','INTERESTS','AREAS OF INTEREST','CAREER DETAILS']);
function heading(value){const clean=value.replace(/^#{1,4}\s+/,'').replace(/^\*\*|\*\*$/g,'').replace(/:$/,'').trim();const upper=clean.toUpperCase();return knownHeadings.has(upper)||(clean===upper&&/^[A-Z][A-Z &/()-]{2,54}$/.test(clean))?clean:null;}
function sectionKind(label){const upper=label.toUpperCase();return /SKILL|TECHNOLOG/.test(upper)?'skills':/LANGUAGE/.test(upper)?'languages':/EDUCATION|QUALIFICATION/.test(upper)?'education':/EXPERIENCE|EMPLOYMENT/.test(upper)?'experience':'body';}

export function parseResume(content){
 const blocks=String(content).replace(/\r\n?/g,'\n').split(/\n\s*\n/).map(value=>value.trim()).filter(Boolean),header=[],sections=[];let current=null,lineIndex=0;
 for(const block of blocks){let pending=[];const flush=()=>{if(!pending.length)return;if(current)current.paragraphs.push(pending.join('\n'));else header.push(...pending);pending=[];};
  for(const raw of block.split('\n')){const line=raw.trim();if(!line)continue;let label=heading(line);
   // An uppercase name is a name, not a section heading.
   if(lineIndex===0&&!knownHeadings.has(line.toUpperCase()))label=null;
   lineIndex++;
   if(label){flush();current={label,kind:sectionKind(label),paragraphs:[]};sections.push(current);}else pending.push(line);
  }flush();
 }
 const name=header.shift()||'Resume',contacts=[],roles=[],introduction=[];
 for(const line of header){if(/@|https?:\/\/|linkedin\.|github\.|\+?\d[\d ()-]{6,}|,\s*[A-Z][a-z]+$/.test(line))contacts.push(...line.split(/\s+\|\s+/));else if(line.length<150&&roles.length<2)roles.push(line);else introduction.push(line);}
 if(introduction.length)sections.unshift({label:'Profile',kind:'body',paragraphs:[introduction.join('\n')]});
 if(name.length>180)return {name:'Resume',roles:[],contacts:[],sections:[{label:'',kind:'body',paragraphs:blocks}]};
 return {name,roles,contacts,sections};
}

export function createResumeLayout(content,{theme='Classic',color,kind='resume'}={}){
 if(typeof content!=='string'||!content.trim()||content.length>100000)throw Object.assign(Error('Enter document text of up to 100,000 characters.'),{status:400});
 const selected=resumeThemes.find(item=>item.name===theme)||resumeThemes.find(item=>item.name==='Classic');
 const accent=/^#[a-f\d]{6}$/i.test(color||'')?color:selected.color,serif=selected.font==='Times-Roman',regular=fontKey(serif),bold=fontKey(serif,'bold'),italic=fontKey(serif,'italic');
 const layout=kind==='resume'?selected.layout:'letter',compact=layout==='compact',sidebar=layout==='sidebar',swiss=layout==='swiss',editorial=layout==='editorial',banner=layout==='banner',technical=layout==='technical',executive=layout==='executive';
 const parsed=kind==='resume'?parseResume(content):{name:'',roles:[],contacts:[],sections:[{label:'',kind:'body',paragraphs:content.replace(/\r/g,'').split(/\n\s*\n/).filter(Boolean)}]};
 const pages=[],margin=compact?36:editorial?53:44,bodySize=compact?9.5:sidebar?9.6:10.1,lineHeight=bodySize*(compact?1.31:1.4),bodyX=sidebar?210:swiss?151:margin,bodyWidth=PAGE_WIDTH-bodyX-margin,bottom=PAGE_HEIGHT-46;
 const rgb=[1,3,5].map(index=>parseInt(accent.slice(index,index+2),16)),brightness=(.299*rgb[0]+.587*rgb[1]+.114*rgb[2])/255,onAccent=brightness>.61?INK:'#ffffff',headingColor=brightness>.73?INK:accent;
 const add=(page,op)=>{page.operations.push(op);return op;};
 const rect=(page,x,y,width,height,fill,stroke)=>add(page,{type:'rect',x,y,width,height,fill,stroke});
 const rule=(page,x,y,width,color=LIGHT,strokeWidth=.65)=>add(page,{type:'line',x,y,x2:x+width,y2:y,color,strokeWidth});
 function text(page,value,x,y,font=regular,size=bodySize,color=INK){return add(page,{type:'text',text:value,x,y:y+ascent(font,size),font,size,color});}
 function block(page,value,x,y,width,{font=regular,size=bodySize,color=INK,align='left',leading=size*1.4}={}){
  for(const line of wrap(value,font,size,width)){const offset=align==='center'?(width-textWidth(line,font,size))/2:0;text(page,line,x+offset,y,font,size,color);y+=leading;}return y;
 }
 let firstTop=0;
 function makePage(index){
  if(index>39)throw Object.assign(Error('This document exceeds the 40-page preview limit. Shorten the content before exporting.'),{status:400});
  const page={operations:[],bodyTop:index===0?firstTop:78};
  rect(page,0,0,PAGE_WIDTH,PAGE_HEIGHT,'#ffffff');
  if(sidebar)rect(page,0,0,181,PAGE_HEIGHT,accent);
  if(index>0&&kind==='resume'){
   text(page,parsed.name,bodyX,31,bold,10.5,INK);rule(page,bodyX,57,bodyWidth,accent,.8);
   if(sidebar){text(page,'CONTINUED',23,30,'LatoBold',8.3,onAccent);rule(page,23,52,135,onAccent,.5);}
  }
  pages.push(page);return page;
 }
 const first=makePage(0);
 if(layout==='letter')firstTop=50;
 else if(sidebar){
  let y=38;y=block(first,parsed.name,bodyX,y,bodyWidth,{font:bold,size:29,leading:33});
  for(const role of parsed.roles)y=block(first,role,bodyX,y+8,bodyWidth,{font:regular,size:11.5,color:headingColor,leading:16});
  rule(first,bodyX,y+17,48,accent,2.4);firstTop=y+39;
 }else if(banner){
  let y=35;const nameLines=wrap(parsed.name,'LatoBold',31,PAGE_WIDTH-2*margin),roleLines=parsed.roles.flatMap(role=>wrap(role,'Lato',12,PAGE_WIDTH-2*margin)),contact=parsed.contacts.join('  |  '),contactLines=contact?wrap(contact,'Lato',8.7,PAGE_WIDTH-2*margin):[];
  const height=38+nameLines.length*36+(roleLines.length?roleLines.length*17+5:0)+(contactLines.length?contactLines.length*12+13:0)+20;
  rect(first,0,0,PAGE_WIDTH,height,accent);
  for(const line of nameLines){text(first,line,margin,y,'LatoBold',31,onAccent);y+=36;}
  if(roleLines.length)y+=5;for(const line of roleLines){text(first,line,margin,y,'Lato',12,onAccent);y+=17;}
  if(contactLines.length)y+=12;for(const line of contactLines){text(first,line,margin,y,'Lato',8.7,onAccent);y+=12;}
  firstTop=height+25;
 }else{
  let y=layout==='compact'?30:40;const center=executive,headerFont=editorial||executive?'PTSerif':'LatoBold',nameSize=compact?25:editorial?35:swiss?34:executive?31:30;
  if(swiss)rule(first,margin,26,44,accent,3);
  if(technical){rect(first,margin,27,35,3,accent);y=41;}
  y=block(first,parsed.name,margin,y,PAGE_WIDTH-2*margin,{font:headerFont,size:nameSize,leading:nameSize*1.16,align:center?'center':'left'});
  for(const role of parsed.roles)y=block(first,role,margin,y+6,PAGE_WIDTH-2*margin,{font:regular,size:11.5,leading:15.5,color:MUTED,align:center?'center':'left'});
  if(parsed.contacts.length)y=block(first,parsed.contacts.join('  |  '),margin,y+10,PAGE_WIDTH-2*margin,{font:'Lato',size:8.6,leading:12,color:MUTED,align:center?'center':'left'});
  if(editorial){rule(first,margin,y+16,PAGE_WIDTH-2*margin,accent,1.5);rule(first,margin,y+20,PAGE_WIDTH-2*margin,accent,.4);firstTop=y+40;}
  else if(layout==='minimal'){firstTop=y+26;}
  else{rule(first,margin,y+13,PAGE_WIDTH-2*margin,executive?accent:LIGHT,executive?.8:.7);firstTop=y+(compact?27:34);}
 }
 if(firstTop>340)throw Object.assign(Error('The resume header is too long. Move detailed text under a section heading.'),{status:400});
 first.bodyTop=firstTop;
 function flow(x,width,startY,side=false){
  return {x,width,page:0,y:startY,side,
   ensure(height){if(this.y+height>bottom){this.page++;this.y=side?76:78;if(!pages[this.page])makePage(this.page);}return pages[this.page];},
   line(value,{font=regular,size=bodySize,color=INK,indent=0,leading=lineHeight}={}){const page=this.ensure(leading);text(page,value,this.x+indent,this.y,font,size,color);this.y+=leading;},
   paragraph(value,options={}){
    const source=String(value).split('\n').filter(line=>line.trim());this.ensure(lineHeight*2);
    for(let index=0;index<source.length;index++){
     const raw=source[index].trim(),bullet=/^[•*\-]\s+/.test(raw),clean=bullet?raw.replace(/^[•*\-]\s+/,''):raw;
     let font=options.font||regular,color=options.color||INK,size=options.size||bodySize,indent=bullet?9:0;
     if(!options.plain&&!bullet&&source.length>1&&index===0)font=bold;
     else if(!options.plain&&!bullet&&index===1&&raw.length<110&&/\b(?:19\d\d|20\d\d|Present|Current)\b/i.test(raw)){font=italic;color=MUTED;size=bodySize-.2;}
     const lines=wrap(clean,font,size,this.width-indent);
     for(let line=0;line<lines.length;line++){const page=this.ensure(options.leading||lineHeight);if(bullet&&line===0)text(page,'•',this.x,this.y,font,size,color);text(page,lines[line],this.x+indent,this.y,font,size,color);this.y+=options.leading||lineHeight;}
     if(bullet)this.y+=compact?1.4:2.2;
    }
    this.y+=options.gap??(compact?5:9);
   }
  };
 }
 const main=flow(bodyX,bodyWidth,firstTop),side=sidebar?flow(23,135,35,true):null;
 let sectionIndex=0;
 function sectionTitle(target,label,{sideLabel=false}={}){
  if(!label)return;const page=target.ensure(lineHeight*2+31);
  if(sideLabel){text(page,label.toUpperCase(),target.x,target.y,'LatoBold',8.4,onAccent);rule(page,target.x,target.y+17,target.width,onAccent,.45);target.y+=29;return;}
  if(swiss){const title=wrap(label.toUpperCase(),'LatoBold',8.1,89);for(let i=0;i<title.length;i++)text(page,title[i],margin,target.y+i*11,'LatoBold',8.1,headingColor);rule(page,target.x,target.y-7,target.width,LIGHT,.5);return;}
  if(editorial){text(page,label,target.x,target.y,'PTSerifItalic',15.4,headingColor);target.y+=26;}
  else if(technical){sectionIndex++;rect(page,target.x,target.y,21,16,accent);text(page,String(sectionIndex).padStart(2,'0'),target.x+5,target.y+2,'LatoBold',8,onAccent);text(page,label.toUpperCase(),target.x+30,target.y+1,'LatoBold',10,headingColor);rule(page,target.x,target.y+23,target.width,LIGHT,.6);target.y+=34;}
  else if(layout==='minimal'){rect(page,target.x,target.y+4,3,10,accent);text(page,label.toUpperCase(),target.x+12,target.y,'LatoBold',10.1,INK);target.y+=24;}
  else{text(page,label.toUpperCase(),target.x,target.y,bold,compact?9.3:10.5,headingColor);rule(page,target.x,target.y+(compact?16:19),target.width,LIGHT,.65);target.y+=compact?23:28;}
 }
 if(side&&parsed.contacts.length){sectionTitle(side,'Contact',{sideLabel:true});for(const contact of parsed.contacts)side.paragraph(contact,{font:'Lato',size:8.4,color:onAccent,plain:true,leading:12,gap:8});side.y+=16;}
 for(const section of parsed.sections){
  if(!section.paragraphs.length)continue;
  if(side&&['skills','languages'].includes(section.kind)){
   sectionTitle(side,section.label,{sideLabel:true});
   const items=section.paragraphs.join(' · ').split(/\s*·\s*|\n/).map(item=>item.trim()).filter(Boolean);
   for(const item of items)side.paragraph(item,{font:'Lato',size:8.5,color:onAccent,plain:true,leading:11.8,gap:4.5});side.y+=17;continue;
  }
  sectionTitle(main,section.label);
  if(technical&&section.kind==='skills'){
   const lines=wrap(section.paragraphs.join(' · '),'Lato',9.4,main.width-22),height=lines.length*13+20;
   if(height<bottom-main.y){const page=main.ensure(height+10);rect(page,main.x,main.y,main.width,height,'#f0f5f9');for(const line of lines){text(page,line,main.x+11,main.y+9,'Lato',9.4,INK);main.y+=13;}main.y+=27;}
   else for(const paragraph of section.paragraphs)main.paragraph(paragraph,{plain:true});
  }else for(const paragraph of section.paragraphs)main.paragraph(paragraph,{plain:section.kind==='skills'||section.kind==='languages'});
  main.y+=compact?6:swiss?19:13;
 }
 for(let index=0;index<pages.length;index++){
  const page=pages[index];rule(page,bodyX,PAGE_HEIGHT-30,bodyWidth,LIGHT,.5);
  const footer=kind==='resume'?(parsed.name+'  ·  '+(index+1)+' / '+pages.length):(index+1)+' / '+pages.length;
  const font='Lato',size=7.4;text(page,footer,PAGE_WIDTH-margin-textWidth(footer,font,size),PAGE_HEIGHT-23,font,size,MUTED);
 }
 return {width:PAGE_WIDTH,height:PAGE_HEIGHT,template:selected.name,layout,pageCount:pages.length,pages};
}

export async function pdfFromLayout(layout){
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({autoFirstPage:false,size:'A4',margin:0,info:{Title:'Application Desk resume'}}),chunks=[];registerFonts(doc);
  doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
  try{
   for(const page of layout.pages){doc.addPage({size:[layout.width,layout.height],margin:0});for(const op of page.operations){
    if(op.type==='rect'){doc.save().rect(op.x,op.y,op.width,op.height).fill(op.fill);if(op.stroke)doc.rect(op.x,op.y,op.width,op.height).stroke(op.stroke);doc.restore();}
    else if(op.type==='line')doc.save().strokeColor(op.color).lineWidth(op.strokeWidth).moveTo(op.x,op.y).lineTo(op.x2,op.y2).stroke().restore();
    else if(op.type==='text')doc.font(op.font).fontSize(op.size).fillColor(op.color).text(op.text,op.x,op.y,{baseline:'alphabetic',lineBreak:false,features:['kern']});
   }}doc.end();
  }catch(error){doc.end();reject(error);}
 });
}
