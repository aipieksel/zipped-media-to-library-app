import {useEffect,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import './images.css';
export interface GridPagerProps {page:number;pageCount:number;total:number;columns:number;rows:number;onPageChange:(page:number)=>void}
export function GridPager({page,pageCount,total,columns,rows,onPageChange}:GridPagerProps){
  const [draft,setDraft]=useState(String(page+1));
  useEffect(()=>setDraft(String(page+1)),[page,pageCount]);
  const commit=()=>{const number=Number(draft),next=Number.isFinite(number)&&draft.trim()?Math.max(0,Math.min(pageCount-1,Math.floor(number)-1)):page;setDraft(String(next+1));if(next!==page)onPageChange(next);};
  return <footer className="folio-grid-pager" aria-label="Gallery pages">
    <span className="folio-grid-summary" title={`${columns} columns × ${rows} rows · ${total.toLocaleString()} files`}>{columns} × {rows}<span> · {total.toLocaleString()} files</span></span>
    <div className="folio-grid-page-controls">
      <button type="button" className="icon-button tiny" aria-label="Previous gallery page" title="Previous gallery page" disabled={page<=0} onClick={()=>onPageChange(Math.max(0,page-1))}><ChevronLeft size={15}/></button>
      <label className="folio-grid-page-input"><span className="folio-grid-page-label">Page</span><input type="number" min={1} max={pageCount} value={draft} aria-label="Gallery page" disabled={!total} onChange={event=>setDraft(event.target.value)} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();commit();}if(event.key==='Escape'){event.preventDefault();setDraft(String(page+1));}}}/><span>/ {pageCount.toLocaleString()}</span></label>
      <button type="button" className="icon-button tiny" aria-label="Next gallery page" title="Next gallery page" disabled={page>=pageCount-1} onClick={()=>onPageChange(Math.min(pageCount-1,page+1))}><ChevronRight size={15}/></button>
    </div>
  </footer>;
}
