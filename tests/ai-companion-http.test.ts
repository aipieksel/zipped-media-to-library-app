import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { randomUUID } from 'node:crypto';
import { startCompanion } from '../companion/server';
import type { AiDriver } from '../companion/codex';
import type { AiCompanionStatus, AiSvgRequest } from '../src/ai/contracts';

const origin='https://folio.example.test',token='x'.repeat(43);
const status:AiCompanionStatus={protocolVersion:1,companionVersion:'test',activeRequestId:null,providers:[],checkedAt:new Date().toISOString()};
const source:AiSvgRequest={requestId:randomUUID(),provider:'codex',model:'fixture',reasoning:'high',operation:'recreate-svg',instructions:'',image:{name:'icon.png',mimeType:'image/png',dataBase64:'dGVzdA==',width:1,height:1}};
function send(port:number,method:string,path:string,body?:unknown,headers:Record<string,string>={}) {
  return new Promise<{status:number;headers:Record<string,unknown>;body:any}>((resolve,reject)=>{
    const text=body===undefined?undefined:JSON.stringify(body);
    const req=httpRequest({hostname:'127.0.0.1',port,path,method,headers:{Origin:origin,Authorization:`Bearer ${token}`,...(text?{'Content-Type':'application/json','Content-Length':String(Buffer.byteLength(text))}:{}),...headers}},res=>{
      let data='';res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve({status:res.statusCode!,headers:res.headers,body:data?JSON.parse(data):null}));
    });req.on('error',reject);req.end(text);
  });
}
function fixtureDriver(onGenerate?:()=>void):AiDriver {
  return {
    async status(){return status;},
    async generate(request){onGenerate?.();return{requestId:request.requestId,svg:'<svg/>',summary:'fixture',provider:'codex',model:request.model,createdAt:new Date().toISOString()};},
    async test(request){return{requestId:request.requestId,ok:true,provider:'codex',model:request.model,message:'Text fixture',checkedAt:new Date().toISOString()};},
  };
}

test('Origin, Host, pairing token and preflight checks deny requests before driver effects',async()=>{
  let calls=0;const driver=fixtureDriver(()=>calls++);driver.status=async()=>{calls++;return status;};
  const companion=await startCompanion({origin,token,port:0,driver});
  try {
    assert.equal((await send(companion.port,'GET','/v1/status',undefined,{Authorization:''})).status,401);
    assert.equal((await send(companion.port,'GET','/v1/status',undefined,{Origin:'https://evil.example'})).status,403);
    assert.equal((await send(companion.port,'GET','/v1/status',undefined,{Origin:''})).status,403);
    assert.equal((await send(companion.port,'GET','/v1/status',undefined,{Host:'evil.example'})).status,403);
    assert.equal((await send(companion.port,'OPTIONS','/v1/svg',undefined,{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Authorization,X-Override'})).status,403);
    assert.equal(calls,0);
    const preflight=await send(companion.port,'OPTIONS','/v1/svg',undefined,{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Authorization,Content-Type'});
    assert.equal(preflight.status,204);assert.equal(preflight.headers['access-control-allow-origin'],origin);assert.equal(preflight.headers['access-control-allow-credentials'],undefined);
    const good=await send(companion.port,'GET','/v1/status');assert.equal(good.status,200);assert.equal(calls,1);assert.equal(good.headers['cache-control'],'no-store');
  }finally{await companion.close();}
});

test('HTTP schemas prohibit arbitrary cwd/args and rejected requests have no model side effects',async()=>{
  let calls=0;const companion=await startCompanion({origin,token,port:0,driver:fixtureDriver(()=>calls++)});
  try {
    for(const extra of [{cwd:'/etc'},{args:['--yolo']},{executable:'/bin/sh'},{image:{...source.image,path:'/etc/passwd'}}]){
      assert.equal((await send(companion.port,'POST','/v1/svg',{...source,...extra})).status,400);
    }
    assert.equal((await send(companion.port,'POST','/v1/svg',{...source,operation:'clean-svg'})).status,400);
    assert.equal(calls,0);
    const response=await send(companion.port,'POST','/v1/svg',source);assert.equal(response.status,200);assert.equal(response.body.requestId,source.requestId);assert.equal(calls,1);
  }finally{await companion.close();}
});

test('one request at a time; cancellation waits for cleanup then permits another request',async()=>{
  let started!:()=>void,cleaned=false;
  const began=new Promise<void>(resolve=>started=resolve);
  const driver=fixtureDriver();
  driver.generate=async(_request,signal)=>{started();await new Promise<void>((resolve)=>signal.addEventListener('abort',()=>setTimeout(resolve,30),{once:true}));cleaned=true;throw Object.assign(new Error('private details'),{code:'cancelled'});};
  const companion=await startCompanion({origin,token,port:0,driver});
  try {
    const running=send(companion.port,'POST','/v1/svg',source);await began;
    assert.equal((await send(companion.port,'POST','/v1/test',{requestId:randomUUID(),provider:'codex',model:'fixture',reasoning:'high'})).status,409);
    const cancelled=await send(companion.port,'DELETE',`/v1/jobs/${source.requestId}`);assert.equal(cancelled.status,204);assert.equal(cleaned,true);
    const result=await running;assert.equal(result.status,409);assert.equal(result.body.error.code,'CANCELLED');assert.ok(!JSON.stringify(result.body).includes('private details'));
    assert.equal((await send(companion.port,'POST','/v1/test',{requestId:randomUUID(),provider:'codex',model:'fixture',reasoning:'high'})).status,200);
  }finally{await companion.close();}
});

test('driver errors never expose raw stderr, configuration or tokens',async()=>{
  const driver=fixtureDriver();driver.generate=async()=>{throw new Error('OPENAI_API_KEY=supersecret /Users/private/auth.json');};
  const companion=await startCompanion({origin,token,port:0,driver});
  try{const result=await send(companion.port,'POST','/v1/svg',source);assert.equal(result.status,502);assert.equal(result.body.error.code,'AI_FAILED');assert.ok(!JSON.stringify(result.body).includes('supersecret'));assert.ok(!JSON.stringify(result.body).includes('/Users'));}
  finally{await companion.close();}
});

test('a total request deadline cancels provider work and returns a truthful timeout',async()=>{
  const driver=fixtureDriver();let cancelled=false;
  driver.generate=async(_request,signal)=>{await new Promise<void>(resolve=>signal.addEventListener('abort',()=>{cancelled=true;resolve();},{once:true}));throw Object.assign(new Error('stopped'),{code:'cancelled'});};
  const companion=await startCompanion({origin,token,port:0,driver,timeoutMs:40});
  try{const result=await send(companion.port,'POST','/v1/svg',source);assert.equal(result.status,504);assert.equal(result.body.error.code,'TIMEOUT');assert.equal(cancelled,true);}
  finally{await companion.close();}
});
