import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowUpRight, FileCode2, Image as ImageIcon, LoaderCircle, RotateCcw } from 'lucide-react';
import type { ArchiveMeta, GalleryThumbnail, HtmlPage, Snapshot } from '../types';
import { groupItemsByMonth } from '../order';
import { DEFAULT_GRID, gridBodyHeight, gridPage, normalizeGrid } from '../grid';
import type { GridLayout } from '../grid';
import { htmlThumbnailKey, htmlThumbnails } from '../html-thumbnails';
import type { HtmlThumbnailState } from '../html-thumbnails';
import { GridPager } from './GridPager';
import { useCanvasGrid } from './useCanvasGrid';
import './collection.css';

export interface GalleryProps {
  pages:HtmlPage[];
  archives:ArchiveMeta[];
  snapshots:Map<string,Snapshot>;
  query:string;
  onOpen:(id:string,mode:'live'|'snapshot')=>void;
  onCaptureMissing:()=>void;
  busy:boolean;
  groupByMonth?:boolean;
  grid?:GridLayout;
  page?:number;
  onPageChange?:(page:number)=>void;
}

function usePreviewUrl(blob:Blob|undefined):string|undefined{
  const [resource,setResource]=useState<{blob?:Blob;url?:string}>({});
  useEffect(()=>{
    if(!blob){setResource({});return;}
    const url=URL.createObjectURL(blob);setResource({blob,url});return()=>URL.revokeObjectURL(url);
  },[blob]);
  return resource.blob===blob?resource.url:undefined;
}

function useAutomaticThumbnail(page:HtmlPage,enabled:boolean):HtmlThumbnailState{
  const key=htmlThumbnailKey(page);
  const[state,setState]=useState<HtmlThumbnailState>({key,pageId:page.id,status:'idle'});
  useEffect(()=>{
    if(!enabled)return;
    let active=true;
    const release=htmlThumbnails.watch(page,next=>{if(active)setState(next);});
    return()=>{active=false;release();};
  },[key,enabled]);
  return state.key===key?state:{key,pageId:page.id,status:'idle'};
}

export function selectHtmlGalleryPreview(snapshot:Snapshot|undefined,thumbnail:GalleryThumbnail|undefined){
  return snapshot?{blob:snapshot.blob,width:snapshot.width,height:snapshot.height,manual:true}:
    thumbnail?{blob:thumbnail.blob,width:thumbnail.width,height:thumbnail.height,manual:false}:undefined;
}

function HtmlCard({page,snapshot,archive,busy,autoEnabled,onOpen}:{page:HtmlPage;snapshot?:Snapshot;archive:string;busy:boolean;autoEnabled:boolean;onOpen:GalleryProps['onOpen']}){
  const automatic=useAutomaticThumbnail(page,!snapshot&&autoEnabled);
  const preview=selectHtmlGalleryPreview(snapshot,automatic.thumbnail);
  const imageUrl=usePreviewUrl(preview?.blob);
  const location=`${archive} / ${page.path}`;
  const pending=automatic.status==='preparing'||automatic.status==='capturing';
  const failed=!preview&&automatic.status==='error';
  const label=preview?(preview.manual?'Saved screenshot':'Automatic preview'):
    failed?'Preview unavailable':busy?'Preview paused':pending?'Building preview…':'Preview queued';
  const openMode=preview?.manual?'snapshot':'live';
  return <article className="folio-gallery-card" data-html-page-id={page.id} data-preview-source={preview?.manual?'manual':preview?'automatic':automatic.status}>
    <button type="button" className="folio-gallery-preview" aria-label={`${preview?.manual?'View screenshot of':'Open HTML for'} ${page.label}`} onClick={()=>onOpen(page.id,openMode)}>
      {imageUrl?<img src={imageUrl} alt={`${preview?.manual?'Saved screenshot':'Automatic preview'} of ${page.label}`} loading="lazy" decoding="async"/>:
        <span className="folio-gallery-preview-state" title={automatic.error??label}>
          {failed?<AlertCircle size={18} aria-hidden="true"/>:pending&&!busy?<LoaderCircle className="spin" size={18} aria-hidden="true"/>:<FileCode2 size={20} strokeWidth={1.4} aria-hidden="true"/>}<span>{label}</span>
        </span>}
      {imageUrl&&<span className="folio-gallery-preview-hint"><ImageIcon size={14} aria-hidden="true"/>{preview?.manual?'View screenshot':'Open HTML'}</span>}
    </button>
    <div className="folio-gallery-card-body">
      <div className="folio-gallery-card-title"><FileCode2 size={13} aria-hidden="true"/><h3 title={page.label}>{page.label}</h3></div>
      <p className="folio-gallery-breadcrumb" title={location}>{location}</p>
      <div className="folio-gallery-card-footer">
        <span className="folio-gallery-dimensions" title={automatic.error??label}>{label}</span>
        {failed&&<button type="button" className="folio-gallery-retry" aria-label={`Retry preview for ${page.label}`} disabled={busy} onClick={()=>htmlThumbnails.retry(page)}><RotateCcw size={11} aria-hidden="true"/><span>Retry</span></button>}
        <button type="button" className="folio-gallery-open" aria-label={`Open HTML for ${page.label}`} onClick={()=>onOpen(page.id,'live')}><span>HTML</span><ArrowUpRight size={12} aria-hidden="true"/></button>
      </div>
    </div>
  </article>;
}

