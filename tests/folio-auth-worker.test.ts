import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {createHash} from 'node:crypto';

test('Better Auth credentials, D1, native scrypt and secure cookies execute in workerd',async t=>{
  const compiled=await build({stdin:{contents:'import {handlePrivateApi} from "./worker/dispatch.mjs"; export default {async fetch(request,env){return await handlePrivateApi(request,env)||new Response("Missing",{status:404});}};',resolveDir:process.cwd(),sourcefile:'folio-auth-worker-spike.mjs'},bundle:true,platform:'browser',conditions:['workerd'],format:'esm',target:'es2022',external:['node:*'],metafile:true,write:false});
  assert.ok(Object.keys(compiled.metafile!.inputs).some(path=>path.endsWith('@better-auth/core/dist/async_hooks/index.mjs')));
  assert.ok(!Object.keys(compiled.metafile!.inputs).some(path=>path.endsWith('@better-auth/core/dist/async_hooks/pure.index.mjs')));
  // Better Auth contains unused optional adapters with dynamic imports. Explicit
  // modules exercise the bundle in workerd without Miniflare's static scanner
  // trying to resolve those non-D1 branches as project files.
  const mf=new Miniflare({modules:[{type:'ESModule',path:'folio-auth-spike.mjs',contents:compiled.outputFiles![0].text}],compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{FOLIO_AUTH_SECRET:'synthetic-workerd-secret-with-more-than-32-characters-test-only',FOLIO_OWNER_SITE_USER_ID:'synthetic-workerd-owner',FOLIO_APP_ORIGIN:'https://folio.test'}});
  t.after(()=>mf.dispose());
  const DB=await mf.getD1Database('DB'),directory=new URL('../drizzle/',import.meta.url);
  for(const file of (await readdir(directory)).filter(f=>f.endsWith('.sql')).sort()) {
    const sql=await readFile(new URL(file,directory),'utf8');
    for(const statement of sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean)) await DB.prepare(statement).run();
  }
  const caller=(site:string)=>{
    let cookie='';
    return async(path:string,method='GET',body?:unknown)=>{
      const headers=new Headers({'origin':'https://folio.test','oai-authenticated-user-id':site,'cf-connecting-ip':site});
      if(cookie)headers.set('cookie',cookie);if(body!==undefined)headers.set('content-type',body instanceof Uint8Array?'application/octet-stream':'application/json');
      const response=await mf.dispatchFetch('https://folio.test'+path,{method,headers,...(body===undefined?{}:{body:body instanceof Uint8Array?body:JSON.stringify(body)})});
      const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
      return response;
    };
  };
  const owner=caller('synthetic-workerd-owner'),member=caller('synthetic-workerd-member'),base='/api/folio-auth';
  const initial=await owner(base+'/session');assert.equal(initial.status,200);assert.equal((await initial.json() as any).canBootstrap,true);
  const registered=await owner(base+'/bootstrap','POST',{name:'Workerd owner',email:'worker-owner@example.test',password:'Synthetic Workerd password 999!'});
  assert.equal(registered.status,201,await registered.clone().text());
  assert.match(registered.headers.get('set-cookie')!,/HttpOnly/);assert.match(registered.headers.get('set-cookie')!,/Secure/);assert.match(registered.headers.get('set-cookie')!,/SameSite=Lax/);
  assert.equal((await (await owner(base+'/session')).json() as any).account.role,'owner');
  assert.equal((await (await owner('/api/account')).json() as any).account.role,'owner');
  const invite=await (await owner(base+'/invitations','POST',{email:'worker-member@example.test'})).json() as any;
  const joined=await member(base+'/register','POST',{email:invite.email,token:invite.token,name:'Workerd member',password:'Synthetic Workerd member 888!'});
  assert.equal(joined.status,201,await joined.clone().text());
  // App startup loads all three documents concurrently; real account contexts
  // must remain isolated both across those reads and across distinct users.
  for(let round=0;round<3;round++) {
    await Promise.all([
      ...['library','icons','appearance'].map(async name=>{
        const response=await owner('/api/workspace/documents/'+name);
        assert.equal(response.status,200,await response.clone().text());
        assert.deepEqual(await response.json(),{name,revision:0,data:null,blobs:[],updatedAt:null});
      }),
      ...[[owner,'worker-owner@example.test','owner'],[member,'worker-member@example.test','member']].map(async([call,email,role])=>{
        const response=await (call as typeof owner)(base+'/session');
        assert.equal(response.status,200,await response.clone().text());
        const body=await response.json() as any;
        assert.equal(body.account.email,email);assert.equal(body.account.role,role);
      }),
    ]);
  }
  const bytes=new Uint8Array([1,3,5,7,9]),hash=createHash('sha256').update(bytes).digest('hex');
  const uploaded=await owner('/api/workspace/blobs/'+hash,'PUT',bytes);assert.equal(uploaded.status,200,await uploaded.clone().text());
  assert.equal((await member('/api/workspace/blobs/'+hash)).status,404);
  const save=await owner('/api/workspace/documents/library','PUT',{expectedRevision:0,data:{version:1,files:[{id:'same-workspace-record',chunks:[hash]}]},blobs:[hash]});
  assert.equal(save.status,200,await save.clone().text());
  assert.equal((await (await member('/api/workspace/documents/library')).json() as any).data.files[0].id,'same-workspace-record');
  const downloaded=await member('/api/workspace/blobs/'+hash);assert.equal(downloaded.status,200);assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()),bytes);assert.equal(downloaded.headers.get('cache-control'),'private, no-store');
  assert.equal((await member(base+'/logout','POST',{})).status,200);
  assert.equal((await member('/api/workspace/documents/library')).status,401);
  assert.equal((await member('/api/collection')).status,401);
});
