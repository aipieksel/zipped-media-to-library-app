import type {GridLayout} from '../grid';
import type {ImageShape} from '../image-dimensions';
import type {SortOrder} from '../order';
import type {ItemKind} from '../types';

export interface CanvasControlsProps {
  kind:ItemKind;grid:GridLayout;shape:ImageShape;sort:SortOrder;
  onGridChange:(grid:GridLayout)=>void;onShapeChange:(shape:ImageShape)=>void;onSortChange:(sort:SortOrder)=>void;
}
export function CanvasControls({kind,grid,shape,sort,onGridChange,onShapeChange,onSortChange}:CanvasControlsProps){
  return <div className="canvas-controls" role="group" aria-label="Canvas gallery controls">
    <label>Columns<select aria-label="Gallery columns" value={grid.columns} onChange={event=>onGridChange({...grid,columns:Number(event.target.value)})}><option value={0}>Auto</option>{Array.from({length:8},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
    <span className="canvas-grid-by" aria-hidden="true">×</span>
    <label>Rows<select aria-label="Gallery rows" value={grid.rows} onChange={event=>onGridChange({...grid,rows:Number(event.target.value)})}><option value={0}>Auto</option>{Array.from({length:8},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
    {kind==='image'&&<label>Shape<select aria-label="Image shape" value={shape} onChange={event=>onShapeChange(event.target.value as ImageShape)}><option value="all">All images</option><option value="landscape">Landscape</option><option value="portrait">Portrait</option><option value="square">Square</option><option value="unknown">Unknown dimensions</option></select></label>}
    <label>Sort<select aria-label="Canvas sort order" value={sort} onChange={event=>onSortChange(event.target.value as SortOrder)}><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option>{kind==='image'&&<><option value="largest">Largest dimensions</option><option value="smallest">Smallest dimensions</option></>}</select></label>
  </div>;
}
