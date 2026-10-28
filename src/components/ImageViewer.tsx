import { useEffect, useState, useSyncExternalStore } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { getArchiveFiles, getFile } from '../db';
import { getImageMetadata, imageMetadataVersion, isCloudArchive, subscribeImageMetadata } from '../cloud';
import { imageIsPaintReady, imagePrefetchQueue, imageSource, localImageURLs, neighborPrefetchPlan, rememberDecodedImage, warmImage } from '../image-cache';
import type { ImageVariant, ObjectUrlLease } from '../image-cache';
import type { HtmlPage } from '../types';
import {recordImageDimensions,imageDimensions} from '../image-dimensions';
import './images.css';

interface ImageResource {
  id:string;url?:string;bytes?:number;error?:string;placeholder?:string;width?:number;height?:number;animated?:boolean;hash?:string;
}

/** Native immutable preview URLs paint directly; only local images need an object URL lease. */
export function useImageResource(item:HtmlPage,enabled=true,variant:ImageVariant='preview'):ImageResource{
  useSyncExternalStore(subscribeImageMetadata,imageMetadataVersion,imageMetadataVersion);
  const [fallback,setFallback]=useState<ImageResource>({id:''});
  const hash=item.imageHash??(fallback.id===item.id?fallback.hash:undefined);
  const direct=imageSource({...item,imageHash:hash},getImageMetadata(hash),variant);
  useEffect(()=>{
    if(!enabled||direct)return;
    let disposed=false;let lease:ObjectUrlLease|undefined;
    setFallback({id:item.id});
    const load=async()=>{
      if(isCloudArchive(item.archiveId)){
        const file=(await getArchiveFiles(item.archiveId)).get(item.path);
        if(!file||!file.remote)throw new Error('This image is no longer in the saved collection.');
        if(!file.mime.startsWith('image/'))throw new Error('This file is not a supported image.');
        if(!disposed)setFallback({id:item.id,hash:file.remote.sha256,bytes:file.remote.size});
        return;
      }
      lease=await localImageURLs.acquire(item.id,async()=>{
        const file=await getFile(item.id);
        if(!file)throw new Error('This image is no longer in this browser. Re-import its source file.');
        if(!file.mime.startsWith('image/'))throw new Error('This file is not a supported image.');
        return file.blob.type===file.mime?file.blob:file.blob.slice(0,file.blob.size,file.mime);
      });
      if(disposed){lease.release();lease=undefined;return;}
      setFallback({id:item.id,url:lease.url,bytes:item.size});
    };
    void load().catch(error=>{if(!disposed)setFallback({id:item.id,error:error instanceof Error?error.message:'Could not open this image.'});});
    return()=>{disposed=true;lease?.release();};
  },[item.id,item.archiveId,item.path,item.size,enabled,Boolean(direct)]);
  if(!enabled)return{id:item.id};
  if(direct)return{id:item.id,...direct,bytes:item.size,hash};
  return fallback.id===item.id?fallback:{id:item.id};
}

export function imageBytes(bytes:number):string{
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1024*1024)return `${Math.max(1,Math.round(bytes/1024))} KB`;
  return `${(bytes/(1024*1024)).toFixed(1)} MB`;
}

function useNeighborPrefetch(item:HtmlPage,nearbyItems:HtmlPage[]):void{
  useSyncExternalStore(subscribeImageMetadata,imageMetadataVersion,imageMetadataVersion);
  const plan=neighborPrefetchPlan(item.id,nearbyItems,next=>imageSource(next,getImageMetadata(next.imageHash),'preview'));
  useEffect(()=>{
    imagePrefetchQueue.cancelQueuedExcept(new Set(plan.keys));
    for(let index=0;index<plan.targets.length;index++){
      const target=plan.targets[index];
      void imagePrefetchQueue.enqueue(plan.keys[index],async signal=>{
      if(target.source)return warmImage(target.source.url,'low',signal);
      if(isCloudArchive(target.item.archiveId))return;
      const lease=await localImageURLs.acquire(target.item.id,async()=>{
        const file=await getFile(target.item.id);if(!file)throw new Error('Image no longer available.');return file.blob;
      });
      try{await warmImage(lease.url,'low',signal);}finally{lease.release();}
      });
    }
    // The signature covers selection + every immutable target; array identity is intentionally irrelevant.
  },[plan.signature]);
  useEffect(()=>()=>{imagePrefetchQueue.cancelQueuedExcept(new Set());},[]);
}

