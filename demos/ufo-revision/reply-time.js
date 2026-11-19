/* Public demo timestamps: preserve stored instants, never date undated history. */
(function(root){
'use strict';
function valid(value){return typeof value==='string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value));}
function normalize(reply){
 const body=typeof reply==='string'?reply:reply&&reply.body;
 if(typeof body!=='string'||!body.trim()||body.length>1200)return null;
 return {body,createdAt:valid(reply&&reply.createdAt)?reply.createdAt:null};
}
function html(value,locale){
 const en=String(locale||'').toLowerCase().startsWith('en');
 if(!valid(value)||value==='1970-01-01T00:00:00.000Z')return '<span class="reply-time">'+(en?'Time not recorded':'时间未记录')+'</span>';
 const iso=new Date(value).toISOString();
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso));
 const t=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return '<time class="reply-time" datetime="'+iso+'">'+t.year+'-'+t.month+'-'+t.day+' '+t.hour+':'+t.minute+':'+t.second+' · '+(en?'Shanghai':'上海')+' UTC+8</time>';
}
const api={valid,normalize,html};
if(typeof module==='object'&&module.exports)module.exports=api;
root.GooseReplyTime=api;
})(typeof window==='undefined'?globalThis:window);
