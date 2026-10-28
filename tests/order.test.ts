import test from 'node:test';
import assert from 'node:assert/strict';
import {compareItems,DEFAULT_ORDER,groupItemsByMonth,itemDate,monthKey,monthLabel,normalizeOrder,projectTree} from '../src/order';
import {buildOrganizedTree,filterTree,getAncestorIds,getPageOrder} from '../src/tree';
import {clampSidebar,sidebarMax} from '../src/sidebar';
import type {ArchiveMeta,HtmlPage,ItemOrganization} from '../src/types';
const archive=(id:string,name:string):ArchiveMeta=>({id,rootId:id,parentId:null,mountPath:'',name,createdAt:0,fileCount:5,pageCount:4,byteSize:20,warnings:[]});
const archives=[archive('a','Zebra.zip'),archive('b','Alpha.zip')];
const item=(id:string,label:string,date?:number,archiveId='a',kind:'html'|'image'='html'):HtmlPage=>({id,label,path:`exports/${id}.${kind==='html'?'html':'png'}`,archiveId,rootId:archiveId,modifiedAt:date,kind,isIndex:false,size:1});
const items=[item('a1','image 10',Date.UTC(2026,0,5)),item('a2','image 2',Date.UTC(2025,11,31)),item('b1','Alpha',Date.UTC(2026,0,6),'b'),item('b2','Undated',undefined,'b')];
const itemMap=new Map(items.map(page=>[page.id,page]));
const archiveMap=new Map(archives.map(root=>[root.id,root]));
const base=()=>buildOrganizedTree(archives,items,[],new Map(),'html');
const order=(sort:'name-asc'|'name-desc'|'newest'|'oldest',group:'folders'|'month'|'all')=>projectTree(base(),itemMap,{sort,group},archiveMap);

