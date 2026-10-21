// RFC 6068 supports message text, not MIME attachments.
export function buildMailtoUrl({to,subject,body}){
 const normalized=body.replace(/\r?\n/g,'\r\n');
 return `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(normalized)}`;
}
