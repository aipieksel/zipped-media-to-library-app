import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DecodedImageLRU, ImagePrefetchQueue, LocalImageURLCache, buildImageRows, decodedImages, imageIsPaintReady, imageSource, neighborPrefetchPlan, visibleImageRows, warmImage } from '../src/image-cache';
import { getImageMetadata, imageMetadataVersion, installImageMetadata, subscribeImageMetadata, validateCloudCatalogue } from '../src/cloud';
import type { HtmlPage, ImageRendition } from '../src/types';

const hash='a'.repeat(64),thumbnail='b'.repeat(64),preview='c'.repeat(64);
const image:HtmlPage={id:'cloud-a/art.png',archiveId:'cloud-a',rootId:'cloud-a',path:'art.png',label:'art.png',isIndex:false,kind:'image',size:8_000_000,imageHash:hash,mime:'image/png'};
const metadata:ImageRendition={width:3000,height:2000,placeholder:'data:image/webp;base64,UklGRg==',thumbnail,preview,thumbnailBytes:10000,previewBytes:100000,
  original:{archiveId:'cloud-canonical',path:'assets/art.png',mime:'image/png',size:image.size}};
const tick=()=>new Promise<void>(resolve=>queueMicrotask(resolve));

test('fit and gallery sources choose immutable renditions before any original download; 100% retains original canonical hash URL',()=>{
  const fit=imageSource(image,metadata,'preview')!,thumb=imageSource(image,metadata,'thumbnail')!,actual=imageSource(image,metadata,'original')!;
  assert.equal(fit.url,`/api/collection/image?hash=${preview}`);
  assert.equal(thumb.url,`/api/collection/image?hash=${thumbnail}`);
  assert.equal(fit.placeholder,metadata.placeholder);assert.equal(fit.width,3000);assert.equal(fit.original,false);
  assert.equal(actual.url,`/api/collection/file?archive=cloud-canonical&path=assets%2Fart.png&v=${hash}`);
  assert.equal(actual.original,true);assert.equal(actual.bytes,image.size);
  assert.equal(imageSource({...image,imageHash:undefined},undefined,'preview'),undefined,'local imports use the shared object URL cache');
});

test('SVG and missing-rendition fallback use safe native original image URL without rasterizing or changing source bytes',()=>{
  const svg={...metadata,thumbnail:undefined,preview:undefined,original:{...metadata.original,path:'world.svg',mime:'image/svg+xml'}};
  const source=imageSource({...image,mime:'image/svg+xml'},svg,'thumbnail')!;
  assert.ok(source.url.includes('world.svg'));assert.ok(source.url.endsWith(`v=${hash}`));assert.equal(source.original,true);
  assert.ok(imageSource(image,undefined,'preview')!.url.includes('art.png'));
});

test('decoded image LRU honors both count and pixel budgets while retaining recently used images',()=>{
  const cache=new DecodedImageLRU<string>(3,100);
  cache.set('a','A',5,5);cache.set('b','B',5,5);cache.set('c','C',5,5);
  assert.equal(cache.get('a'),'A');cache.set('d','D',5,5);
  assert.equal(cache.get('b'),undefined);assert.equal(cache.size,3);
  cache.set('large','L',9,10);assert.equal(cache.size,1);assert.equal(cache.pixelCount,90);
  cache.set('too-large','X',11,10);assert.equal(cache.get('too-large'),undefined);assert.ok(cache.pixelCount<=100);
});

test('shared local object URLs avoid repeat Blob reads and only revoke unreferenced evictions',async()=>{
  const revoked:string[]=[];let reads=0,urls=0;
  const cache=new LocalImageURLCache(1,100,()=>`blob:${++urls}`,url=>revoked.push(url));
  const load=async()=>{reads++;return new Blob(['original']);};
  const first=await cache.acquire('a',load),second=await cache.acquire('a',load);
  assert.equal(reads,1);assert.equal(first.url,second.url);first.release();
  const other=await cache.acquire('b',load);assert.deepEqual(revoked,[],'a remains referenced by second consumer');
  second.release();assert.deepEqual(revoked,['blob:1']);other.release();assert.equal(cache.size,1);
  const repeat=await cache.acquire('b',load);assert.equal(reads,2);assert.equal(repeat.url,other.url);repeat.release();
});

