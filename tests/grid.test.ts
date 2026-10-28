import test from 'node:test';
import assert from 'node:assert/strict';
import {clampGridPage,DEFAULT_GRID,GRID_GAP,GRID_MIN_ROW_HEIGHT,gridBodyHeight,gridPage,normalizeGrid,resetGridPages,resolveGrid} from '../src/grid';

test('grid settings normalize stale preferences and retain every valid explicit axis',()=>{
  assert.deepEqual(normalizeGrid(),DEFAULT_GRID);
  assert.deepEqual(normalizeGrid({columns:9,rows:-1}),DEFAULT_GRID);
  assert.deepEqual(normalizeGrid({columns:2.5,rows:NaN}),DEFAULT_GRID);
  for(let columns=0;columns<=8;columns++)for(let rows=0;rows<=8;rows++)assert.deepEqual(normalizeGrid({columns,rows}),{columns,rows});
});
test('explicit N by M counts survive phone widths and short canvases exactly',()=>{
  for(let columns=1;columns<=8;columns++)for(let rows=1;rows<=8;rows++)for(const [width,height]of [[280,180],[800,600],[2000,1400]]){
    assert.deepEqual(resolveGrid({columns,rows},width,height),{columns,rows,capacity:columns*rows});
  }
});
test('automatic axes resolve independently, remain bounded and respond to sidebar/body resizing',()=>{
  assert.equal(resolveGrid(DEFAULT_GRID,376,600).columns,2);
  assert.equal(resolveGrid(DEFAULT_GRID,375,600).columns,1);
  assert.equal(resolveGrid(DEFAULT_GRID,1504,600).columns,8);
  assert.equal(resolveGrid({columns:0,rows:3},280,120).rows,3);
  assert.equal(resolveGrid({columns:3,rows:0},280,600).columns,3);
  assert.ok(resolveGrid({columns:2,rows:0},800,800).rows>resolveGrid({columns:2,rows:0},800,400).rows);
  for(const [width,height]of [[0,0],[-1,-1],[NaN,Infinity],[100000,100000]]){
    const grid=resolveGrid(DEFAULT_GRID,width,height);
    assert.ok(grid.columns>=1&&grid.columns<=8);assert.ok(grid.rows>=1&&grid.rows<=8);assert.ok(grid.capacity<=64);
  }
});
test('Auto rows account for gaps and do not overflow their canvas when a minimum row fits',()=>{
  for(const width of [280,500,900,1600])for(const height of [72,160,320,576,900]){
    const grid=resolveGrid(DEFAULT_GRID,width,height);
    assert.ok(grid.rows*GRID_MIN_ROW_HEIGHT+(grid.rows-1)*GRID_GAP<=height,`${width}×${height} => ${grid.rows} rows`);
  }
});
test('short explicit canvases scroll the minimum row height without changing capacity',()=>{
  const grid=resolveGrid({columns:8,rows:8},280,180);
  assert.equal(gridBodyHeight(grid.rows,180),632);
  assert.equal(gridBodyHeight(2,700),700);
  assert.equal(grid.capacity,64);
});
test('pagination slices have exact capacity, include the final partial page and clamp stale pages',()=>{
  assert.deepEqual(gridPage(12707,64,0),{page:0,pageCount:199,start:0,end:64});
  assert.deepEqual(gridPage(12707,64,198),{page:198,pageCount:199,start:12672,end:12707});
  assert.deepEqual(gridPage(12707,64,999),gridPage(12707,64,198));
  assert.equal(clampGridPage(198,3,64),0);
  assert.equal(clampGridPage(-1,12707,64),0);
  assert.deepEqual(gridPage(0,8,50),{page:0,pageCount:1,start:0,end:0});
});
test('all canonical items appear once across pages for every selectable grid capacity',()=>{
  const items=Array.from({length:2572},(_,index)=>`page-${index}`);
  for(let columns=1;columns<=8;columns++)for(let rows=1;rows<=8;rows++){
    const capacity=columns*rows,collected:string[]=[];
    for(let page=0;page<gridPage(items.length,capacity,0).pageCount;page++){
      const slice=gridPage(items.length,capacity,page);collected.push(...items.slice(slice.start,slice.end));
    }
    assert.deepEqual(collected,items);
  }
});
test('malformed page, total and capacity input cannot create an unbounded card page',()=>{
  for(const [total,capacity,page]of [[NaN,0,Infinity],[10,999,3],[10,-1,NaN],[10,Infinity,-1]]){
    const slice=gridPage(total,capacity,page);assert.ok(slice.end-slice.start<=64);assert.ok(slice.start>=0);assert.ok(slice.end>=slice.start);assert.ok(slice.pageCount>=1);
  }
});


test('shared query/favorite filters reset inactive gallery pages while image-only shape changes preserve HTML',()=>{
  const pages={html:12,image:197};
  assert.deepEqual(resetGridPages(pages,'all'),{html:0,image:0});
  assert.deepEqual(resetGridPages(pages,'image'),{html:12,image:0});
  assert.deepEqual(pages,{html:12,image:197});
  assert.deepEqual(resetGridPages({html:0,image:197},'all'),{html:0,image:0});
  assert.deepEqual(resetGridPages({html:12,image:0},'all'),{html:0,image:0});
});
