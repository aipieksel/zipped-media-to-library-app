import test from 'node:test';
import assert from 'node:assert/strict';
import { HtmlThumbnailService, htmlThumbnailKey, htmlThumbnailDimensions, htmlThumbnailPngDimensions, HTML_THUMBNAIL_OPTIONS } from '../src/html-thumbnails';
import type { HtmlThumbnailAdapters, HtmlThumbnailState } from '../src/html-thumbnails';
import type { GalleryThumbnail, HtmlPage, Snapshot } from '../src/types';
import type { PreparedPreview } from '../src/preview';

const page=(name:string):HtmlPage=>({id:`root/${name}.html`,archiveId:'root',rootId:'root',path:`${name}.html`,label:name,isIndex:false,size:20});
const prepared:PreparedPreview={html:'<!doctype html><p>Preview</p>',channel:'test-channel',warnings:[],resource:async()=>({blob:new Blob()})};
const snapshot=(source:HtmlPage):Snapshot=>({pageId:source.id,blob:new Blob(['mock capture'],{type:'image/png'}),width:1280,height:800,createdAt:1,warnings:[]});
const thumbnail=(source:HtmlPage):GalleryThumbnail=>({key:htmlThumbnailKey(source),pageId:source.id,blob:new Blob(['small actual preview'],{type:'image/webp'}),width:360,height:225,createdAt:1,lastUsedAt:1});
const tick=async(count=12)=>{for(let index=0;index<count;index++)await new Promise<void>(resolve=>queueMicrotask(resolve));};
function adapters(overrides:Partial<HtmlThumbnailAdapters>={}):HtmlThumbnailAdapters{return{
  read:async()=>undefined,prepare:async()=>prepared,capture:async source=>snapshot(source),
  encode:async source=>thumbnail(source),write:async()=>true,...overrides,
};}

test('automatic thumbnail work is globally serial across source preparation, capture, encoding and cache writes',async()=>{
  let active=0,maximum=0;const releases:(()=>void)[]=[];const starts:string[]=[];
  const service=new HtmlThumbnailService(adapters({prepare:async source=>{
    starts.push(source.id);active++;maximum=Math.max(maximum,active);
    await new Promise<void>(resolve=>releases.push(resolve));return prepared;
  },write:async()=>{active--;return true;}}));
  const states=new Map<string,HtmlThumbnailState>();
  const cancelA=service.watch(page('a'),state=>states.set('a',state));
  const cancelB=service.watch(page('b'),state=>states.set('b',state));
  await tick();assert.deepEqual(starts,['root/a.html']);assert.equal(service.activeCount,1);
  releases.shift()!();await tick();assert.deepEqual(starts,['root/a.html','root/b.html']);
  releases.shift()!();await tick();assert.equal(maximum,1);assert.equal(states.get('a')?.status,'ready');assert.equal(states.get('b')?.status,'ready');
  cancelA();cancelB();
});

test('canceling an uncancelable pending preparation holds the one permit until that preparation actually settles',async()=>{
  let release=()=>{},captures=0;const starts:string[]=[];
  const service=new HtmlThumbnailService(adapters({prepare:async source=>{
    starts.push(source.id);if(source.id==='root/a.html')await new Promise<void>(resolve=>{release=resolve;});return prepared;
  },capture:async source=>{captures++;return snapshot(source);}}));
  const cancelA=service.watch(page('a'),()=>{});await tick();cancelA();
  const cancelB=service.watch(page('b'),()=>{});await tick();
  assert.deepEqual(starts,['root/a.html']);assert.equal(service.activeCount,1);assert.equal(captures,0);
  release();await tick();assert.deepEqual(starts,['root/a.html','root/b.html']);assert.equal(captures,1,'aborted page must never create a capture frame');
  cancelB();
});

test('off-page queued demand disappears and a paused manual capture prevents automatic rendering',async()=>{
  const starts:string[]=[];const service=new HtmlThumbnailService(adapters({prepare:async source=>{starts.push(source.id);return prepared;}}));
  service.setPaused(true);
  const stopA=service.watch(page('a'),()=>{}),stopB=service.watch(page('b'),()=>{});stopA();
  await tick();assert.deepEqual(starts,[]);assert.equal(service.queuedCount,1);
  service.setPaused(false);await tick();assert.deepEqual(starts,['root/b.html']);stopB();
});

test('manual pause aborts an active capture, queues current demand once, and resumes after cancellation settles',async()=>{
  let captures=0,aborts=0;
  const service=new HtmlThumbnailService(adapters({capture:async(source,_prepared,_options,signal)=>{
    captures++;
    if(captures===1)return new Promise<Snapshot>((_resolve,reject)=>signal.addEventListener('abort',()=>{aborts++;reject(new DOMException('cancelled','AbortError'));},{once:true}));
    return snapshot(source);
  }}));
  const stop=service.watch(page('a'),()=>{});await tick();assert.equal(captures,1);
  service.setPaused(true);await tick();assert.equal(aborts,1);assert.equal(captures,1);assert.equal(service.queuedCount,1);
  service.setPaused(false);await tick();assert.equal(captures,2);assert.equal(service.getState(page('a'))?.status,'ready');stop();
});