test('all-files alphabetical projection is global and uses natural numeric names',()=>{
  assert.deepEqual(getPageOrder(order('name-asc','all')),['b1','a2','a1','b2']);
  assert.deepEqual(getPageOrder(order('name-desc','all')),['b2','a1','a2','b1']);
});
test('both date directions keep files with no valid source or added date last',()=>{
  assert.deepEqual(getPageOrder(order('newest','all')),['b1','a1','a2','b2']);
  assert.deepEqual(getPageOrder(order('oldest','all')),['a2','a1','b1','b2']);
  assert.equal(itemDate(items[3],archiveMap),undefined);
});
test('equal dates and labels resolve by source path then canonical ID deterministically',()=>{
  const fixture=[{...item('c','Same',5),path:'z.html'},{...item('b','Same',5),path:'a.html'},{...item('a','Same',5),path:'a.html'}];
  for(const mode of ['newest','oldest','name-asc','name-desc'] as const)assert.deepEqual([...fixture].sort((a,b)=>compareItems(a,b,mode)).map(page=>page.id),['a','b','c']);
});
test('month groups include the year and order chronologically with missing dates last',()=>{
  const newest=order('newest','month'), oldest=order('oldest','month');
  assert.deepEqual(newest.map(node=>node.label),['January 2026','December 2025','Undated']);
  assert.deepEqual(oldest.map(node=>node.label),['December 2025','January 2026','Undated']);
  assert.deepEqual(getPageOrder(newest),['b1','a1','a2','b2']);
  assert.deepEqual(getPageOrder(oldest),['a2','a1','b1','b2']);
});
test('month mode alphabetizes leaves within a chronological month projection',()=>{
  assert.deepEqual(getPageOrder(order('name-asc','month')),['b1','a1','a2','b2']);
  assert.deepEqual(order('name-desc','month').map(node=>node.id),['month:2026-01','month:2025-12','month:undated']);
});
test('month boundaries use UTC regardless of the source timestamp offset',()=>{
  assert.equal(monthKey(item('x','Boundary',Date.parse('2026-02-01T00:30:00+02:00'))),'2026-01');
  assert.equal(monthKey(item('x','Boundary',Date.parse('2025-12-31T23:30:00-02:00'))),'2026-01');
  assert.equal(monthLabel('2026-01'),'January 2026');
});
test('an explicit archive modified date supplies a source fallback; invalid dates stay unknown',()=>{
  const roots=new Map([['a',{...archives[0],modifiedAt:Date.UTC(2024,8,1)}]]);
  assert.equal(monthKey(item('x','Fallback',undefined),roots),'2024-09');
  assert.equal(monthKey(item('x','Invalid',NaN),archiveMap),'undated');
  assert.equal(monthKey(item('x','Invalid',Number.MAX_VALUE),archiveMap),'undated');
  assert.equal(monthKey(item('x','Epoch',0),archiveMap),'undated');
});
test('gallery grouping preserves canonical within-month order and undated-last grouping',()=>{
  const projected=getPageOrder(order('newest','month')).map(id=>itemMap.get(id)!);
  const groups=groupItemsByMonth(projected,archiveMap);
  assert.deepEqual(groups.flatMap(group=>group.items.map(page=>page.id)),projected.map(page=>page.id));
  assert.equal(groups.at(-1)?.label,'Undated');
});
test('folder view retains archive/source ancestor relationships while ordering descendants',()=>{
  const tree=order('newest','folders');
  assert.deepEqual(getAncestorIds(tree,'a1'),['a','a::folder::exports']);
  assert.deepEqual(getPageOrder(tree[1].children),['a1','a2']);
  assert.deepEqual(new Set(getPageOrder(tree)),new Set(items.map(page=>page.id)));
});
test('favorites, source-folder search, month grouping and navigation share identical canonical leaves',()=>{
  const organization=new Map<string,ItemOrganization>([['a1',{id:'a1',favorite:true,folderId:'keepers'}],['b1',{id:'b1',favorite:true,folderId:null}]]);
  const organized=buildOrganizedTree(archives,items,[{id:'keepers',name:'Keepers',createdAt:1}],organization,'html',true);
  const matched=filterTree(organized,'Keepers',itemMap);
  const projected=projectTree(matched,itemMap,{sort:'newest',group:'month'},archiveMap);
  assert.deepEqual(getPageOrder(projected),['a1']);
  assert.equal(projected[0].pageCount,1);
  assert.equal(organization.get('a1')?.folderId,'keepers');
});
test('all projections preserve original data, node identities and exactly one leaf per item',()=>{
  const original=base(), before=JSON.stringify({original,items,archives});
  for(const sort of ['name-asc','name-desc','newest','oldest'] as const)for(const group of ['folders','month','all'] as const){
    const result=projectTree(original,itemMap,{sort,group},archiveMap);
    assert.equal(new Set(getPageOrder(result)).size,items.length);
    assert.equal(getPageOrder(result).length,items.length);
  }
  assert.equal(JSON.stringify({original,items,archives}),before);
});
test('HTML and image kinds share grouping semantics without crossing tabs',()=>{
  const pictures=items.map(page=>({...page,id:`image:${page.id}`,kind:'image' as const}));
  const mixed=[...items,...pictures];const map=new Map(mixed.map(page=>[page.id,page]));
  for(const kind of ['html','image'] as const){
    const tree=projectTree(buildOrganizedTree(archives,mixed,[],new Map(),kind),map,{sort:'oldest',group:'month'},archiveMap);
    assert.deepEqual(getPageOrder(tree),items.map(page=>kind==='image'?`image:${page.id}`:page.id).sort((a,b)=>compareItems(map.get(a)!,map.get(b)!,'oldest')));
  }
});
test('saved ordering preferences validate stale values and keep the default folder view',()=>{
  assert.deepEqual(normalizeOrder(),DEFAULT_ORDER);
  assert.deepEqual(normalizeOrder({sort:'invalid',group:'invalid'} as never),DEFAULT_ORDER);
  assert.deepEqual(normalizeOrder({sort:'oldest',group:'month'}),{sort:'oldest',group:'month'});
});
test('sidebar width clamps support default, minimum, maximum, viewport and invalid preference values',()=>{
  assert.equal(clampSidebar(320,1440),320);
  assert.equal(clampSidebar(20,1440),260);
  assert.equal(clampSidebar(900,1440),600);
  assert.equal(clampSidebar(600,800),410);
  assert.equal(sidebarMax(651),261);
  assert.equal(clampSidebar(NaN,1440),320);
  assert.equal(clampSidebar(Infinity,1440),320);
  assert.equal(clampSidebar(300,320),260);
});
