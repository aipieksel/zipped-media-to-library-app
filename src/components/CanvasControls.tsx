import type {GridLayout} from '../grid';
import type {ImageShape} from '../image-dimensions';
import type {SortOrder} from '../order';
import type {ItemKind} from '../types';
import {PopoverSelect} from './PopoverSelect';

const gridOptions = [{value:0,label:'Auto'},...Array.from({length:8},(_,index)=>({value:index+1,label:String(index+1)}))];
const shapeOptions = [{value:'all',label:'All images'},{value:'landscape',label:'Landscape'},{value:'portrait',label:'Portrait'},{value:'square',label:'Square'},{value:'unknown',label:'Unknown dimensions'}];
const sortOptions = [{value:'name-asc',label:'Name A–Z'},{value:'name-desc',label:'Name Z–A'},{value:'newest',label:'Newest first'},{value:'oldest',label:'Oldest first'}];
const imageSortOptions = [...sortOptions,{value:'largest',label:'Largest dimensions'},{value:'smallest',label:'Smallest dimensions'}];

export interface CanvasControlsProps {
  kind:ItemKind;grid:GridLayout;shape:ImageShape;sort:SortOrder;
  onGridChange:(grid:GridLayout)=>void;onShapeChange:(shape:ImageShape)=>void;onSortChange:(sort:SortOrder)=>void;
}
export function CanvasControls({kind,grid,shape,sort,onGridChange,onShapeChange,onSortChange}:CanvasControlsProps){
  return <div className="canvas-controls" role="group" aria-label="Canvas gallery controls">
    <label>Columns<PopoverSelect aria-label="Gallery columns" value={grid.columns} onValueChange={value=>onGridChange({...grid,columns:Number(value)})} options={gridOptions}/></label>
    <span className="canvas-grid-by" aria-hidden="true">×</span>
    <label>Rows<PopoverSelect aria-label="Gallery rows" value={grid.rows} onValueChange={value=>onGridChange({...grid,rows:Number(value)})} options={gridOptions}/></label>
    {kind==='image'&&<label>Shape<PopoverSelect aria-label="Image shape" value={shape} onValueChange={value=>onShapeChange(value as ImageShape)} options={shapeOptions}/></label>}
    <label>Sort<PopoverSelect aria-label="Canvas sort order" value={sort} onValueChange={value=>onSortChange(value as SortOrder)} options={kind==='image'?imageSortOptions:sortOptions}/></label>
  </div>;
}
