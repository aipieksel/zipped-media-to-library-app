import test from 'node:test';
import assert from 'node:assert/strict';
import {flattenVisibleTree,treeWindow,treeRowScroll,TREE_ROW_HEIGHT,TREE_WINDOW_THRESHOLD} from '../src/tree-window';
import type {TreeNode} from '../src/types';
const leaf=(id:string):TreeNode=>({id,pageId:id,archiveId:'cloud-root',label:id,kind:'page',children:[],pageCount:1});
const branch=(id:string,children:TreeNode[]):TreeNode=>({id,archiveId:'cloud-root',label:id,kind:'folder',children,pageCount:children.reduce((sum,node)=>sum+node.pageCount,0)});
const fixture=[branch('root',[leaf('one'),branch('nested',[leaf('two'),leaf('three')])]),branch('other',[leaf('four')])];

test('visible tree flattening retains branch levels, parents and complete sibling ARIA positions',()=>{
  const rows=flattenVisibleTree(fixture,new Set(['root','nested']));
  assert.deepEqual(rows.map(row=>[row.node.id,row.level,row.parentId,row.position,row.setSize,row.open]),[
    ['root',1,null,1,2,true],['one',2,'root',1,2,false],['nested',2,'root',2,2,true],['two',3,'nested',1,2,false],['three',3,'nested',2,2,false],['other',1,null,2,2,false]
  ]);
  assert.equal(rows[3].node,fixture[0].children[1].children[0]);
});
test('collapsed branches omit descendants, while search forces matching projection branches open',()=>{
  assert.deepEqual(flattenVisibleTree(fixture,new Set()).map(row=>row.node.id),['root','other']);
  assert.deepEqual(flattenVisibleTree(fixture,new Set(),true).map(row=>row.node.id),['root','one','nested','two','three','other','four']);
});
test('flattening never changes canonical IDs, child order or node metadata',()=>{
  const before=JSON.stringify(fixture);flattenVisibleTree(fixture,new Set(['root','nested','other']));assert.equal(JSON.stringify(fixture),before);
});
test('month and all-file projections containing 12707 leaves mount a bounded row window',()=>{
  const pages=Array.from({length:12707},(_,index)=>leaf(`image-${index}`));
  for(const nodes of [pages,[branch('month:2026-10',pages)]]){
    const rows=flattenVisibleTree(nodes,new Set(['month:2026-10']));assert.ok(rows.length>TREE_WINDOW_THRESHOLD);
    for(const top of [0,100000,rows.length*TREE_ROW_HEIGHT]){
      const view=treeWindow(rows.length,top,600);
      assert.ok(view.end-view.start<=Math.ceil(600/TREE_ROW_HEIGHT)+16);
      assert.ok(view.end<=rows.length);assert.ok(view.start>=0);
      assert.equal(view.height,rows.length*28);
    }
  }
});
test('stale scroll positions after filtering clamp to a real final window',()=>{
  const view=treeWindow(300,400000,560);
  assert.equal(view.end,300);assert.ok(view.start<300);
  assert.deepEqual(treeWindow(0,900,560),{start:0,end:0,height:0});
});
test('selected and focused rows can be revealed before they are mounted without overscrolling visible rows',()=>{
  assert.equal(treeRowScroll(0,200,560),0);
  assert.equal(treeRowScroll(10000,0,560),10001*28-560);
  const top=treeRowScroll(10000,0,560),view=treeWindow(12707,top,560);
  assert.ok(10000>=view.start&&10000<view.end);
  assert.equal(treeRowScroll(10,0,560),0);
  assert.equal(treeRowScroll(10,280,560),280);
});
