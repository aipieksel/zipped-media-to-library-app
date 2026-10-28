import test from 'node:test';
import assert from 'node:assert/strict';
import {installImageMetadata} from '../src/cloud';
import {dimensionVersion,imageDimensions,imageOrientation,installImageDimensions,matchesImageShape,normalizeImageShape,recordImageDimensions,subscribeImageDimensions,validImageDimensions} from '../src/image-dimensions';
import {compareItems,projectTree} from '../src/order';
import {buildOrganizedTree,getPageOrder} from '../src/tree';
import {thumbnailEvictions,THUMBNAIL_MAX_BYTES} from '../src/thumbnail-cache';
import type {ArchiveMeta,HtmlPage} from '../src/types';
const page=(name:string):HtmlPage=>({id:`local/${name}`,rootId:'local',archiveId:'local',path:name,label:name,isIndex:false,kind:'image',size:1});
const archive:ArchiveMeta={id:'local',rootId:'local',parentId:null,name:'Images',mountPath:'',createdAt:1,fileCount:4,pageCount:0,imageCount:4,byteSize:4,warnings:[]};

test('landscape, portrait and exact square use valid original pixel dimensions, with explicit Unknown',()=>{
  assert.equal(imageOrientation({width:1600,height:900}),'landscape');assert.equal(imageOrientation({width:900,height:1600}),'portrait');
  assert.equal(imageOrientation({width:1080,height:1080}),'square');assert.equal(imageOrientation({width:1080,height:1079}),'landscape');
  for(const dimensions of [undefined,{width:0,height:1},{width:NaN,height:2},{width:2.5,height:3},{width:65537,height:3}])assert.equal(imageOrientation(dimensions),'unknown');
  assert.equal(normalizeImageShape('made-up'),'all');assert.equal(validImageDimensions({width:65536,height:65536}),true);
});
test('authoritative cloud original dimensions override a learned downscaled size and stay metadata-only',()=>{
  const hash='a'.repeat(64),item={...page('authority.png'),imageHash:hash};recordImageDimensions(item.id,360,180);
  installImageMetadata({[hash]:{width:4000,height:2000,original:{archiveId:'cloud-original',path:'authority.png',size:1,mime:'image/png'}}},'dimension-authority-test');
  assert.deepEqual(imageDimensions(item),{width:4000,height:2000});assert.equal(matchesImageShape(item,'landscape'),true);assert.equal(matchesImageShape(item,'portrait'),false);
});
test('learning local dimensions is reactive once per change and duplicate measurements do not cause rerender loops',()=>{
  const item=page('learn-local.jpg');let changes=0;const before=dimensionVersion(),unsubscribe=subscribeImageDimensions(()=>changes++);
  recordImageDimensions(item.id,600,900);recordImageDimensions(item.id,600,900);recordImageDimensions(item.id,0,900);
  assert.equal(changes,1);assert.equal(dimensionVersion(),before+1);assert.deepEqual(imageDimensions(item),{width:600,height:900});unsubscribe();
  installImageDimensions({'other/local.png':{width:123,height:456},bad:{width:-1,height:4}});
  assert.deepEqual(imageDimensions({...item,id:'other/local.png'}),{width:123,height:456});
});
test('both pixel-area directions keep unknown dimensions last with stable ties',()=>{
  const small=page('small.png'),large=page('large.png'),same=page('same.png'),unknown=page('unknown.png');
  recordImageDimensions(small.id,400,300);recordImageDimensions(large.id,4000,3000);recordImageDimensions(same.id,3000,4000);
  assert.deepEqual([small,unknown,same,large].sort((a,b)=>compareItems(a,b,'largest')).map(p=>p.path),['large.png','same.png','small.png','unknown.png']);
  assert.deepEqual([unknown,large,small].sort((a,b)=>compareItems(a,b,'smallest')).map(p=>p.path),['small.png','large.png','unknown.png']);
});
test('shape filtering and dimension ordering drive the same canonical tree, navigation and gallery sequence',()=>{
  const landscape=page('land.png'),portrait=page('portrait.png'),square=page('square.png'),unknown=page('no-size.png');
  recordImageDimensions(landscape.id,1600,900);recordImageDimensions(portrait.id,900,1600);recordImageDimensions(square.id,900,900);
  const all=[landscape,portrait,square,unknown],items=new Map(all.map(p=>[p.id,p]));
  const shape=all.filter(p=>matchesImageShape(p,'landscape'));
  const tree=projectTree(buildOrganizedTree([archive],shape,[],new Map(),'image'),items,{sort:'largest',group:'all'});
  assert.deepEqual(getPageOrder(tree),[landscape.id]);assert.equal(new Set(getPageOrder(tree)).size,shape.length);assert.equal(matchesImageShape(unknown,'unknown'),true);
});
test('thumbnail LRU enforces count and byte ceilings without mutating the input inventory',()=>{
  const entries=Array.from({length:201},(_,index)=>({key:String(index),lastUsedAt:index,bytes:100}));
  assert.deepEqual(thumbnailEvictions(entries),['0']);assert.equal(entries.length,201);
  const heavy=Array.from({length:200},(_,index)=>({key:String(index),lastUsedAt:index,bytes:256*1024}));
  const evicted=new Set(thumbnailEvictions(heavy));const remaining=heavy.filter(e=>!evicted.has(e.key));
  assert.equal(remaining.length,128);assert.ok(remaining.reduce((n,e)=>n+e.bytes,0)<=THUMBNAIL_MAX_BYTES);
  assert.equal(evicted.has('199'),false);assert.equal(thumbnailEvictions([]).length,0);
});