export function Gallery({pages,archives,snapshots,query,onOpen,busy,groupByMonth=false,grid=DEFAULT_GRID,page,onPageChange}:GalleryProps){
  const layout=normalizeGrid(grid);
  const {ref,resolved,width,height}=useCanvasGrid(layout);
  const[localPage,setLocalPage]=useState(0);
  const requestedPage=page??localPage;
  const paging=gridPage(pages.length,resolved.capacity,requestedPage);
  const changePage=onPageChange??setLocalPage;
  const archiveMap=useMemo(()=>new Map(archives.map(archive=>[archive.id,archive])),[archives]);
  const visiblePages=pages.slice(paging.start,paging.end);
  const saved=visiblePages.filter(item=>snapshots.has(item.id)).length;
  const monthLabel=groupByMonth?groupItemsByMonth(visiblePages,archiveMap).map(group=>`${group.label} · ${group.items.length.toLocaleString()}`).join('  /  '):'';
  const signature=useMemo(()=>JSON.stringify([layout.columns,layout.rows,groupByMonth,pages.map(item=>item.id)]),[pages,layout.columns,layout.rows,groupByMonth]);
  const previousSignature=useRef(signature);
  useEffect(()=>{if(previousSignature.current!==signature){previousSignature.current=signature;if(page===undefined)setLocalPage(0);}},[signature,page]);
  useEffect(()=>{if(requestedPage!==paging.page)changePage(paging.page);},[requestedPage,paging.page,changePage]);
  useLayoutEffect(()=>{htmlThumbnails.setPaused(busy);},[busy]);
  useEffect(()=>()=>{htmlThumbnails.setPaused(false);},[]);

  return <section className="folio-gallery is-canvas" aria-label="HTML preview gallery" data-grid-columns={resolved.columns} data-grid-rows={resolved.rows} data-grid-capacity={resolved.capacity}>
    <header className="folio-gallery-canvas-header"><p>{pages.length.toLocaleString()} HTML {pages.length===1?'page':'pages'}<span> · {saved} saved {saved===1?'screenshot':'screenshots'} on this page</span></p><span title="Automatic previews are generated one at a time for this canvas page only.">{busy?'Previews paused':'Auto previews'}</span></header>
    {groupByMonth&&<div className="folio-gallery-canvas-months" title={monthLabel} aria-label="Months on this page">{monthLabel||'No HTML pages in this view'}</div>}
    <div ref={ref} className="folio-gallery-canvas-body">
      {pages.length?<div className="folio-gallery-canvas-grid" style={{height:gridBodyHeight(resolved.rows,height),gridTemplateColumns:`repeat(${resolved.columns},minmax(0,1fr))`,gridTemplateRows:`repeat(${resolved.rows},minmax(0,1fr))`}} data-total-html-pages={pages.length} data-visible-html-pages={visiblePages.length}>
        {visiblePages.map(item=><HtmlCard key={item.id} page={item} snapshot={snapshots.get(item.id)} archive={archiveMap.get(item.archiveId)?.name??'Archive'} busy={busy} autoEnabled={width>0&&height>0} onOpen={onOpen}/>)}
      </div>:<div className="folio-gallery-empty"><span className="folio-gallery-empty-icon"><ImageIcon size={26} strokeWidth={1.4} aria-hidden="true"/></span><h3>No HTML pages in this view</h3><p>{query.trim()?`No HTML pages match “${query.trim()}”. Try another filename or clear the search.`:'Import a ZIP or adjust the current filters to browse HTML previews.'}</p></div>}
    </div>
    <GridPager page={paging.page} pageCount={paging.pageCount} total={pages.length} columns={resolved.columns} rows={resolved.rows} onPageChange={changePage}/>
  </section>;
}