test('render failures require explicit retry and do not loop on subscribe, rerender or return to a canvas page',async()=>{
  let attempts=0;
  const service=new HtmlThumbnailService(adapters({prepare:async()=>{attempts++;if(attempts===1)throw new Error('Missing stylesheet.');return prepared;}}));
  const first=service.watch(page('a'),()=>{});await tick();assert.equal(service.getState(page('a'))?.status,'error');first();
  const second=service.watch(page('a'),()=>{});await tick();assert.equal(attempts,1);
  service.retry(page('a'));await tick();assert.equal(attempts,2);assert.equal(service.getState(page('a'))?.status,'ready');second();
});

test('bounded cached WebP previews render without source fetch and cache/quota writes are nonfatal',async()=>{
  const source=page('cached');let preparations=0,writes=0;
  const cached=new HtmlThumbnailService(adapters({read:async()=>thumbnail(source),prepare:async()=>{preparations++;return prepared;}}));
  const stopCached=cached.watch(source,()=>{});await tick();assert.equal(cached.getState(source)?.status,'ready');assert.equal(preparations,0);stopCached();
  const quota=new HtmlThumbnailService(adapters({write:async()=>{writes++;throw new DOMException('Quota full','QuotaExceededError');}}));
  const stop=quota.watch(page('quota'),()=>{});await tick();assert.equal(writes,1);assert.equal(quota.getState(page('quota'))?.status,'ready');stop();
});

test('cache keys separate source identities and fixed renderer options while no automatic full snapshot is written',async()=>{
  assert.notEqual(htmlThumbnailKey(page('a')),htmlThumbnailKey(page('b')));
  assert.equal(htmlThumbnailKey({...page('a'),modifiedAt:123}),htmlThumbnailKey(page('a')),'display date changes do not change immutable source identity');
  let written:GalleryThumbnail|undefined;
  const service=new HtmlThumbnailService(adapters({capture:async(source,_prepared,options)=>{assert.deepEqual(options,HTML_THUMBNAIL_OPTIONS);return snapshot(source);},write:async record=>{written=record;return true;}}));
  const stop=service.watch(page('a'),()=>{});await tick();assert.equal(written?.blob.type,'image/webp');assert.equal(written?.width,360);assert.ok(written!.blob.size<=256*1024);stop();
});


test('inactive failed previews have a bounded LRU while watched errors never automatically retry',async()=>{
  const attempts=new Map<string,number>();
  const service=new HtmlThumbnailService(adapters({prepare:async source=>{attempts.set(source.id,(attempts.get(source.id)??0)+1);throw new Error('Source unavailable.');}}),2);
  const keep=service.watch(page('visible'),()=>{});await tick();
  for(const name of ['oldest','middle','newest']){const stop=service.watch(page(name),()=>{});await tick();stop();}
  assert.equal(service.getState(page('visible'))?.status,'error');
  assert.equal(service.getState(page('oldest')),undefined);assert.equal(service.getState(page('middle')),undefined);
  assert.equal(service.getState(page('newest'))?.status,'error');
  const visibleAgain=service.watch(page('visible'),()=>{});await tick();assert.equal(attempts.get('root/visible.html'),1,'a watched error keeps its explicit-retry guard');
  const oldestAgain=service.watch(page('oldest'),()=>{});await tick();assert.equal(attempts.get('root/oldest.html'),2,'eviction also removes the stale failure-map entry');
  oldestAgain();visibleAgain();keep();
});

test('portrait and landscape thumbnails bound both edges to 360px and reject oversized cached records',async()=>{
  assert.deepEqual(htmlThumbnailDimensions(1280,800),{width:360,height:225});
  assert.deepEqual(htmlThumbnailDimensions(800,1280),{width:225,height:360});
  assert.deepEqual(htmlThumbnailDimensions(80,120),{width:80,height:120});
  assert.throws(()=>htmlThumbnailDimensions(0,1280));
  let preparations=0;const source=page('portrait');
  const service=new HtmlThumbnailService(adapters({read:async()=>({...thumbnail(source),height:361}),prepare:async()=>{preparations++;return prepared;},encode:async()=>({...thumbnail(source),height:361})}));
  const stop=service.watch(source,()=>{});await tick();assert.equal(preparations,1);assert.equal(service.getState(source)?.status,'error');stop();
});


test('automatic PNG preflight rejects malformed or oversized headers before image decoding',()=>{
  const header=(width:number,height:number)=>{const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);const view=new DataView(bytes.buffer);view.setUint32(16,width);view.setUint32(20,height);return bytes;};
  assert.deepEqual(htmlThumbnailPngDimensions(header(1280,800)),{width:1280,height:800});
  assert.deepEqual(htmlThumbnailPngDimensions(header(4096,4096)),{width:4096,height:4096});
  for(const dimensions of [[0,800],[1280,0],[16385,1],[1,16385],[4097,4096]])assert.throws(()=>htmlThumbnailPngDimensions(header(dimensions[0],dimensions[1])),/decode bounds/);
  assert.throws(()=>htmlThumbnailPngDimensions(new Uint8Array(23)),/valid PNG/);
  const corrupt=header(1280,800);corrupt[12]=0;assert.throws(()=>htmlThumbnailPngDimensions(corrupt),/valid PNG/);
  const wrongSignature=header(1280,800);wrongSignature[0]=0;assert.throws(()=>htmlThumbnailPngDimensions(wrongSignature),/valid PNG/);
});
