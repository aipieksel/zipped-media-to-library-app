import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import type {ArchiveTreeProps} from '../src/components/ArchiveTree';
import type {TreeNode} from '../src/types';
// Render the real component using React's server renderer. Capture the actual JSX
// handlers to check event wiring separately from browser geometry/focus behavior.
const temporary=mkdtempSync(join(tmpdir(),'folio-tree-render-'));
const output=join(temporary,'harness.cjs');
buildSync({stdin:{resolveDir:fileURLToPath(new URL('../',import.meta.url)),sourcefile:'tree-render-harness.cjs',contents:`
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const runtime=require('react/jsx-runtime');
const {ArchiveTree}=require('./src/components/ArchiveTree.tsx');
exports.render=(props)=>{
  const captured=[];
  const originals={jsx:runtime.jsx,jsxs:runtime.jsxs};
  for(const key of ['jsx','jsxs'])runtime[key]=(type,props,...rest)=>{if(typeof type==='string')captured.push({type,props});return originals[key](type,props,...rest);};
  try{return {html:renderToStaticMarkup(React.createElement(ArchiveTree,props)),captured};}
  finally{Object.assign(runtime,originals);}
};`},outfile:output,bundle:true,platform:'node',format:'cjs',loader:{'.css':'empty'},logLevel:'silent'});
const render=createRequire(import.meta.url)(output).render as (props:ArchiveTreeProps)=>{html:string;captured:{type:string;props:any}[]};
after(()=>rmSync(temporary,{recursive:true,force:true}));
const leaf=(id:string,alias?:string):TreeNode=>({id,pageId:id,archiveId:'root',label:id,kind:'page',children:[],pageCount:1,sourceFolderId:alias});
const folder:TreeNode={id:'root',archiveId:'root',label:'Archive',kind:'archive',children:[leaf('page')],pageCount:1};
function props(overrides:Partial<ArchiveTreeProps>={}):ArchiveTreeProps{return {nodes:[folder],pages:[{id:'page',archiveId:'root',rootId:'root',path:'page.html',label:'page',isIndex:false,size:1}],selectedId:null,expanded:new Set(),snapshots:new Map(),captureErrors:new Map(),query:'',onSelect(){},onToggle(){},onRemove(){},...overrides};}
const row=(captured:{type:string;props:any}[],group=true)=>captured.find(item=>item.type==='div'&&item.props.className===`folio-tree-row ${group?'is-group':'is-page'}`)!.props;
function keyEvent(key:string){const target={};return {key,target,currentTarget:target,preventDefault(){},stopPropagation(){}} as any;}

