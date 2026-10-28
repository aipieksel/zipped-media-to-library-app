import test from 'node:test';
import assert from 'node:assert/strict';
import {dateDescription,itemDateInfo,treeDateMetadata,validTimestamp} from '../src/metadata';
import {buildOrganizedTree,getPageOrder} from '../src/tree';
import {projectTree,monthKey} from '../src/order';
import {firstFolderPage,hasFavoriteFolder,normalizeFolderFavorites,removeArchiveFolderFavorites} from '../src/folder-favorites';
import type {ArchiveMeta,HtmlPage} from '../src/types';
const added=Date.parse('2026-10-27T12:00:00Z');
const archive=(id:string):ArchiveMeta=>({id,rootId:id,parentId:null,mountPath:'',name:id,createdAt:added,fileCount:5,pageCount:3,imageCount:2,byteSize:10,warnings:[]});
const item=(id:string,archiveId='a',modifiedAt?:number,kind:'html'|'image'='html'):HtmlPage=>({id:`${archiveId}/${id}`,archiveId,rootId:archiveId,path:id,label:id,isIndex:/index.html$/.test(id),size:1,kind,modifiedAt});
const roots=new Map([['a',archive('a')]]);

test('legacy imports use an honest Added date and remain sortable/month-groupable without source timestamps',()=>{
  const page=item('legacy.html');const info=itemDateInfo(page,roots)!;
  assert.deepEqual(info,{timestamp:added,kind:'added',label:'Added'});
  assert.equal(monthKey(page,roots),'2026-10');
  assert.match(dateDescription(info),/^Added: 27 Oct 2026 \(UTC\)$/);
  assert.equal(page.modifiedAt,undefined);assert.equal(page.createdAt,undefined);
});
test('real modified dates take precedence over creation, source archive and added timestamps',()=>{
  const stamp=Date.parse('2026-05-01T12:00:00Z');
  const page={...item('dated.html','a',stamp),createdAt:stamp-1000,addedAt:added};
  const info=itemDateInfo(page,new Map([['a',{...archive('a'),modifiedAt:stamp+1000}]]))!;
  assert.equal(info.timestamp,stamp);assert.equal(info.kind,'modified');assert.equal(info.label,'Modified');
});
test('source creation is used only when actually present; it is never inferred from the import date',()=>{
  const createdAt=Date.parse('2026-06-01T12:00:00Z');
  assert.deepEqual(itemDateInfo({...item('created.html'),createdAt},roots),{timestamp:createdAt,kind:'created',label:'Created'});
  assert.equal(itemDateInfo(item('legacy.html'),roots)?.kind,'added');
});
test('source-library and imported-ZIP fallback dates retain explicit provenance',()=>{
  const page=item('source.html','a',123456789);
  assert.equal(itemDateInfo({...page,dateSource:'library'},roots)?.label,'Source updated');
  assert.equal(itemDateInfo({...page,dateSource:'imported'},roots)?.label,'Source file updated');
  const info=itemDateInfo({...page,modifiedAt:undefined},new Map([['a',{...archive('a'),modifiedAt:456789012}]]))!;
  assert.deepEqual(info,{timestamp:456789012,kind:'source',label:'Archive updated'});
});
test('invalid timestamps fall through to known metadata and truly dateless records stay unavailable',()=>{
  for(const invalid of [NaN,Infinity,Number.MAX_SAFE_INTEGER,-1,0,1.5]){
    assert.equal(validTimestamp(invalid),false);
    assert.equal(itemDateInfo(item('invalid.html','a',invalid),roots)?.kind,'added');
  }
  assert.equal(itemDateInfo(item('unknown.html')),undefined);
  assert.equal(dateDescription(undefined),'Date unavailable');
});
test('a per-file Added timestamp takes precedence over the archive import time',()=>{
  assert.equal(itemDateInfo({...item('new.png'),addedAt:added+1000},roots)?.timestamp,added+1000);
});
test('folder date is its newest descendant in either sort direction; file order inside stays independently correct',()=>{
  const archives=[archive('a'),archive('b')],map=new Map(archives.map(a=>[a.id,a]));
  const items=[item('old.html','a',100),item('new.html','a',300),item('middle.html','b',200)];
  const pages=new Map(items.map(p=>[p.id,p]));const base=buildOrganizedTree(archives,items,[],new Map(),'html');
  assert.deepEqual(projectTree(base,pages,{sort:'newest',group:'folders'},map).map(n=>n.id),['a','b']);
  assert.deepEqual(projectTree(base,pages,{sort:'oldest',group:'folders'},map).map(n=>n.id),['b','a']);
  const dates=treeDateMetadata(base,pages,map);assert.equal(dates.get('a')?.timestamp,300);assert.equal(dates.get('a')?.label,'Latest file · Modified');
  assert.deepEqual(getPageOrder(projectTree(base,pages,{sort:'oldest',group:'folders'},map)),['b/middle.html','a/old.html','a/new.html']);
});
test('empty custom folder metadata uses its real creation/added timestamp',()=>{
  const folders=[{id:'custom',name:'Later',createdAt:added}];
  const tree=buildOrganizedTree([],[],folders,new Map(),'html');
  assert.equal(treeDateMetadata(tree,new Map(),new Map(),new Map(folders.map(f=>[f.id,f]))).get('custom')?.timestamp,added);
});
test('folder preview chooses the first current sorted descendant, including nested paths and compact aliases',()=>{
  const archives=[archive('a')];const items=[item('nested/z.html','a',300),item('nested/a.html','a',100),item('single/index.html','a',200)];
  const map=new Map(items.map(p=>[p.id,p]));const base=buildOrganizedTree(archives,items,[],new Map(),'html');
  const tree=projectTree(base,map,{sort:'newest',group:'folders'},roots);
  assert.equal(firstFolderPage(tree,'a'),'a/nested/z.html');
  assert.equal(firstFolderPage(tree,'a::folder::nested'),'a/nested/z.html');
  assert.equal(firstFolderPage(tree,'a::folder::single'),'a/single/index.html');
  assert.equal(firstFolderPage(tree,'missing'),undefined);
  const oldest=projectTree(base,map,{sort:'oldest',group:'folders'},roots);
  assert.equal(firstFolderPage(oldest,'a::folder::nested'),'a/nested/a.html');
});
test('empty folders and filtered-out targets do not produce an unrelated preview target',()=>{
  const tree=buildOrganizedTree([],[],[{id:'empty',name:'Empty',createdAt:1}],new Map(),'image');
  assert.equal(firstFolderPage(tree,'empty'),undefined);assert.equal(firstFolderPage(tree,'missing'),undefined);
});
test('folder favorite validation accepts exact live identities and aliases in either kind, rejecting pages and synthetic groups',()=>{
  const archives=[archive('a')];const pages=[item('single/index.html'),item('images/a.png','a',1,'image')];const folders=[{id:'custom',name:'Custom',createdAt:1}];
  for(const id of ['a','a::folder::single','a::folder::images','custom'])assert.equal(hasFavoriteFolder(id,archives,pages,folders,new Map()),true,id);
  for(const id of ['a/single/index.html','a::folder::missing','month:2026-10','a/something'])assert.equal(hasFavoriteFolder(id,archives,pages,folders,new Map()),false,id);
});
test('favorite-folder preference survives structured cloning and removes only the deleted archive graph',()=>{
  const pref=['a','a::folder::real','ab::folder::keep','custom','a',null,5,''];
  const normalized=normalizeFolderFavorites(pref);assert.deepEqual([...normalized],['a','a::folder::real','ab::folder::keep','custom']);
  assert.deepEqual([...normalizeFolderFavorites(structuredClone([...normalized]))],[...normalized]);
  assert.deepEqual(removeArchiveFolderFavorites([...normalized],['a']),['ab::folder::keep','custom']);
});

test('an actual file creation date precedes a fallback from Library or the containing ZIP',()=>{
  for(const dateSource of ['library','imported'] as const){
    const page={...item('created.html','a',Date.parse('2026-10-27T00:00:00Z')),dateSource,createdAt:Date.parse('2026-05-03T00:00:00Z')};
    assert.deepEqual(itemDateInfo(page,roots),{timestamp:page.createdAt,kind:'created',label:'Created'});
  }
});
