/**
 * DEVELOPMENT-ONLY, explicit /__qa__ fixture backend for browser verification.
 * Vite apply:'serve' excludes this plugin from published builds. Nothing here
 * reads production bindings, user media, credentials or the hosted collection.
 */
import type {Plugin,ViteDevServer} from 'vite';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {mkdir,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';

export const QA_WORKSPACE_ACCOUNT=Object.freeze({
  email:'owner@folio-qa.test',
  name:'Folio QA Owner',
  password:'Synthetic Folio QA password 47!',
});
// Managed preview is HTTP (terminal.local), so this fixture deliberately uses
// HTTP cookies. Production HTTPS/Secure behavior is proved in the worker suite.
const QA_ORIGIN='http://folio-qa.test';
const QA_SITE_OWNER='synthetic-development-site-owner';
const QA_AUTH_SECRET='synthetic-development-secret-for-ephemeral-folio-fixture-only-64';
const MAX_BODY=8*1024*1024;

export interface QaWorkspaceFixture {
  dispatch(path:string,method:string,headers:Headers,body?:Uint8Array):Promise<Response>;
  login():Promise<Response>;
  close():Promise<void>;
}

/** Exposed for bounded fixture tests; does not launch a standalone web server. */
export async function createQaWorkspaceFixture(projectRoot:string):Promise<QaWorkspaceFixture> {
  const directory=resolve(projectRoot,'.qa');
  await mkdir(directory,{recursive:true});
  const output=resolve(directory,'folio-qa-worker.mjs');
  await build({
    stdin:{contents:`
      import {handlePrivateApi} from './worker/dispatch.mjs';
      export default {async fetch(request,env){
        const headers=new Headers(request.headers);
        headers.set('oai-authenticated-user-id',env.FOLIO_OWNER_SITE_USER_ID);
        const fixtureRequest=new Request(request,{headers});
        return await handlePrivateApi(fixtureRequest,env)||new Response('Missing fixture API',{status:404});
      }};`,resolveDir:projectRoot,sourcefile:'folio-development-qa-worker.mjs'},
    // Select Better Auth's native AsyncLocalStorage implementation. Its browser
    // fallback is a single global context and cannot isolate concurrent requests.
    bundle:true,platform:'browser',conditions:['workerd'],format:'esm',target:'es2022',external:['node:*'],outfile:output,
  });
  const mf=new Miniflare({
    modules:[{type:'ESModule',path:output,contents:await readFile(output,'utf8')}],
    compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],
    d1Databases:['DB'],r2Buckets:['BUCKET'],d1Persist:false,r2Persist:false,
    // Persistence is disabled: a Vite restart creates a fresh isolated fixture.
    bindings:{FOLIO_AUTH_SECRET:QA_AUTH_SECRET,FOLIO_OWNER_SITE_USER_ID:QA_SITE_OWNER,FOLIO_APP_ORIGIN:QA_ORIGIN},
  });
  try {
    const database=await mf.getD1Database('DB'),migrations=resolve(projectRoot,'drizzle');
    for(const file of (await readdir(migrations)).filter(name=>name.endsWith('.sql')).sort()) {
      const sql=await readFile(resolve(migrations,file),'utf8');
      for(const statement of sql.split('--> statement-breakpoint').map(value=>value.trim()).filter(Boolean))await database.prepare(statement).run();
    }
    // Narrow the only R2 operation used here; Miniflare's conditional worker-type
    // mapping is incompatible with this project's DOM/Node declaration mix.
    const bucket=await mf.getR2Bucket('BUCKET') as unknown as {put(key:string,value:string):Promise<unknown>};
    await bucket.put('folio/collection.json',JSON.stringify({schema:1,generation:'0'.repeat(64),archives:[],pages:[],manifests:{},images:{},stats:{packages:0,html:0,images:0,resources:0}}));
    const dispatch:QaWorkspaceFixture['dispatch']=async(path,method,headers,body)=>{
      if(!path.startsWith('/api/'))return new Response('Missing fixture API',{status:404});
      return await mf.dispatchFetch(QA_ORIGIN+path,{method,headers:Object.fromEntries(headers),...(body===undefined?{}:{body:Buffer.from(body)})}) as unknown as Response;
    };
    let initialization:Promise<void>|undefined;
    const ensureOwner=()=>initialization??=(async()=>{
      const status=await dispatch('/api/folio-auth/session','GET',new Headers());
      if(!status.ok)throw new Error('The isolated QA account service did not initialize.');
      const state=await status.json() as {setupRequired?:boolean};
      if(state.setupRequired) {
        const response=await dispatch('/api/folio-auth/bootstrap','POST',new Headers({'content-type':'application/json',origin:QA_ORIGIN}),new TextEncoder().encode(JSON.stringify(QA_WORKSPACE_ACCOUNT)));
        if(response.status!==201)throw new Error('The synthetic QA owner could not be initialized.');
        // Discard this bootstrap session; each caller receives a fresh login.
        await response.arrayBuffer();
      }
    })();
    return {
      dispatch,
      async login(){
        await ensureOwner();
        return dispatch('/api/folio-auth/login','POST',new Headers({'content-type':'application/json',origin:QA_ORIGIN}),new TextEncoder().encode(JSON.stringify({email:QA_WORKSPACE_ACCOUNT.email,password:QA_WORKSPACE_ACCOUNT.password})));
      },
      close:()=>mf.dispose(),
    };
  } catch(error){await mf.dispose().catch(()=>{});throw error;}
}

