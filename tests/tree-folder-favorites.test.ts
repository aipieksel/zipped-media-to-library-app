import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOrganizedTree,favoriteFolderId,filterTree,getAncestorIds,getPageOrder} from '../src/tree';
import type {ArchiveMeta,HtmlPage,ItemOrganization,TreeNode,WorkspaceFolder} from '../src/types';
const archives:ArchiveMeta[]=[
  {id:'root',rootId:'root',parentId:null,mountPath:'',name:'Root',createdAt:1,fileCount:6,pageCount:3,byteSize:6,warnings:[]},
  {id:'child',rootId:'root',parentId:'root',mountPath:'packs/child.zip',name:'Child',createdAt:1,fileCount:2,pageCount:1,byteSize:2,warnings:[]},
  {id:'other',rootId:'other',parentId:null,mountPath:'',name:'Other',createdAt:1,fileCount:1,pageCount:1,byteSize:1,warnings:[]},
];
const item=(id:string,path:string,kind:'html'|'image'='html',archiveId='root',isIndex=false):HtmlPage=>({id,path,label:path.split('/').at(-1)!,archiveId,rootId:archiveId==='child'?'root':archiveId,kind,isIndex,size:1});
const items=[item('home','index.html','html','root',true),item('landing','landing/index.html','html','root',true),item('moved','articles/story.html'),item('nested','detail.html','html','child'),item('other-page','other.html','html','other'),item('image-one','pictures/one.png','image'),item('image-two','pictures/deeper/two.png','image'),item('moved-image','moved.png','image')];
const folders:WorkspaceFolder[]=[{id:'keepers',name:'Keepers',createdAt:1},{id:'empty',name:'Empty',createdAt:1}];
const organization=new Map<string,ItemOrganization>([['moved',{id:'moved',favorite:false,folderId:'keepers'}],['moved-image',{id:'moved-image',favorite:false,folderId:'keepers'}],['other-page',{id:'other-page',favorite:true,folderId:null}]]);
const favorites=(kind:'html'|'image',ids:string[],org=organization,entries=items)=>buildOrganizedTree(archives,entries,folders,org,kind,true,new Set(ids));
const find=(nodes:TreeNode[],id:string):TreeNode|undefined=>{for(const node of nodes){if(node.id===id)return node;const child=find(node.children,id);if(child)return child;}return undefined;};

test('source archive favorites inherit nested current-kind membership without changing file stars',()=>{
  const before=JSON.stringify([...organization]);
  const html=favorites('html',['root']);
  assert.deepEqual(new Set(getPageOrder(html)),new Set(['home','landing','nested','other-page']));
  assert.ok(!getPageOrder(html).includes('moved'));
  assert.equal(find(html,'root')?.pageCount,3);
  assert.equal(JSON.stringify([...organization]),before);
});
test('raw folder favorite includes nested images but excludes unrelated and moved files',()=>{
  const image=favorites('image',['root::folder::pictures']);
  assert.deepEqual(getPageOrder(image),['image-two','image-one']);
  assert.equal(find(image,'root::folder::pictures')?.pageCount,2);
  assert.deepEqual(getAncestorIds(image,'image-two'),['root','root::folder::pictures','root::folder::pictures/deeper']);
});
test('custom folder favorites include both kinds independently and track current moves',()=>{
  assert.deepEqual(getPageOrder(favorites('html',['keepers'])),['moved','other-page']);
  assert.deepEqual(getPageOrder(favorites('image',['keepers'])),['moved-image']);
  const movedOut=new Map(organization);movedOut.set('moved-image',{id:'moved-image',favorite:false,folderId:null});
  assert.deepEqual(getPageOrder(favorites('image',['keepers'],movedOut)),[]);
  const movedIn=new Map(movedOut);movedIn.set('image-one',{id:'image-one',favorite:false,folderId:'keepers'});
  assert.deepEqual(getPageOrder(favorites('image',['keepers'],movedIn)),['image-one']);
});
test('unstarred empty custom folders disappear from Favorites while starred empty folders remain',()=>{
  assert.equal(find(favorites('image',[]),'empty'),undefined);
  assert.equal(find(favorites('image',['empty']),'empty')?.pageCount,0);
  assert.equal(find(favorites('image',[]),'keepers'),undefined);
  assert.equal(find(buildOrganizedTree(archives,items,folders,organization,'image'),'empty')?.pageCount,0);
});
test('compact index folder aliases keep their source identity and can be favorited independently',()=>{
  const full=buildOrganizedTree(archives,items,folders,organization,'html');
  const landing=find(full,'landing')!;
  assert.equal(landing.kind,'page');assert.equal(landing.label,'landing');assert.equal(landing.sourceFolderId,'root::folder::landing');
  assert.equal(favoriteFolderId(landing),'root::folder::landing');
  assert.deepEqual(getPageOrder(favorites('html',['root::folder::landing'])),['landing','other-page']);
  assert.equal(items.find(page=>page.id==='landing')?.path,'landing/index.html');
});
test('removing inherited membership leaves direct file favorites intact and does not duplicate leaves',()=>{
  const org=new Map(organization);org.set('image-one',{id:'image-one',favorite:true,folderId:null});
  assert.deepEqual(new Set(getPageOrder(favorites('image',['root::folder::pictures'],org))),new Set(['image-one','image-two']));
  assert.deepEqual(getPageOrder(favorites('image',[],org)),['image-one']);
  const projected=favorites('html',['root','child','root::folder::landing','keepers'],org);
  assert.equal(new Set(getPageOrder(projected)).size,getPageOrder(projected).length);
});
test('nested archive favorites preserve ancestors, search and canonical navigation leaves',()=>{
  const projected=favorites('html',['child']);
  assert.equal(find(projected,'root')?.pageCount,1);
  assert.deepEqual(getPageOrder(filterTree(projected,'Child',new Map(items.map(page=>[page.id,page])))),['nested']);
  assert.deepEqual(getAncestorIds(projected,'nested'),['root','root::folder::packs','child']);
});
test('synthetic months and ordinary files have no folder favorite identity',()=>{
  assert.equal(favoriteFolderId({id:'month:2026-10',archiveId:'',label:'October 2026',kind:'collection',children:[],pageCount:0}),undefined);
  assert.equal(favoriteFolderId({id:'plain',pageId:'plain',archiveId:'root',label:'Plain',kind:'page',children:[],pageCount:1}),undefined);
  assert.equal(favoriteFolderId({id:'keepers',folderId:'keepers',archiveId:'',label:'Keepers',kind:'collection',children:[],pageCount:0}),'keepers');
});
test('new items in a starred folder inherit membership without rewriting organization or metadata',()=>{
  const extra=item('image-three','pictures/new.png','image'),before=JSON.stringify({items,archives,organization:[...organization]});
  const projected=favorites('image',['root::folder::pictures'],organization,[...items,extra]);
  assert.ok(getPageOrder(projected).includes('image-three'));
  assert.equal(JSON.stringify({items,archives,organization:[...organization]}),before);
});
