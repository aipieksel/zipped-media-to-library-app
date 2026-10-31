import assert from 'node:assert/strict';
import test from 'node:test';
import {handlePrivateApi} from '../worker/dispatch.mjs';
import {environment,setupOwner,TestBucket} from './folio-auth-helpers.mjs';
import {sha256} from '../worker/auth-common.mjs';

class LegacyBucket extends TestBucket {
  reads=0;heads=0;
  async head(key:string){this.heads++;return super.head(key);}
  async get(key:string,options:any={}) {
    this.reads++;const value=this.values.get(key);if(!value)return null;
    const bytes=options.range?value.bytes.slice(options.range.offset,options.range.offset+options.range.length):value.bytes;
    return {size:value.bytes.byteLength,customMetadata:value.metadata,text:async()=>new TextDecoder().decode(bytes),body:new Blob([bytes]).stream()};
  }
}

async function collection(bucket:LegacyBucket) {
  const root='cloud-dispatch-fixture',html=new TextEncoder().encode('<h1>Private synthetic fixture</h1>'),png=new Uint8Array([137,80,78,71,1,2,3,4]),webp=new Uint8Array([82,73,70,70,87,69,66,80,5,6,7]);
  const htmlHash=await sha256(html),pngHash=await sha256(png),imageHash=await sha256(webp);
  for(const [hash,bytes] of [[htmlHash,html],[pngHash,png],[imageHash,webp]] as const)await bucket.put('folio/objects/'+hash,bytes,{customMetadata:{sha256:hash}});
  const files=[{id:root+'/index.html',archiveId:root,path:'index.html',mime:'text/html',size:html.length,sha256:htmlHash,slices:[{hash:htmlHash,offset:0,length:html.length}]},{id:root+'/image.png',archiveId:root,path:'image.png',mime:'image/png',size:png.length,sha256:pngHash,slices:[{hash:pngHash,offset:0,length:png.length}]}];
  const group=new TextEncoder().encode(JSON.stringify({schema:1,archives:{[root]:{archiveId:root,files}}})),manifest=await sha256(group);
  await bucket.put('folio/objects/'+manifest,group,{customMetadata:{sha256:manifest}});
  const index={schema:1,generation:'d'.repeat(64),archives:[{id:root,rootId:root,parentId:null,name:'Synthetic private library',mountPath:'',createdAt:1,fileCount:2,pageCount:1,imageCount:1,byteSize:html.length+png.length,warnings:[]}],pages:files.map(file=>({id:file.id,archiveId:root,rootId:root,path:file.path,label:file.path,size:file.size,kind:file.mime==='text/html'?'html':'image',isIndex:file.mime==='text/html'})),manifests:{[root]:manifest},objects:{[htmlHash]:html.length,[pngHash]:png.length,[imageHash]:webp.length,[manifest]:group.length},packages:[{filename:'synthetic.zip'}],stats:{packages:1,html:1,images:1,resources:2},images:{[pngHash]:{original:{archiveId:root,path:'image.png',mime:'image/png',size:png.length},thumbnail:imageHash,thumbnailBytes:webp.length}},imageAssets:{[imageHash]:{sha256:imageHash,mime:'image/webp',size:webp.length,slices:[{hash:imageHash,offset:0,length:webp.length}]}}};
  await bucket.put('folio/collection.json',new TextEncoder().encode(JSON.stringify(index)));
  bucket.reads=0;bucket.heads=0;
  return {root,html,png,webp,htmlHash,pngHash,imageHash};
}