export interface ImageViewerProps{item:HtmlPage;fit:boolean;nearbyItems?:HtmlPage[]}
const noNeighbors:HtmlPage[]=[];

export function ImageViewer({item,fit,nearbyItems=noNeighbors}:ImageViewerProps){
  const [animatedUpgrade,setAnimatedUpgrade]=useState('');
  const resource=useImageResource(item,true,!fit||animatedUpgrade===item.id?'original':'preview');
  const [painted,setPainted]=useState<{id:string;url:string;width:number;height:number}>({id:'',url:'',width:0,height:0});
  const [failure,setFailure]=useState<{id:string;url:string;message:string}>({id:'',url:'',message:''});
  useNeighborPrefetch(item,nearbyItems);
  const ready=imageIsPaintReady(painted.url,resource.url);
  const current=painted.id===item.id||ready?painted:undefined;
  const error=resource.error??(failure.id===item.id&&failure.url===resource.url?failure.message:undefined);
  const backdrop=current?.url??resource.placeholder;
  const width=resource.width??current?.width,height=resource.height??current?.height;

  return <section className="folio-image-viewer" aria-label={`Image preview: ${item.label}`}>
    <div className={`folio-image-scroll ${fit?'is-fit':'is-actual'}`}>
      {backdrop&&(!ready||current?.url!==resource.url)&&<img className={`folio-image-backdrop ${current?'is-decoded':'is-placeholder'}`} src={backdrop} alt="" aria-hidden="true" width={width} height={height}/>}
      {resource.url&&!error&&<img key={`${item.id}:${resource.url}`} className={`folio-image-original ${ready?'is-ready':'is-opening'}`}
        src={resource.url} alt={item.label} width={width} height={height} decoding="async" fetchPriority="high"
        onLoad={event=>{
          const image=event.currentTarget;rememberDecodedImage(resource.url!,image);
          if(!imageDimensions(item)&&resource.width&&resource.height)recordImageDimensions(item.id,resource.width,resource.height);
          else if(!imageDimensions(item)&&(('original' in resource&&resource.original===true)||!isCloudArchive(item.archiveId)))recordImageDimensions(item.id,image.naturalWidth,image.naturalHeight);
          setPainted({id:item.id,url:resource.url!,width:resource.width??image.naturalWidth,height:resource.height??image.naturalHeight});
          if(fit&&resource.animated&&animatedUpgrade!==item.id)setAnimatedUpgrade(item.id);
        }}
        onError={()=>setFailure({id:item.id,url:resource.url!,message:'This browser could not decode the image. You can still download its original file.'})}/>}
    </div>
    {error?<div className="folio-image-message" role="status"><AlertCircle size={21} aria-hidden="true"/><strong>Couldn’t open this image</strong><span>{error}</span></div>:
      !ready&&!backdrop?<div className="folio-image-message" role="status"><LoaderCircle className="folio-image-loading" size={19} aria-hidden="true"/><span>Opening image…</span></div>:null}
    {(width&&height)&&<div className="folio-image-info" aria-label="Image dimensions and file size"><span>{width} × {height}</span><span>{imageBytes(item.size)}</span><span>{fit?'Fit':'100%'}</span>{!ready&&<LoaderCircle className="folio-image-loading" size={10} aria-label="Loading sharper preview"/>}</div>}
  </section>;
}
