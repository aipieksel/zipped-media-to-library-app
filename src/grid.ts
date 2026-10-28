export interface GridLayout {columns:number;rows:number}
export interface ResolvedGrid {columns:number;rows:number;capacity:number}
export const DEFAULT_GRID:GridLayout={columns:0,rows:0};
export const GRID_MAX=8;
export const GRID_GAP=8;
export const GRID_MIN_ROW_HEIGHT=72;
const choice=(value:unknown):number=>typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=GRID_MAX?value:0;
const positive=(value:number):number=>Number.isFinite(value)?Math.max(0,value):0;
/** Zero is Auto; saved explicit counts are retained on narrow or short canvases. */
export function normalizeGrid(value?:Partial<GridLayout>):GridLayout{return{columns:choice(value?.columns),rows:choice(value?.rows)};}
export function resolveGrid(layout:GridLayout,width:number,height:number):ResolvedGrid{
  const selected=normalizeGrid(layout),canvasWidth=positive(width),canvasHeight=positive(height);
  const columns=selected.columns||Math.min(GRID_MAX,Math.max(1,Math.floor(canvasWidth/188)));
  const cardWidth=Math.max(0,(canvasWidth-(columns-1)*GRID_GAP)/columns);
  const approximateHeight=Math.max(GRID_MIN_ROW_HEIGHT,cardWidth*11/16+56);
  const rows=selected.rows||Math.min(GRID_MAX,Math.max(1,Math.floor((canvasHeight+GRID_GAP)/(approximateHeight+GRID_GAP))));
  return{columns,rows,capacity:columns*rows};
}
const paginationNumbers=(total:number,capacity:number)=>({total:Number.isFinite(total)?Math.max(0,Math.floor(total)):0,capacity:Number.isFinite(capacity)?Math.min(64,Math.max(1,Math.floor(capacity))):1});
export function clampGridPage(page:number,total:number,capacity:number):number{
  const count=paginationNumbers(total,capacity),pageCount=Math.max(1,Math.ceil(count.total/count.capacity));
  return Math.min(pageCount-1,Math.max(0,Number.isFinite(page)?Math.floor(page):0));
}
export function gridPage(total:number,capacity:number,page:number):{page:number;pageCount:number;start:number;end:number}{
  const count=paginationNumbers(total,capacity),current=clampGridPage(page,count.total,count.capacity),start=current*count.capacity;
  return{page:current,pageCount:Math.max(1,Math.ceil(count.total/count.capacity)),start,end:Math.min(count.total,start+count.capacity)};
}
/** Explicit rows remain usable when their minimum height exceeds the available canvas. */
export function gridBodyHeight(rows:number,height:number):number{return Math.max(positive(height),rows*GRID_MIN_ROW_HEIGHT+Math.max(0,rows-1)*GRID_GAP);}

/** Shared filters invalidate both galleries, including the currently inactive tab. */
export function resetGridPages(pages:{html:number;image:number},scope:'all'|'image'):{html:number;image:number}{
  return scope==='all'?{html:0,image:0}:{html:pages.html,image:0};
}