function first(value:string|string[]|undefined):string|undefined{return Array.isArray(value)?value[0]:value;}

function fixtureHeaders(request:IncomingMessage):Headers {
  const headers=new Headers();
  for(const name of ['content-type','if-none-match','sec-fetch-site']) {
    const value=first(request.headers[name]);if(value)headers.set(name,value);
  }
  // Never forward preview/platform/provider cookies into this test Worker.
  const cookies=(first(request.headers.cookie)||'').split(';').map(value=>value.trim()).filter(value=>/^(?:__Secure-)?folio\.[^=]+=/.test(value));
  if(cookies.length)headers.set('cookie',cookies.join('; '));
  const origin=first(request.headers.origin);
  if(origin) {
    const host=(first(request.headers['x-forwarded-host'])||first(request.headers.host)||'').split(',')[0].trim();
    let sameOrigin=request.headers['sec-fetch-site']==='same-origin';
    try {sameOrigin=sameOrigin||new URL(origin).host===host;}catch{/* Keep malformed/foreign Origin for the real handler to reject. */}
    headers.set('origin',sameOrigin?QA_ORIGIN:origin);
  }
  return headers;
}

async function readBody(request:IncomingMessage):Promise<Uint8Array|undefined> {
  if(request.method==='GET'||request.method==='HEAD')return undefined;
  if(Number(first(request.headers['content-length'])||0)>MAX_BODY)throw Object.assign(new Error('QA request exceeds 8 MiB.'),{status:413});
  const parts:Uint8Array[]=[];let total=0;
  for await(const chunk of request) {
    const bytes=typeof chunk==='string'?new TextEncoder().encode(chunk):new Uint8Array(chunk);
    total+=bytes.byteLength;if(total>MAX_BODY)throw Object.assign(new Error('QA request exceeds 8 MiB.'),{status:413});parts.push(bytes);
  }
  const output=new Uint8Array(total);let offset=0;
  for(const part of parts){output.set(part,offset);offset+=part.byteLength;}
  return output;
}

async function send(response:Response,target:ServerResponse,head=false) {
  target.statusCode=response.status;
  response.headers.forEach((value,name)=>{if(!['set-cookie','transfer-encoding','connection'].includes(name))target.setHeader(name,value);});
  const cookies=response.headers.getSetCookie();if(cookies.length)target.setHeader('set-cookie',cookies);
  target.setHeader('cache-control','private, no-store');target.setHeader('x-folio-qa-fixture','ephemeral');
  target.end(head?undefined:Buffer.from(await response.arrayBuffer()));
}

export function qaWorkspacePlugin():Plugin {
  let startup:Promise<QaWorkspaceFixture>|undefined;
  return {
    name:'folio-isolated-qa-workspace',apply:'serve',
    configureServer(server:ViteDevServer){
      const fixture=()=>startup??=createQaWorkspaceFixture(server.config.root);
      server.httpServer?.once('close',()=>{void startup?.then(value=>value.close()).catch(()=>{});});
      server.middlewares.use((request,response,next)=>{
        const url=new URL(request.url||'/', 'http://vite.local');
        if(url.pathname!=='/__qa__/session'&&!url.pathname.startsWith('/__qa__/api/')){next();return;}
        void(async()=>{
          if(url.pathname==='/__qa__/session') {
            if(request.method!=='POST'){await send(new Response('Use POST to create a synthetic QA session.',{status:405}),response);return;}
            if(request.headers['sec-fetch-site']==='cross-site'){await send(new Response('Use the same-origin QA harness.',{status:403}),response);return;}
            await readBody(request);
            await send(await(await fixture()).login(),response);return;
          }
          const headers=fixtureHeaders(request),body=await readBody(request);
          const result=await(await fixture()).dispatch(url.pathname.slice('/__qa__'.length)+url.search,request.method||'GET',headers,body);
          await send(result,response,request.method==='HEAD');
        })().catch(error=>{
          // Fail visibly instead of inventing a user/session or falling through
          // to production APIs when the managed runtime cannot start workerd.
          server.config.logger.error(`[folio QA] ${error instanceof Error?error.message:'Fixture backend unavailable'}`);
          if(!response.headersSent){response.statusCode=error?.status===413?413:503;response.setHeader('content-type','application/json');response.setHeader('cache-control','no-store');response.end(JSON.stringify({error:'The isolated QA backend is unavailable. Check the preview runtime log.',code:'qa_unavailable'}));}
          else response.destroy();
        });
      });
    },
  };
}