test('neighbor prefetch has two workers and queued current selection outranks speculative items',async()=>{
  const queue=new ImagePrefetchQueue(2),started:string[]=[];let running=0,maximum=0;
  const releases=new Map<string,()=>void>();
  const work=(key:string)=>async()=>{started.push(key);running++;maximum=Math.max(maximum,running);await new Promise<void>(resolve=>releases.set(key,resolve));running--;};
  const a=queue.enqueue('a',work('a')),b=queue.enqueue('b',work('b'));
  const speculative=queue.enqueue('neighbor',work('neighbor'));
  const current=queue.enqueue('current',work('current'),0);
  await tick();assert.deepEqual(started,['a','b']);assert.equal(queue.activeCount,2);
  releases.get('a')!();await a;await tick();assert.equal(started[2],'current');
  releases.get('b')!();await b;await tick();assert.equal(started[3],'neighbor');
  releases.get('current')!();releases.get('neighbor')!();await Promise.all([current,speculative]);assert.equal(maximum,2);
});

test('prefetch cancellation drops stale neighbors and supplies lifecycle abort without adding deadlines',async()=>{
  const queue=new ImagePrefetchQueue(1);let aborted=false,staleStarted=false;
  const active=queue.enqueue('old',signal=>new Promise<void>(resolve=>signal.addEventListener('abort',()=>{aborted=true;resolve();},{once:true})));
  const stale=queue.enqueue('stale',async()=>{staleStarted=true;});
  await tick();queue.cancelQueuedExcept(new Set());await Promise.all([active,stale]);
  assert.equal(aborted,true);assert.equal(staleStarted,false);assert.equal(queue.activeCount,0);assert.equal(queue.queuedCount,0);
});

test('legacy image-row geometry remains bounded and preserves grouped headings',()=>{
  const items=Array.from({length:12707},(_,index)=>({...image,id:`cloud-a/${index}.png`,path:`${index}.png`}));
  const rows=buildImageRows(items,5,220);
  const shown=visibleImageRows(rows,120000,880,2);
  assert.ok(shown.length<=10);assert.ok(shown.reduce((count,row)=>count+(row.kind==='images'?row.items.length:0),0)<=50);
  assert.equal(rows.filter(row=>row.kind==='images').reduce((count,row)=>count+(row.kind==='images'?row.items.length:0),0),12707);
  const groups=[{key:'2026-10',label:'October 2026',items:items.slice(0,8)},{key:'undated',label:'Undated',items:items.slice(8,11)}];
  const grouped=buildImageRows(items.slice(0,11),3,220,groups);
  assert.deepEqual(grouped.filter(row=>row.kind==='header').map(row=>row.label),['October 2026','Undated']);
  assert.equal(grouped[1].top,36);assert.equal(grouped[4].kind,'header');
  assert.equal(visibleImageRows([],0,100).length,0);
});

test('image metadata installation is reactive and repeat generation does not overwrite subscriptions needlessly',()=>{
  let updates=0;const unsubscribe=subscribeImageMetadata(()=>updates++);
  installImageMetadata({[hash]:metadata},'image-speed-generation');
  assert.equal(getImageMetadata(hash),metadata);assert.equal(imageMetadataVersion(),'image-speed-generation');assert.equal(updates,1);
  installImageMetadata({[hash]:metadata},'image-speed-generation');assert.equal(updates,1);
  unsubscribe();
});

