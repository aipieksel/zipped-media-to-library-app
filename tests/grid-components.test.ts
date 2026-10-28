import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import type {ImageGalleryProps} from '../src/components/ImageGallery';
import type {HtmlPage} from '../src/types';
const temporary=mkdtempSync(join(tmpdir(),'folio-grid-render-')),output=join(temporary,'harness.cjs');
buildSync({stdin:{resolveDir:fileURLToPath(new URL('../',import.meta.url)),sourcefile:'grid-render-harness.cjs',contents:`
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const runtime=require('react/jsx-runtime');
const gallery=require('./src/components/ImageGallery.tsx');
const {GridPager}=require('./src/components/GridPager.tsx');
const {installImageMetadata}=require('./src/cloud.ts');
const dimensions=require('./src/image-dimensions.ts');
function render(Component,props){
 const captured=[],originals={jsx:runtime.jsx,jsxs:runtime.jsxs};
 for(const key of ['jsx','jsxs'])runtime[key]=(type,props,...rest)=>{if(typeof type==='string')captured.push({type,props});return originals[key](type,props,...rest);};
 try{return{html:renderToStaticMarkup(React.createElement(Component,props)),captured};}finally{Object.assign(runtime,originals);}
}
exports.renderGallery=props=>render(gallery.ImageGallery,props);exports.renderPager=props=>render(GridPager,props);
exports.originalDimensionsForImageLoad=gallery.originalDimensionsForImageLoad;exports.installImageMetadata=installImageMetadata;
exports.imageDimensions=dimensions.imageDimensions;exports.dimensionVersion=dimensions.dimensionVersion;
`},outfile:output,bundle:true,platform:'node',format:'cjs',loader:{'.css':'empty'},logLevel:'silent'});
const harness=createRequire(import.meta.url)(output);
after(()=>rmSync(temporary,{recursive:true,force:true}));
const items:HtmlPage[]=Array.from({length:12707},(_,index)=>({id:`image-${index}`,archiveId:'cloud-fixture',rootId:'cloud-fixture',path:`Image ${index}.png`,label:`Image ${index}.png`,kind:'image',isIndex:false,size:1000,modifiedAt:Date.UTC(2026,index<5?5:4,1)}));
const props=(overrides:Partial<ImageGalleryProps>={}):ImageGalleryProps=>({items,archives:[],organization:new Map(),onOpen(){},onFavorite(){},...overrides});
const capture=(result:any,attribute:string,value:string)=>result.captured.find((entry:any)=>entry.props[attribute]===value)!.props;