test('folder row and Enter open it, while the disclosure button only toggles it',()=>{
  const opened:string[]=[],toggled:string[]=[],selected:string[]=[];
  const {captured}=render(props({onOpenFolder:id=>opened.push(id),onToggle:id=>toggled.push(id),onSelect:id=>selected.push(id)}));
  row(captured).onClick({currentTarget:{parentElement:{focus(){}}}});
  captured.find(item=>item.props['data-tree-node']==='root')!.props.onKeyDown(keyEvent('Enter'));
  assert.deepEqual(opened,['root','root']);assert.deepEqual(toggled,[]);assert.deepEqual(selected,[]);
  let stopped=0;
  captured.find(item=>item.type==='button'&&item.props['aria-label']==='Expand Archive')!.props.onClick({stopPropagation(){stopped++;}});
  assert.equal(stopped,1);assert.deepEqual(toggled,['root']);assert.deepEqual(opened,['root','root']);
});
test('folder star has a persistent accessible pressed state and never activates the folder row',()=>{
  const favorites:string[]=[],opened:string[]=[],toggled:string[]=[];
  const {captured,html}=render(props({favoriteFolders:new Set(['root']),onFavoriteFolder:id=>favorites.push(id),onOpenFolder:id=>opened.push(id),onToggle:id=>toggled.push(id)}));
  const button=captured.find(item=>item.type==='button'&&item.props['data-favorite-folder-id']==='root')!.props;
  assert.equal(button['aria-pressed'],true);assert.equal(button['aria-label'],'Remove folder favorite: Archive');
  assert.match(html,/folio-tree-folder-favorite is-favorite/);
  let stopped=0;button.onClick({stopPropagation(){stopped++;}});
  assert.equal(stopped,1);assert.deepEqual(favorites,['root']);assert.deepEqual(opened,[]);assert.deepEqual(toggled,[]);
});
test('compact index aliases expose folder stars independently of direct file favorites and keep leaf activation',()=>{
  const selected:string[]=[],favorites:string[]=[],opened:string[]=[];
  const {captured,html}=render(props({nodes:[leaf('page','root::folder::landing')],organization:new Map([['page',{id:'page',favorite:true,folderId:null}]]),favoriteFolders:new Set(['root::folder::landing']),onFavoriteFolder:id=>favorites.push(id),onSelect:id=>selected.push(id),onOpenFolder:id=>opened.push(id)}));
  row(captured,false).onClick({currentTarget:{parentElement:{focus(){}}}});
  assert.deepEqual(selected,['page']);assert.deepEqual(opened,[]);
  const button=captured.find(item=>item.props['data-favorite-folder-id']==='root::folder::landing')!.props;
  button.onClick({stopPropagation(){}});assert.deepEqual(favorites,['root::folder::landing']);
  assert.match(html,/aria-label="File favorite"/);
});
test('synthetic month headers open their first-file action but cannot receive folder stars',()=>{
  const opened:string[]=[];
  const month={...folder,id:'month:2026-10',kind:'collection' as const,archiveId:'',label:'October 2026'};
  const {captured}=render(props({nodes:[month],onOpenFolder:id=>opened.push(id),onFavoriteFolder(){}}));
  assert.ok(!captured.some(item=>item.props['data-favorite-folder-id']));
  row(captured).onClick({currentTarget:{parentElement:{focus(){}}}});assert.deepEqual(opened,['month:2026-10']);
});
test('folder Left/Right keys retain expansion controls without opening a file',()=>{
  const toggled:string[]=[],opened:string[]=[];
  const closed=render(props({onToggle:id=>toggled.push(id),onOpenFolder:id=>opened.push(id)}));
  closed.captured.find(item=>item.props['data-tree-node']==='root')!.props.onKeyDown(keyEvent('ArrowRight'));
  const expanded=render(props({expanded:new Set(['root']),onToggle:id=>toggled.push(id),onOpenFolder:id=>opened.push(id)}));
  expanded.captured.find(item=>item.props['data-tree-node']==='root')!.props.onKeyDown(keyEvent('ArrowLeft'));
  assert.deepEqual(toggled,['root','root']);assert.deepEqual(opened,[]);
});
test('optional row dates show compact UTC labels and full provenance tooltips without changing tree identity',()=>{
  const dates=new Map([['root',{timestamp:Date.UTC(2026,9,27,12,30),kind:'source' as const,label:'Latest source modified'}]]);
  const {captured}=render(props({showDates:true,nodeDates:dates}));
  const date=captured.find(item=>item.props.className==='folio-tree-date')!.props;
  assert.match(date.children,/Oct/);assert.match(date.children,/27/);assert.match(date.children,/26/);
  assert.match(date.title,/Latest source modified/);assert.match(date.title,/2026/);assert.match(date.title,/UTC/);
  assert.equal(date['data-date-kind'],'source');
  assert.ok(captured.some(item=>item.props['data-tree-node']==='root'));
  assert.ok(!render(props({showDates:false,nodeDates:dates})).captured.some(item=>item.props.className==='folio-tree-date'));
});
test('the real month and all-files components bound mounted DOM rows for 12707 leaves',()=>{
  const pages=Array.from({length:12707},(_,index)=>leaf(`image-${index}`));
  for(const nodes of [pages,[{...folder,id:'month:2026-10',kind:'collection' as const,children:pages,pageCount:pages.length}]]){
    const {captured}=render(props({nodes,pages:[],expanded:new Set(['month:2026-10']),onOpenFolder(){},onFavoriteFolder(){}}));
    const mounted=captured.filter(item=>item.props.role==='treeitem');
    assert.ok(mounted.length<=38,`mounted ${mounted.length} rows`);
    assert.ok(mounted.length>0);assert.ok(mounted.every(item=>item.props['aria-level']>0));
    assert.ok(mounted.some(item=>item.props['aria-setsize']===12707));
    assert.ok(captured.some(item=>item.type==='ul'&&item.props.className==='folio-tree folio-tree-virtual'));
  }
});