test('metadata and resource loading contain no deadline abort timer; integrity and finite byte bounds remain',async()=>{
  const source=await readFile(new URL('../src/cloud.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/setTimeout|30000|120000|took too long/);
  assert.match(source,/MAX_METADATA_BYTES/);assert.match(source,/MAX_RESOURCE_BYTES/);assert.match(source,/crypto\.subtle\.digest/);
  const viewer=await readFile(new URL('../src/components/ImageViewer.tsx',import.meta.url),'utf8');
  assert.match(viewer,/fetchPriority="high"/);assert.match(viewer,/useSyncExternalStore/);
  // Current canvas DOM bounds and resize observation are exercised by grid-components
  // and grid-observer behavior tests; the previous virtual-row source checks are obsolete.
});


test('duplicate archive items sharing one immutable source retain painted readiness without depending on another load event',()=>{
  const first=imageSource(image,metadata,'preview')!;
  const duplicate=imageSource({...image,id:'cloud-copy/copy.png',archiveId:'cloud-copy',path:'copy.png'},metadata,'preview')!;
  assert.equal(first.url,duplicate.url);
  assert.equal(imageIsPaintReady(first.url,duplicate.url),true);
  assert.equal(imageIsPaintReady(first.url,'/api/collection/image?hash='+thumbnail),false);
  assert.equal(imageIsPaintReady(first.url,undefined),false);
});

test('neighbor plan signatures remain stable across reconstructed arrays and unrelated label/layout changes',()=>{
  const neighbor={...image,id:'cloud-a/next.png',path:'next.png'};
  const resolve=(item:HtmlPage)=>imageSource(item,metadata,'preview');
  const first=neighborPrefetchPlan('selected',[neighbor],resolve);
  const repeated=neighborPrefetchPlan('selected',[{...neighbor,label:'new display label'}],resolve);
  assert.equal(first.signature,repeated.signature);
  assert.notEqual(first.signature,neighborPrefetchPlan('another-selected',[neighbor],resolve).signature);
  assert.notEqual(first.signature,neighborPrefetchPlan('selected',[neighbor],item=>imageSource(item,{...metadata,preview:thumbnail},'preview')).signature);
});

test('prefetched images enter decoded cache only after decode resolves, with a load fallback when decode is unavailable',async context=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'Image');
  context.after(()=>{if(descriptor)Object.defineProperty(globalThis,'Image',descriptor);else Reflect.deleteProperty(globalThis,'Image');});
  let instance:MockImage|undefined,release=()=>{},decodeCalls=0;
  class MockImage {
    naturalWidth=20;naturalHeight=10;decoding='';fetchPriority='';src='';onload:(()=>void)|null=null;onerror:(()=>void)|null=null;
    constructor(){instance=this;}
    decode(){decodeCalls++;return new Promise<void>(resolve=>{release=resolve;});}
  }
  Object.defineProperty(globalThis,'Image',{value:MockImage,writable:true,configurable:true});
  const url='/image-speed-decode-await';let settled=false;
  const pending=warmImage(url).then(()=>{settled=true;});
  instance!.onload!();await tick();
  assert.equal(decodeCalls,1);assert.equal(settled,false);assert.equal(decodedImages.get(url),undefined);
  release();await pending;assert.equal(decodedImages.get(url),instance);
  class LegacyImage {
    naturalWidth=12;naturalHeight=8;decoding='';fetchPriority='';src='';onload:(()=>void)|null=null;onerror:(()=>void)|null=null;
    constructor(){legacy=this;}
  }
  let legacy:LegacyImage|undefined;
  Object.defineProperty(globalThis,'Image',{value:LegacyImage,writable:true,configurable:true});
  const fallback=warmImage('/image-speed-decode-fallback');legacy!.onload!();await fallback;
  assert.equal(decodedImages.get('/image-speed-decode-fallback'),legacy);
});

test('catalogue rendering metadata rejects invalid dates, MIME/hash/provenance and placeholders outside the backend WebP bound',()=>{
  const base={schema:1,generation:'images-v6',archives:[{id:'cloud-a',rootId:'cloud-a',parentId:null,mountPath:'',name:'images.zip',createdAt:1,fileCount:1,pageCount:0,imageCount:1,byteSize:image.size,warnings:[]}],pages:[image],manifests:{'cloud-a':hash},images:{[hash]:metadata}};
  assert.equal(validateCloudCatalogue(base).pages.length,1);
  for(const changes of [{modifiedAt:0},{modifiedAt:0.5},{modifiedAt:Infinity},{dateSource:'invented'},{imageHash:'invalid'},{mime:'text/html'}]){
    assert.throws(()=>validateCloudCatalogue({...base,pages:[{...image,...changes}]}),/date|hash|MIME/i);
  }
  assert.equal(validateCloudCatalogue({...base,pages:[{...image,modifiedAt:Date.UTC(2026,9,27),dateSource:'file'}]}).pages.length,1);
  for(const placeholder of ['data:image/png;base64,UklGRg==','data:image/webp;base64,','data:image/webp;base64,UklGRg=','data:image/webp;base64,'+'A'.repeat(1004)]){
    assert.throws(()=>validateCloudCatalogue({...base,images:{[hash]:{...metadata,placeholder}}}),/placeholder/i);
  }
});


test('rapid cancellation and requeue of the same image URL starts fresh work and old completion cannot erase its replacement',async()=>{
  const queue=new ImagePrefetchQueue(2);
  let resolveOld=()=>{},resolveNew=()=>{},oldAborted=false,newRuns=0;
  const old=queue.enqueue('same-image',signal=>new Promise<void>(resolve=>{
    resolveOld=resolve;signal.addEventListener('abort',()=>{oldAborted=true;},{once:true});
  }));
  await tick();queue.cancelQueuedExcept(new Set());assert.equal(oldAborted,true);
  const replacement=queue.enqueue('same-image',async()=>{newRuns++;await new Promise<void>(resolve=>{resolveNew=resolve;});});
  await tick();assert.equal(newRuns,1,'aborted in-flight promise must not be reused');
  resolveOld();await old;
  const shared=queue.enqueue('same-image',async()=>{newRuns++;});
  assert.equal(shared,replacement,'old job completion must preserve the new in-flight entry');
  resolveNew();await Promise.all([replacement,shared]);assert.equal(newRuns,1);
  assert.equal(queue.activeCount,0);
});
