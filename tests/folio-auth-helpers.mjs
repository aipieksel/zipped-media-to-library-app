import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import {handleFolioAuth} from '../worker/auth.mjs';
import {handleWorkspace} from '../worker/workspace.mjs';

/** Real SQLite, with the same prepared/batch contract used by the D1 adapter. */
export class TestD1 {
  constructor() { this.sqlite=new DatabaseSync(':memory:'); this.sqlite.exec('PRAGMA foreign_keys=ON'); }
  prepare(sql) {
    const db=this.sqlite;
    function make(params=[]) {
      const execute=()=>{
        const statement=db.prepare(sql);
        const returnsRows=statement.columns().length>0;
        const results=returnsRows?statement.all(...params):[];
        const result=returnsRows?null:statement.run(...params);
        const meta=result||db.prepare('SELECT changes() AS changes,last_insert_rowid() AS lastInsertRowid').get();
        return {success:true,results,meta:{changes:Number(meta.changes),last_row_id:Number(meta.lastInsertRowid)}};
      };
      return {_execute:execute,bind:(...values)=>make(values),all:async()=>execute(),run:async()=>execute(),first:async column=>{const value=execute().results[0]??null;return column&&value?value[column]:value;},raw:async()=>execute().results.map(Object.values)};
    }
    return make();
  }
  async batch(statements) {
    this.sqlite.exec('BEGIN');
    try { const values=statements.map(statement=>statement._execute()); this.sqlite.exec('COMMIT');return values; }
    catch(error){this.sqlite.exec('ROLLBACK');throw error;}
  }
  async exec(sql){this.sqlite.exec(sql);return {count:1,duration:0};}
  close(){this.sqlite.close();}
}

export class TestBucket {
  values=new Map();
  async head(key){const value=this.values.get(key);return value?{size:value.bytes.byteLength,customMetadata:value.metadata,etag:key}:null;}
  async put(key,value,options={}) {
    if(options.onlyIf?.etagDoesNotMatch==='*'&&this.values.has(key)) return null;
    const bytes=new Uint8Array(value instanceof ArrayBuffer?value:value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength));
    this.values.set(key,{bytes,metadata:options.customMetadata});return this.head(key);
  }
  async get(key){const value=this.values.get(key);return value?{...await this.head(key),body:new Blob([value.bytes]).stream()}:null;}
}

export async function environment() {
  const DB=new TestD1();
  const directory=new URL('../drizzle/',import.meta.url);
  for(const file of (await readdir(directory)).filter(f=>f.endsWith('.sql')).sort()) await DB.exec(await readFile(new URL(file,directory),'utf8'));
  return {DB,BUCKET:new TestBucket(),FOLIO_AUTH_SECRET:'synthetic-test-secret-64-characters-not-a-production-secret-ever',FOLIO_OWNER_SITE_USER_ID:'synthetic-owner-site-id',FOLIO_APP_ORIGIN:'https://folio.test'};
}

export function client(env,siteId='synthetic-site-user') {
  let cookie='';
  return {
    get cookie(){return cookie;},set cookie(value){cookie=value;},
    async request(path,method='GET',body,extra={}) {
      const headers=new Headers({'oai-authenticated-user-id':siteId,'cf-connecting-ip':siteId,'origin':'https://folio.test',...extra});
      if(cookie) headers.set('cookie',cookie);
      let data;
      if(body!==undefined) {if(body instanceof Uint8Array){headers.set('content-type','application/octet-stream');data=body;}else{headers.set('content-type','application/json');data=JSON.stringify(body);}}
      const request=new Request('https://folio.test'+path,{method,headers,...(data===undefined?{}:{body:data})});
      const response=await handleFolioAuth(request,env)||await handleWorkspace(request,env);
      const cookies=response.headers.getSetCookie();
      if(cookies.length){const current=new Map(cookie.split('; ').filter(Boolean).map(pair=>[pair.slice(0,pair.indexOf('=')),pair]));for(const item of cookies){const pair=item.split(';')[0],key=pair.slice(0,pair.indexOf('='));if(/max-age=0/i.test(item)||pair.endsWith('='))current.delete(key);else current.set(key,pair);}cookie=[...current.values()].join('; ');}
      return response;
    },
  };
}

export const OWNER_PASSWORD='Synthetic owner password 47!';
export const MEMBER_PASSWORD='Synthetic member password 83!';
export async function setupOwner(env){const owner=client(env,env.FOLIO_OWNER_SITE_USER_ID);const response=await owner.request('/api/folio-auth/bootstrap','POST',{email:'owner@example.test',name:'Owner fixture',password:OWNER_PASSWORD});return {owner,response};}
export async function setupMember(env,owner,email='member@example.test') {
  const invitation=await owner.request('/api/folio-auth/invitations','POST',{email});
  const invite=await invitation.json();
  const member=client(env,'synthetic-'+email);
  const response=await member.request('/api/folio-auth/register','POST',{email,name:'Member fixture',password:MEMBER_PASSWORD,token:invite.token});
  return {member,response,invite};
}
