/* Fictional inbox only. Never overwrite the v1 map or another reply. */
(function(root){
'use strict';
const prefix='goose-fictional-inbox-replies-v2:',legacy='goose-fictional-inbox-replies-v1';
function create({storage,locks,normalize,ids,uuid,now}){
 function put(key,value){const data=JSON.stringify(value);storage.setItem(key,data);if(storage.getItem(key)!==data)throw Error('unconfirmed');}
 function migrate(){
  if(storage.getItem(prefix+'migration'))return;
  // Freeze the first observable legacy snapshot. Interrupted migration resumes it,
  // never a later stale v1 overwrite. No original data is deleted.
  let snapshot=storage.getItem(prefix+'snapshot');
  if(snapshot===null){const raw=storage.getItem(legacy)||'{}';JSON.parse(raw);storage.setItem(prefix+'snapshot',raw);snapshot=storage.getItem(prefix+'snapshot');if(snapshot!==raw)throw Error('unconfirmed');}
  const source=JSON.parse(snapshot);
  for(const id of ids){const list=Array.isArray(source?.[id])?source[id].map(normalize).filter(Boolean).slice(-30):[];list.forEach((reply,n)=>{const key=prefix+'entry:legacy:'+id+':'+n;if(storage.getItem(key)===null)put(key,{...reply,card:id,order:n,legacy:true});});}
  put(prefix+'migration',true);
 }
 function read(){const out=Object.fromEntries(ids.map(id=>[id,[]]));for(let n=0;n<storage.length;n++){const key=storage.key(n);if(!key?.startsWith(prefix+'entry:'))continue;const value=JSON.parse(storage.getItem(key));const reply=normalize(value);if(!reply||!ids.includes(value.card))throw Error('invalid saved reply');out[value.card].push({...reply,order:value.order,legacy:!!value.legacy,key});}for(const list of Object.values(out))list.sort((a,b)=>Number(b.legacy)-Number(a.legacy)||(a.order-b.order)||a.key.localeCompare(b.key));return out;}
 async function locked(work){if(!locks?.request)throw Error('serialization unavailable');return locks.request(prefix+'write',()=>{migrate();return work();});}
 return {load:()=>locked(read),append:(card,body)=>locked(()=>{if(!ids.includes(card)||!normalize(body))throw Error('invalid reply');const before=read();if(before[card].length>=30)throw Error('limit');let key=prefix+'entry:'+uuid();if(storage.getItem(key)!==null)throw Error('id collision');const createdAt=now();put(key,{card,body,createdAt,order:Date.parse(createdAt),legacy:false});return read();})};
}
const api={create,prefix,legacy};if(typeof module==='object'&&module.exports)module.exports=api;root.GooseReplyStore=api;
})(typeof window==='undefined'?globalThis:window);
