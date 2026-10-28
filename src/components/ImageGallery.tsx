import {useEffect,useMemo,useRef,useState} from 'react';
import {AlertCircle,Image as ImageIcon,Star} from 'lucide-react';
import type {ArchiveMeta,HtmlPage,ItemOrganization} from '../types';
import {rememberDecodedImage} from '../image-cache';
import {groupItemsByMonth} from '../order';
import {isCloudArchive} from '../cloud';
import {imageDimensions,recordImageDimensions} from '../image-dimensions';
import {DEFAULT_GRID,gridBodyHeight,gridPage,normalizeGrid} from '../grid';
import type {GridLayout} from '../grid';
import {imageBytes,useImageResource} from './ImageViewer';
import {useCanvasGrid} from './useCanvasGrid';
import {GridPager} from './GridPager';
import './images.css';

export interface ImageGalleryProps {
  items:HtmlPage[];
  archives:ArchiveMeta[];
  organization:ReadonlyMap<string,ItemOrganization>;
  groupByMonth?:boolean;
  grid?:GridLayout;
  page?:number;
  onPageChange?:(page:number)=>void;
  onOpen:(id:string)=>void;
  onFavorite:(id:string)=>void;
}

/** A displayed thumbnail's natural size must never become its original size. */
export function originalDimensionsForImageLoad(item:HtmlPage,resource:{width?:number;height?:number;original?:boolean},naturalWidth:number,naturalHeight:number):{width:number;height:number}|undefined{
  const valid=(value:number|undefined):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0&&value<=65536;
  if(valid(resource.width)&&valid(resource.height))return{width:resource.width,height:resource.height};
  if(!(resource.original===true||(!isCloudArchive(item.archiveId)&&!item.imageHash)))return;
  return valid(naturalWidth)&&valid(naturalHeight)?{width:naturalWidth,height:naturalHeight}:undefined;
}

function ImageCard({item,archive,favorite,onOpen,onFavorite}:{
  item:HtmlPage;archive:string;favorite:boolean;onOpen:ImageGalleryProps['onOpen'];onFavorite:ImageGalleryProps['onFavorite'];
}){
  const resource=useImageResource(item,true,'thumbnail');
  const[failedURL,setFailedURL]=useState('');
  const[loadedURL,setLoadedURL]=useState('');
  const failed=Boolean(resource.error)||(Boolean(resource.url)&&failedURL===resource.url);
  const source=`${archive} / ${item.path}`;
  const known=imageDimensions(item);
  const details=`${known?`${known.width} × ${known.height}`:'Unknown dimensions'} · ${imageBytes(item.size)}`;
  return <article className="folio-image-card">
    <button className="folio-image-thumbnail" type="button" onClick={()=>onOpen(item.id)} aria-label={`Open image ${item.label}`} title={`${item.label} · ${details}`}>
      {resource.placeholder&&loadedURL!==resource.url&&<img className="folio-image-card-placeholder" src={resource.placeholder} alt="" aria-hidden="true"/>}
      {resource.url&&!failed?<img className={loadedURL===resource.url?'is-loaded':''} src={resource.url} alt={item.label} loading="lazy" decoding="async" fetchPriority="low"
        onLoad={event=>{rememberDecodedImage(resource.url!,event.currentTarget);const size=originalDimensionsForImageLoad(item,resource,event.currentTarget.naturalWidth,event.currentTarget.naturalHeight);if(size&&!imageDimensions(item))recordImageDimensions(item.id,size.width,size.height);setLoadedURL(resource.url!);}}
        onError={()=>setFailedURL(resource.url!)}/>:
        failed?<span className="folio-image-thumbnail-state"><AlertCircle size={21} aria-hidden="true"/><span>Preview unavailable</span></span>:
        <ImageIcon size={24} strokeWidth={1.3} aria-hidden="true"/>}
    </button>
    <div className="folio-image-card-meta">
      <button className="folio-image-card-name" type="button" title={item.label} onClick={()=>onOpen(item.id)}>{item.label}</button>
      <button className={`folio-image-favorite ${favorite?'is-favorite':''}`} type="button" aria-label={`${favorite?'Remove':'Add'} ${item.label} ${favorite?'from':'to'} favorites`} aria-pressed={favorite} onClick={()=>onFavorite(item.id)}><Star size={14} fill={favorite?'currentColor':'none'} aria-hidden="true"/></button>
      <p className="folio-image-card-path" title={source}>{source}</p>
      <span className="folio-image-card-bytes" title={details}>{details}</span>
    </div>
  </article>;
}

export function ImageGallery({items,archives,organization,groupByMonth=false,grid=DEFAULT_GRID,page,onPageChange,onOpen,onFavorite}:ImageGalleryProps){
  const layout=normalizeGrid(grid);
  const {ref,resolved,height}=useCanvasGrid(layout);
  const [localPage,setLocalPage]=useState(0);
  const requestedPage=page??localPage;
  const paging=gridPage(items.length,resolved.capacity,requestedPage);
  const changePage=onPageChange??setLocalPage;
  const archiveMap=useMemo(()=>new Map(archives.map(archive=>[archive.id,archive])),[archives]);
  const visibleItems=items.slice(paging.start,paging.end);
  const canvasHeight=gridBodyHeight(resolved.rows,height);
  const cardHeight=(canvasHeight-(resolved.rows-1)*8)/resolved.rows;
  const monthLabel=groupByMonth?groupItemsByMonth(visibleItems,archiveMap).map(group=>`${group.label} · ${group.items.length.toLocaleString()}`).join('  /  '):'';
  const signature=useMemo(()=>JSON.stringify([layout.columns,layout.rows,groupByMonth,items.map(item=>item.id)]),[items,layout.columns,layout.rows,groupByMonth]);
  const previousSignature=useRef(signature);
  useEffect(()=>{if(previousSignature.current!==signature){previousSignature.current=signature;if(page===undefined)setLocalPage(0);}},[signature,page]);
  useEffect(()=>{if(requestedPage!==paging.page)changePage(paging.page);},[requestedPage,paging.page,changePage]);

  return <section className="folio-image-gallery is-canvas" aria-label="Image gallery" data-grid-columns={resolved.columns} data-grid-rows={resolved.rows} data-grid-capacity={resolved.capacity}>
    {groupByMonth&&<div className="folio-image-canvas-months" title={monthLabel} aria-label="Months on this page">{monthLabel||'No images in this view'}</div>}
    <div ref={ref} className="folio-image-canvas-body">
      {items.length?<div className={'folio-image-canvas-grid '+(cardHeight<120?'is-dense ':'')+(cardHeight<90?'is-compact':'')} style={{height:canvasHeight,gridTemplateColumns:`repeat(${resolved.columns},minmax(0,1fr))`,gridTemplateRows:`repeat(${resolved.rows},minmax(0,1fr))`}} data-total-images={items.length} data-visible-images={visibleItems.length}>
        {visibleItems.map(item=><ImageCard key={item.id} item={item} archive={archiveMap.get(item.archiveId)?.name??'Archive'} favorite={organization.get(item.id)?.favorite??false} onOpen={onOpen} onFavorite={onFavorite}/>)}
      </div>:<p className="folio-image-gallery-empty">No images in this view. Import an image or a ZIP, or adjust the current filters.</p>}
    </div>
    <GridPager page={paging.page} pageCount={paging.pageCount} total={items.length} columns={resolved.columns} rows={resolved.rows} onPageChange={changePage}/>
  </section>;
}