test('dispatch gates every legacy metadata/media read before touching R2, including cached and conditional paths',async t=>{
  const env=await environment();t.after(()=>env.DB.close());const bucket=new LegacyBucket();env.BUCKET=bucket;
  const fixture=await collection(bucket),{owner,response}=await setupOwner(env);assert.equal(response.status,201);
  const route=(path:string,method='GET',cookie='',headers:Record<string,string>={})=>handlePrivateApi(new Request('https://folio.test'+path,{method,headers:{...(cookie?{cookie}:{}),...headers}}),env);
  const metadata=['/api/collection','/api/collection/archive?id='+fixture.root];
  const resources=[{path:'/api/collection/file?archive='+fixture.root+'&path=index.html',bytes:fixture.html,hash:fixture.htmlHash,etag:false},{path:'/api/collection/file?archive='+fixture.root+'&path=image.png&v='+fixture.pngHash,bytes:fixture.png,hash:fixture.pngHash,etag:true},{path:'/api/collection/image?hash='+fixture.imageHash,bytes:fixture.webp,hash:fixture.imageHash,etag:true}];
  for(const path of [...metadata,...resources.map(x=>x.path)])for(const method of ['GET','HEAD']) {
    const denied=await route(path,method,'',{'if-none-match':'*','oai-authenticated-user-id':env.FOLIO_OWNER_SITE_USER_ID});
    assert.equal(denied!.status,401,path);assert.equal(denied!.headers.get('cache-control'),'private, no-store');
  }
  assert.equal(bucket.reads,0);assert.equal(bucket.heads,0,'outer Site identity alone must not read private storage');
  const profile=await route('/api/account','GET',owner.cookie);const state=await profile!.json();assert.equal(state.authenticated,true);assert.equal(state.account.role,'owner');assert.notEqual(state.account.id,env.FOLIO_OWNER_SITE_USER_ID);
  for(const path of metadata) {
    const response=await route(path,'GET',owner.cookie);assert.equal(response!.status,200);assert.equal(response!.headers.get('cache-control'),'private, no-store');
  }
  for(const resource of resources) {
    const get=await route(resource.path,'GET',owner.cookie);assert.equal(get!.status,200);assert.equal(get!.headers.get('cache-control'),'private, no-store');assert.deepEqual(new Uint8Array(await get!.arrayBuffer()),resource.bytes);
    const head=await route(resource.path,'HEAD',owner.cookie);assert.equal(head!.status,200);assert.equal(head!.headers.get('cache-control'),'private, no-store');assert.equal(await head!.text(),'');
    const conditional=await route(resource.path,'GET',owner.cookie,{'if-none-match':'"'+resource.hash+'"'});
    assert.equal(conditional!.status,resource.etag?304:200);assert.equal(conditional!.headers.get('cache-control'),'private, no-store');await conditional!.arrayBuffer();
  }
  const cookie=owner.cookie;assert.equal((await owner.request('/api/folio-auth/logout','POST',{})).status,200);
  const reads=bucket.reads,heads=bucket.heads;
  for(const path of [...metadata,...resources.map(x=>x.path)])for(const method of ['GET','HEAD']) {
    const denied=await route(path,method,cookie,{'if-none-match':'*'});assert.equal(denied!.status,401);assert.equal(denied!.headers.get('cache-control'),'private, no-store');
    assert(!((await denied!.text()).includes('Private synthetic fixture')));
  }
  assert.equal(bucket.reads,reads,'revoked cookies cannot read previously cached metadata or media');assert.equal(bucket.heads,heads);
});

test('a member session cannot replace the separate ingestion credential',async t=>{
  const env=await environment();t.after(()=>env.DB.close());const bucket=new LegacyBucket();env.BUCKET=bucket;env.FOLIO_INGEST_TOKEN='synthetic-ingest-only-token';
  const fixture=await collection(bucket),{owner}=await setupOwner(env),url='https://folio.test/api/collection/admin/object/'+fixture.htmlHash;
  const ordinary=await handlePrivateApi(new Request(url,{method:'HEAD',headers:{cookie:owner.cookie}}),env);assert.equal(ordinary!.status,403);assert.equal(bucket.heads,0);
  const ingestion=await handlePrivateApi(new Request(url,{method:'HEAD',headers:{'x-folio-ingest-token':env.FOLIO_INGEST_TOKEN}}),env);assert.equal(ingestion!.status,200);assert.equal(ingestion!.headers.get('cache-control'),'private, no-store');
  const crossOrigin=await handlePrivateApi(new Request(url,{method:'HEAD',headers:{'x-folio-ingest-token':env.FOLIO_INGEST_TOKEN,origin:'https://evil.test'}}),env);assert.equal(crossOrigin!.status,403);
});
