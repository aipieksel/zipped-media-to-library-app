import {requireMembership} from './auth.mjs';
import {HttpError,json,failure,assertOrigin,bodyJSON,boundedBytes,sha256,rateLimit,method} from './auth-common.mjs';

const PREFIX='/api/workspace/';
const OBJECT_PREFIX='folio/shared/blobs/';
const MAX_BLOB=8*1024*1024;
const MAX_DOCUMENT=1024*1024;
const HASH=/^[a-f0-9]{64}$/;
const DOCUMENTS=new Set(['library','icons','appearance']);

function document(name,row) {
  return row ? {name,revision:row.revision,data:JSON.parse(row.data),blobs:JSON.parse(row.blobs),updatedAt:row.updated_at} : {name,revision:0,data:null,blobs:[],updatedAt:null};
}
function validateMetadata(value) {
  if (value!==null && (typeof value!=='object'||Array.isArray(value))) throw new HttpError(400,'data','Shared document data must be an object or null.');
  const stack=[[value,0]];
  let nodes=0;
  while(stack.length) {
    const [current,depth]=stack.pop();
    if (++nodes>100_000||depth>32) throw new HttpError(400,'data','The shared document is too complex.');
    if(current&&typeof current==='object') for(const child of Object.values(current)) stack.push([child,depth+1]);
  }
}

export async function handleWorkspace(request,env) {
  const path=new URL(request.url).pathname;
  if(!path.startsWith(PREFIX)) return null;
  try {
    const member=await requireMembership(request,env);
    if(member instanceof Response) return member;
    if(!['GET','HEAD'].includes(request.method)) assertOrigin(request,env);
    const documentPath=path.match(/^\/api\/workspace\/documents\/([a-z]+)$/);
    if(documentPath&&DOCUMENTS.has(documentPath[1])) {
      const name=documentPath[1];
      if(request.method==='GET') {
        const row=await env.DB.prepare('SELECT revision,data,blobs,updated_at FROM folio_documents WHERE name=?').bind(name).first();
        return json(document(name,row));
      }
      method(request,'PUT');
      await rateLimit(env,'documents',member.id,300);
      const body=await bodyJSON(request,MAX_DOCUMENT);
      if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||body.expectedRevision>=2_147_483_647) throw new HttpError(400,'revision','Supply the current document revision.');
      validateMetadata(body.data);
      if(!Array.isArray(body.blobs)||body.blobs.length>10_000||body.blobs.some(hash=>typeof hash!=='string'||!HASH.test(hash))||new Set(body.blobs).size!==body.blobs.length) throw new HttpError(400,'blobs','Supply a unique list of valid blob hashes.');
      const data=JSON.stringify(body.data),blobs=JSON.stringify(body.blobs),now=Date.now();
      if(body.blobs.length) {
        const row=await env.DB.prepare('SELECT COUNT(*) AS count FROM folio_blobs WHERE hash IN (SELECT value FROM json_each(?))').bind(blobs).first();
        if(row.count!==body.blobs.length) throw new HttpError(409,'missing_blobs','Upload all source and result chunks before saving this shared document.');
      }
      // Blobs are immutable and never deleted by this service. The prerequisite
      // check therefore cannot race a delete between this query and the CAS.
      const result=body.expectedRevision===0
        ? await env.DB.prepare('INSERT INTO folio_documents(name,revision,data,blobs,updated_at,updated_by) VALUES (?,1,?,?,?,?) ON CONFLICT(name) DO NOTHING').bind(name,data,blobs,now,member.id).run()
        : await env.DB.prepare('UPDATE folio_documents SET revision=revision+1,data=?,blobs=?,updated_at=?,updated_by=? WHERE name=? AND revision=?').bind(data,blobs,now,member.id,name,body.expectedRevision).run();
      if(result.meta.changes!==1) {
        const current=await env.DB.prepare('SELECT revision FROM folio_documents WHERE name=?').bind(name).first();
        throw new HttpError(409,'conflict','The workspace changed in another session. Refresh and review before saving.',{revision:current?.revision??0});
      }
      return json({name,revision:body.expectedRevision+1,data:body.data,blobs:body.blobs,updatedAt:now});
    }
    const blobPath=path.match(/^\/api\/workspace\/blobs\/([a-f0-9]{64})$/);
    if(blobPath) {
      if(!env.BUCKET) throw new HttpError(503,'storage','Shared file storage is unavailable.');
      const hash=blobPath[1],key=OBJECT_PREFIX+hash;
      if(request.method==='PUT') {
        if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/octet-stream') throw new HttpError(415,'content_type','Upload raw bytes as application/octet-stream.');
        await rateLimit(env,'blob-upload',member.id,200);
        const bytes=await boundedBytes(request,MAX_BLOB);
        if(await sha256(bytes)!==hash) throw new HttpError(400,'checksum','The uploaded file does not match its checksum.');
        const existing=await env.BUCKET.head(key);
        if(!existing) await env.BUCKET.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},sha256:hash,httpMetadata:{contentType:'application/octet-stream'},customMetadata:{sha256:hash}});
        const stored=existing||await env.BUCKET.head(key);
        if(!stored||stored.size!==bytes.byteLength||stored.customMetadata?.sha256!==hash) throw new HttpError(503,'storage','The uploaded file could not be verified. Try again.');
        await env.DB.prepare('INSERT INTO folio_blobs(hash,size,created_at,created_by) VALUES (?,?,?,?) ON CONFLICT(hash) DO NOTHING').bind(hash,bytes.byteLength,Date.now(),member.id).run();
        return json({hash,size:bytes.byteLength});
      }
      if(!['GET','HEAD'].includes(request.method)) throw new HttpError(405,'method','Use GET, HEAD or PUT for a shared file.');
      const row=await env.DB.prepare('SELECT b.size FROM folio_blobs b WHERE b.hash=? AND EXISTS (SELECT 1 FROM folio_documents d,json_each(d.blobs) reference WHERE reference.value=b.hash)').bind(hash).first();
      if(!row) throw new HttpError(404,'not_found','This shared file is unavailable.');
      const stored=request.method==='HEAD'?await env.BUCKET.head(key):await env.BUCKET.get(key);
      if(!stored||stored.size!==row.size) throw new HttpError(404,'not_found','This shared file is unavailable.');
      return new Response(request.method==='HEAD'?null:stored.body,{headers:{
        'content-type':'application/octet-stream','content-length':String(row.size),
        'cache-control':'private, no-store','pragma':'no-cache','expires':'0','vary':'Cookie',
        'x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin',
        'content-security-policy':"default-src 'none'; sandbox",'content-disposition':'attachment',
      }});
    }
    throw new HttpError(404,'not_found','This shared workspace action does not exist.');
  } catch(error) { return failure(error); }
}
