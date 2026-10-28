import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cloudMetadataForSync } from '../src/db';
import { fetchCloudArchiveFiles, fetchCloudCatalogue, resolveFileBlob, validCloudPath, validateCloudCatalogue } from '../src/cloud';
import type { CloudCatalogue, RemoteArchiveFile } from '../src/types';

const digest = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const manifestHash = digest('manifest');
function catalogue(root='cloud-frontend-root'): CloudCatalogue {
  return {
    schema: 1, generation: digest('generation'),
    archives: [{ id:root, rootId:root, parentId:null, mountPath:'', name:'Banners.zip', createdAt:1,
      fileCount:2, pageCount:1, imageCount:1, byteSize:24, warnings:[] }],
    pages: [{id:`${root}/index.html`, archiveId:root, rootId:root, path:'index.html', label:'Banners', isIndex:true, size:12, kind:'html'},
      {id:`${root}/assets/image.png`, archiveId:root, rootId:root, path:'assets/image.png', label:'image.png', isIndex:false, size:12, kind:'image'}],
    manifests:{[root]:manifestHash}, stats:{packages:1,html:1,images:1},
  };
}
function json(value: unknown) { return new Response(JSON.stringify(value), {headers:{'content-type':'application/json'}}); }
function remote(archiveId:string, path:string, bytes:Uint8Array):RemoteArchiveFile {
  return {id:`${archiveId}/${path}`,archiveId,path,mime:'image/png',remote:{archiveId,path,size:bytes.byteLength,sha256:digest(bytes)}};
}

test('cloud metadata selection is idempotent, byte-free and retains hidden roots',()=>{
  const value=catalogue();
  const first=cloudMetadataForSync(value,[]),second=cloudMetadataForSync(value,[]);
  assert.deepEqual(first,second);
  assert.equal(first.archives[0].cloud?.manifest,manifestHash);
  assert.equal(JSON.stringify(first).includes('blob'),false);
  assert.deepEqual(cloudMetadataForSync(value,[value.archives[0].id]),{archives:[],pages:[]});
  assert.equal(value.archives[0].cloud,undefined,'the remote catalogue is not mutated');
});

test('cloud catalogue rejects duplicate paths, missing archives and cyclic parents before any sync',()=>{
  const value=catalogue();
  assert.equal(validateCloudCatalogue(value),value);
  assert.throws(()=>validateCloudCatalogue({...value,pages:[...value.pages,value.pages[0]]}),/invalid file/i);
  assert.throws(()=>validateCloudCatalogue({...value,pages:[{...value.pages[0],archiveId:'cloud-missing'}]}),/invalid file/i);
  assert.throws(()=>validateCloudCatalogue({...value,archives:[{...value.archives[0],parentId:value.archives[0].id}]}),/hierarchy|cyclic/i);
  assert.throws(()=>validateCloudCatalogue({...value,manifests:{}}),/invalid archive/i);
  for(const path of ['../secret','a/../secret','/absolute','a\\b','a//b','C:/root','a\0b'])assert.equal(validCloudPath(path),false,path);
  assert.equal(validCloudPath('assets/café image.png'),true);
});

test('cloud catalogue request is same-origin metadata and distinguishes sign-in HTML',async()=>{
  const calls:{path:string;init?:RequestInit}[]=[];
  const value=await fetchCloudCatalogue((async(path,init)=>{calls.push({path:String(path),init});return json(catalogue());}) as typeof fetch);
  assert.equal(value.pages.length,2);
  assert.deepEqual(calls.map(call=>call.path),['/api/collection']);
  assert.equal(calls[0].init?.credentials,'same-origin');
  await assert.rejects(fetchCloudCatalogue((async()=>new Response('<html>sign in</html>',{headers:{'content-type':'text/html'}})) as typeof fetch),/sign.in page/i);
});

test('owning-archive metadata does not fetch unrelated binary assets; one image fetches only its bytes',async()=>{
  const archiveId='cloud-frontend-lazy';
  const wanted=new Uint8Array([0x89,0x50,0x4e,0x47,1,2,3]);
  const other=new Uint8Array([9,8,7]);
  const descriptors=[remote(archiveId,'wanted.png',wanted),remote(archiveId,'other.png',other)].map(file=>({
    id:file.id,archiveId,path:file.path,mime:file.mime,size:file.remote.size,sha256:file.remote.sha256,slices:[],
  }));
  const requests:string[]=[];
  const fetcher=(async(path)=>{
    const url=String(path);requests.push(url);
    if(url.startsWith('/api/collection/archive'))return json({archiveId,files:descriptors});
    assert.ok(url.includes('wanted.png'),'unrelated image must not be downloaded');
    return new Response(wanted,{headers:{'content-type':'image/png','content-length':String(wanted.byteLength)}});
  }) as typeof fetch;
  const files=await fetchCloudArchiveFiles(archiveId,manifestHash,fetcher);
  assert.equal(requests.length,1);
  assert.equal(files.get('wanted.png')?.blob,undefined,'remote resource has no placeholder Blob');
  assert.deepEqual(new Uint8Array(await (await resolveFileBlob(files.get('wanted.png')!,fetcher)).arrayBuffer()),wanted);
  assert.equal(requests.length,2);
  assert.equal(requests.filter(path=>path.includes('/file?')).length,1);
});

test('remote bytes are checked, failed resources can retry, and completed bytes are not retained globally',async()=>{
  const bytes=new Uint8Array([1,2,3,4]);
  const file=remote('cloud-frontend-retry','retry.png',bytes);
  let calls=0;
  const fetcher=(async()=>{calls++;return calls===1?new Response(new Uint8Array([4,3,2,1])):new Response(bytes);}) as typeof fetch;
  await assert.rejects(resolveFileBlob(file,fetcher),/integrity check/i);
  assert.deepEqual(new Uint8Array(await(await resolveFileBlob(file,fetcher)).arrayBuffer()),bytes);
  await resolveFileBlob(file,fetcher);
  assert.equal(calls,3,'completed resource bytes must not accumulate in a permanent cache');
  await assert.rejects(resolveFileBlob(file,(async()=>new Response(bytes,{headers:{'content-length':'99'}})) as typeof fetch),/size does not match/i);
});

test('local resources never use the cloud endpoint and concurrent cloud consumers share one in-flight request',async()=>{
  let calls=0;
  const blob=new Blob(['local bytes']);
  const fail=(async()=>{throw new Error('unexpected network request');}) as typeof fetch;
  assert.equal(await resolveFileBlob({id:'local/a',archiveId:'local',path:'a',mime:'text/plain',blob},fail),blob);
  const bytes=new Uint8Array([5,6,7]);const file=remote('cloud-frontend-concurrent','a.png',bytes);
  let release:()=>void=()=>{};const wait=new Promise<void>(resolve=>{release=resolve;});
  const fetcher=(async()=>{calls++;await wait;return new Response(bytes);}) as typeof fetch;
  const one=resolveFileBlob(file,fetcher),two=resolveFileBlob(file,fetcher);release();
  assert.equal(await one,await two);assert.equal(calls,1);
});

test('optional created and added file metadata accepts finite dates and rejects malformed values',()=>{
  for(const key of ['createdAt','addedAt'] as const){
    const valid=catalogue();valid.pages[0][key]=Date.UTC(2026,9,27);assert.equal(validateCloudCatalogue(valid).pages[0][key],valid.pages[0][key]);
    for(const invalid of [0,-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER,'2026-10-27']){
      const bad=catalogue();(bad.pages[0] as any)[key]=invalid;assert.throws(()=>validateCloudCatalogue(bad),/file date/);
    }
  }
});
