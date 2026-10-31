import assert from 'node:assert/strict';
import test from 'node:test';
import {environment,client,setupOwner,setupMember} from './folio-auth-helpers.mjs';
import {sha256} from '../worker/auth-common.mjs';

test('two independent authenticated clients share immutable bytes and revisioned manifests',async t=>{
  const env=await environment();t.after(()=>env.DB.close());
  const {owner,response}=await setupOwner(env);assert.equal(response.status,201);
  const {member,response:registered}=await setupMember(env,owner);assert.equal(registered.status,201);
  const memberId=(await registered.json()).account.id;
  const anonymous=client(env);
  const documents='/api/workspace/documents/',blobs='/api/workspace/blobs/';
  assert.equal((await anonymous.request(documents+'icons')).status,401);
  assert.equal((await anonymous.request(documents+'icons','PUT',{expectedRevision:0,data:{},blobs:[]})).status,401);
  assert.deepEqual(await (await owner.request(documents+'icons')).json(),{name:'icons',revision:0,data:null,blobs:[],updatedAt:null});
  const bytes=new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><path fill="#123456" d="M0 0h2v2H0z"/></svg>');
  const hash=await sha256(bytes),path=blobs+hash;
  assert.equal((await owner.request(path,'PUT',new Uint8Array([1,2,3]))).status,400);
  assert.equal(env.BUCKET.values.size,0);
  assert.equal((await owner.request(path,'PUT',bytes,{origin:'https://evil.test'})).status,403);
  assert.equal((await owner.request(path,'PUT',bytes)).status,200);
  assert.equal((await member.request(path)).status,404,'staged uploads are not readable before publication');
  assert.equal((await owner.request(path,'PUT',bytes)).status,200);assert.equal(env.BUCKET.values.size,1);
  const data={version:1,folders:[{id:'uncategorized',name:'Uncategorized'}],icons:[{id:'stable-source-id',filename:'icon.svg',svg:{chunks:[hash],type:'image/svg+xml'},color:'#123456',verified:false}]};
  const saved=await owner.request(documents+'icons','PUT',{expectedRevision:0,data,blobs:[hash]});
  assert.equal(saved.status,200,await saved.clone().text());assert.equal((await saved.json()).revision,1);
  const remote=await (await member.request(documents+'icons')).json();assert.deepEqual(remote.data,data);assert.deepEqual(remote.blobs,[hash]);
  const fetched=await member.request(path);assert.equal(fetched.status,200);assert.deepEqual(new Uint8Array(await fetched.arrayBuffer()),bytes);
  for(const verb of ['GET','HEAD']) {
    const result=await member.request(path,verb,undefined,{'if-none-match':'a-previous-etag'});
    assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(result.headers.get('etag'),null);
    if(verb==='HEAD')assert.equal(await result.text(),'');
  }
  const missing=await owner.request(documents+'icons','PUT',{expectedRevision:1,data:{},blobs:['f'.repeat(64)]});assert.equal(missing.status,409);assert.equal((await missing.json()).code,'missing_blobs');
  const concurrent=await Promise.all([
    owner.request(documents+'icons','PUT',{expectedRevision:1,data:{...data,editedBy:'owner'},blobs:[hash]}),
    member.request(documents+'icons','PUT',{expectedRevision:1,data:{...data,editedBy:'member'},blobs:[hash]}),
  ]);
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
  const current=await (await member.request(documents+'icons')).json();assert.equal(current.revision,2);
  assert.deepEqual(await (await owner.request(documents+'icons')).json(),current);
  assert.equal((await member.request(documents+'appearance','PUT',{expectedRevision:0,data:{accent:'#123456'},blobs:[]})).status,200);
  assert.equal((await (await owner.request(documents+'appearance')).json()).data.accent,'#123456');
  assert.equal((await owner.request(documents+'library','PUT',{expectedRevision:3,data:{},blobs:[]})).status,409,'a stale nonzero revision cannot create a missing document');
  assert.equal((await owner.request(documents+'icons','PUT',{expectedRevision:2,data:{},blobs:[hash,hash]})).status,400);
  const excessive=await owner.request(documents+'icons','PUT',{expectedRevision:2,data:{value:'x'.repeat(1024*1024)},blobs:[]});assert.equal(excessive.status,413);
  const loggedOutCookie=member.cookie;
  assert.equal((await member.request('/api/folio-auth/logout','POST',{})).status,200);
  member.cookie=loggedOutCookie;
  const denied=await member.request(path);assert.equal(denied.status,401);assert(!((await denied.text()).includes('<svg')));
  assert.equal((await owner.request('/api/folio-auth/members/'+memberId,'PATCH',{status:'disabled'})).status,200);
  assert.equal((await member.request(documents+'icons')).status,401);
});

test('incomplete uploads do not publish metadata and failed publication can retry',async t=>{
  const env=await environment();t.after(()=>env.DB.close());const {owner}=await setupOwner(env);
  const bytes=new Uint8Array([7,8,9,10]),hash=await sha256(bytes),path='/api/workspace/blobs/'+hash;
  const put=env.BUCKET.put.bind(env.BUCKET);env.BUCKET.put=async()=>{throw new Error('synthetic object-store interruption');};
  assert.equal((await owner.request(path,'PUT',bytes)).status,503);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM folio_blobs').first()).count,0);
  assert.equal((await owner.request('/api/workspace/documents/library','PUT',{expectedRevision:0,data:{files:[{id:'stable-id',chunks:[hash]}]},blobs:[hash]})).status,409);
  env.BUCKET.put=put;assert.equal((await owner.request(path,'PUT',bytes)).status,200);
  const body={expectedRevision:0,data:{files:[{id:'stable-id',chunks:[hash]}]},blobs:[hash]};
  assert.equal((await owner.request('/api/workspace/documents/library','PUT',body)).status,200);
  assert.equal((await owner.request('/api/workspace/documents/library','PUT',body)).status,409);
  assert.equal((await (await owner.request('/api/workspace/documents/library')).json()).data.files.length,1);
  const huge=new Uint8Array(8*1024*1024+1);
  assert.equal((await owner.request('/api/workspace/blobs/'+await sha256(huge),'PUT',huge)).status,413);
});
