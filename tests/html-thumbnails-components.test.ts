import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import type {GalleryProps} from '../src/components/Gallery';
import type {HtmlPage,Snapshot} from '../src/types';
const temporary=mkdtempSync(join(tmpdir(),'folio-html-gallery-'));
const output=join(temporary,'harness.cjs');
buildSync({stdin:{resolveDir:fileURLToPath(new URL('../',import.meta.url)),sourcefile:'html-gallery-harness.cjs',contents:`
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const runtime=require('react/jsx-runtime');
const {Gallery,selectHtmlGalleryPreview}=require('./src/components/Gallery.tsx');
exports.choose=selectHtmlGalleryPreview;
exports.render=(props)=>{
  const captured=[],originals={jsx:runtime.jsx,jsxs:runtime.jsxs};
  for(const key of ['jsx','jsxs'])runtime[key]=(type,props,...rest)=>{if(typeof type==='string')captured.push({type,props});return originals[key](type,props,...rest);};
  try{return{html:renderToStaticMarkup(React.createElement(Gallery,props)),captured};}
  finally{Object.assign(runtime,originals);}
};`},outfile:output,bundle:true,platform:'node',format:'cjs',loader:{'.css':'empty'},external:['*?raw'],logLevel:'silent'});
const harness=createRequire(import.meta.url)(output) as {render:(props:GalleryProps)=>{html:string;captured:{type:string;props:any}[]};choose:(snapshot:unknown,thumbnail:unknown)=>{blob:Blob;manual:boolean}};
after(()=>rmSync(temporary,{recursive:true,force:true}));
const pages:HtmlPage[]=Array.from({length:5},(_,index)=>({id:`archive/${index}.html`,archiveId:'archive',rootId:'archive',path:`${index}.html`,label:`Page ${index}`,isIndex:false,size:5,modifiedAt:Date.UTC(2026,index%2?9:5,1)}));
const snapshot:Snapshot={pageId:pages[0].id,blob:new Blob(['manual PNG'],{type:'image/png'}),width:1440,height:900,createdAt:1,warnings:[]};
function props(overrides:Partial<GalleryProps>={}):GalleryProps{return{pages,archives:[],snapshots:new Map([[pages[0].id,snapshot]]),query:'',onOpen(){},onCaptureMissing(){},busy:false,grid:{columns:2,rows:2},page:0,...overrides};}

test('real HTML gallery includes uncaptured pages in exact 2 by 2 slots and leaves remaining files on the next page',()=>{
  const first=harness.render(props());
  const cards=first.captured.filter(item=>item.type==='article'&&item.props['data-html-page-id']);
  assert.deepEqual(cards.map(item=>item.props['data-html-page-id']),pages.slice(0,4).map(page=>page.id));
  assert.equal(cards[0].props['data-preview-source'],'manual');
  assert.ok(cards.slice(1).every(item=>item.props['data-preview-source']==='idle'));
  assert.match(first.html,/data-grid-columns="2"/);assert.match(first.html,/data-grid-rows="2"/);
  assert.match(first.html,/data-total-html-pages="5"/);
  assert.deepEqual(harness.render(props({page:1})).captured.filter(item=>item.type==='article'&&item.props['data-html-page-id']).map(item=>item.props['data-html-page-id']),[pages[4].id]);
});

test('saved manual screenshot wins over an automatic thumbnail and open handlers preserve screenshot versus live HTML behavior',()=>{
  const generated={blob:new Blob(['automatic WebP'],{type:'image/webp'}),width:360,height:225};
  const chosen=harness.choose(snapshot,generated);assert.equal(chosen.manual,true);assert.equal(chosen.blob,snapshot.blob);
  const opened:[string,string][]=[];
  const {captured}=harness.render(props({onOpen:(id,mode)=>opened.push([id,mode])}));
  captured.find(item=>item.type==='button'&&item.props.className==='folio-gallery-preview'&&item.props['aria-label']==='View screenshot of Page 0')!.props.onClick();
  captured.find(item=>item.type==='button'&&item.props.className==='folio-gallery-preview'&&item.props['aria-label']==='Open HTML for Page 1')!.props.onClick();
  assert.deepEqual(opened,[[pages[0].id,'snapshot'],[pages[1].id,'live']]);
});

test('actual HTML pager handlers are wired and month headings do not reduce card capacity',()=>{
  const changed:number[]=[];
  const {captured,html}=harness.render(props({groupByMonth:true,onPageChange:page=>changed.push(page)}));
  assert.equal(captured.filter(item=>item.type==='article'&&item.props['data-html-page-id']).length,4);
  captured.find(item=>item.type==='button'&&item.props['aria-label']==='Next gallery page')!.props.onClick();
  assert.deepEqual(changed,[1]);assert.match(html,/Months on this page/);assert.match(html,/June 2026/);assert.match(html,/October 2026/);
});

test('8 by 8 HTML canvas bounds mounted cards at 64 even with all 2572 pages available',()=>{
  const many=Array.from({length:2572},(_,index)=>({...pages[0],id:`archive/${index}.html`,path:`${index}.html`}));
  const {captured}=harness.render(props({pages:many,grid:{columns:8,rows:8},snapshots:new Map()}));
  assert.equal(captured.filter(item=>item.type==='article'&&item.props['data-html-page-id']).length,64);
});