test('actual image canvas mounts only the current chosen N×M page and exposes its dimensions',()=>{
  for(const grid of [{columns:1,rows:1},{columns:2,rows:3},{columns:8,rows:8}]){
    const result=harness.renderGallery(props({grid,page:2}));
    const cards=result.captured.filter((entry:any)=>entry.type==='article'&&entry.props.className==='folio-image-card');
    assert.equal(cards.length,grid.columns*grid.rows);
    const section=capture(result,'aria-label','Image gallery');
    assert.equal(section['data-grid-columns'],grid.columns);assert.equal(section['data-grid-rows'],grid.rows);
    assert.ok(result.html.includes(`Open image Image ${grid.columns*grid.rows*2}.png`));
    assert.ok(!result.html.includes('Open image Image 0.png'));
  }
});
test('last page clamps safely and keeps its remaining items in canonical input order',()=>{
  const result=harness.renderGallery(props({grid:{columns:8,rows:8},page:999}));
  const buttons=result.captured.filter((entry:any)=>entry.type==='button'&&entry.props['aria-label']?.startsWith('Open image '));
  assert.equal(buttons.length,35);
  assert.deepEqual(buttons.map((entry:any)=>entry.props['aria-label']),items.slice(12672).map(item=>`Open image ${item.label}`));
});
test('month headings use a separate strip and never consume chosen card slots',()=>{
  const result=harness.renderGallery(props({items:items.slice(0,10),grid:{columns:2,rows:3},page:0,groupByMonth:true}));
  assert.equal(result.captured.filter((entry:any)=>entry.type==='article'&&entry.props.className==='folio-image-card').length,6);
  const strip=capture(result,'aria-label','Months on this page');assert.match(strip.children,/June 2026/);assert.match(strip.children,/May 2026/);
  assert.match(strip.children,/5/);assert.match(strip.children,/1/);
});
test('image open and favorite handlers retain canonical IDs on later canvas pages',()=>{
  const opened:string[]=[],favorites:string[]=[];
  const result=harness.renderGallery(props({grid:{columns:2,rows:2},page:1,onOpen:id=>opened.push(id),onFavorite:id=>favorites.push(id),organization:new Map([['image-4',{id:'image-4',favorite:true,folderId:null}]])}));
  capture(result,'aria-label','Open image Image 4.png').onClick();
  const favorite=capture(result,'aria-label','Remove Image 4.png from favorites');assert.equal(favorite['aria-pressed'],true);favorite.onClick();
  assert.deepEqual(opened,['image-4']);assert.deepEqual(favorites,['image-4']);
});
test('shared pager has accessible page bounds and changes the requested page through actual callbacks',()=>{
  const pages:number[]=[];
  const result=harness.renderPager({page:2,pageCount:5,total:40,columns:2,rows:4,onPageChange:(page:number)=>pages.push(page)});
  capture(result,'aria-label','Previous gallery page').onClick();capture(result,'aria-label','Next gallery page').onClick();
  assert.deepEqual(pages,[1,3]);
  const input=capture(result,'aria-label','Gallery page');assert.equal(input.min,1);assert.equal(input.max,5);assert.equal(input.value,'3');
  const first=harness.renderPager({page:0,pageCount:1,total:0,columns:2,rows:4,onPageChange(){}});
  assert.equal(capture(first,'aria-label','Previous gallery page').disabled,true);assert.equal(capture(first,'aria-label','Next gallery page').disabled,true);
});
test('thumbnail natural dimensions cannot become original dimensions, while metadata and original sources can',()=>{
  const cloud={...items[0],imageHash:'a'.repeat(64)},local={...items[0],archiveId:'local-upload',imageHash:undefined};
  const dimensions=harness.originalDimensionsForImageLoad;
  assert.equal(dimensions(cloud,{original:false},360,180),undefined);
  assert.equal(dimensions(cloud,{},360,180),undefined);
  assert.deepEqual(dimensions(cloud,{width:4000,height:2000,original:false},360,180),{width:4000,height:2000});
  assert.deepEqual(dimensions(cloud,{original:true},5000,2500),{width:5000,height:2500});
  assert.deepEqual(dimensions(local,{},1200,2400),{width:1200,height:2400});
  for(const [width,height]of [[0,200],[-1,200],[Infinity,1],[1.5,2],[65537,1]])assert.equal(dimensions(local,{},width,height),undefined);
});
test('native thumbnail load keeps known original metadata and does not redundantly notify dimension subscribers',()=>{
  const hash='b'.repeat(64),thumbnail='c'.repeat(64),item={...items[0],imageHash:hash};
  harness.installImageMetadata({[hash]:{original:{archiveId:item.archiveId,path:item.path,mime:'image/png',size:item.size},width:4000,height:2000,thumbnail,thumbnailBytes:100}},'known-original');
  const before=harness.dimensionVersion();
  const result=harness.renderGallery(props({items:[item],grid:{columns:1,rows:1}}));
  const image=capture(result,'src',`/api/collection/image?hash=${thumbnail}`);
  const footer=capture(result,'className','folio-image-card-bytes');assert.match(footer.children,/4000 × 2000/);assert.match(footer.title,/4000 × 2000/);
  image.onLoad({currentTarget:{naturalWidth:360,naturalHeight:180}});
  assert.deepEqual(harness.imageDimensions(item),{width:4000,height:2000});assert.equal(harness.dimensionVersion(),before);
});


test('unlearned image dimensions are explicit in card details and a full thumbnail tooltip',()=>{
  const result=harness.renderGallery(props({items:[items[10]],grid:{columns:1,rows:1}}));
  const details=capture(result,'className','folio-image-card-bytes');assert.match(details.children,/Unknown dimensions/);
  assert.match(capture(result,'aria-label',`Open image ${items[10].label}`).title,/Unknown dimensions/);
});
