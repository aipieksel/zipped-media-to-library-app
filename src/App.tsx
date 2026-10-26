import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Camera,Check,ChevronDown,ChevronsDownUp,ChevronsUpDown,CloudDownload,Download,FileCode2,Folder,FolderInput,FolderPlus,HelpCircle,Images,LoaderCircle,Menu,Plus,Search,Settings2,Star,Trash2,Upload,X,AlertTriangle} from 'lucide-react';
import type {ArchiveMeta,HtmlPage,ImportBundle,ItemKind,ItemOrganization,Snapshot,WorkspaceFolder} from './types';
import {listWorkspace,saveImport,putSnapshot,deleteRoot,getPreference,setPreference,createFolder,setItemFavorite,moveItemsToFolder} from './db';
import {importImages} from './archive';
import {buildTree,buildOrganizedTree,filterTree,getPageOrder,getAncestorIds} from './tree';
import {capturePage,DEFAULT_CAPTURE} from './capture';
import type {CaptureOptions} from './capture';
import {ArchiveTree} from './components/ArchiveTree';
import {Gallery} from './components/Gallery';
import {PreviewPane} from './components/PreviewPane';
import {ImageViewer} from './components/ImageViewer';
import {ImageGallery} from './components/ImageGallery';
import {downloadWorkspaceItem,downloadHtmlSource} from './download';
import {createDemoZip} from './demo';
import {fetchGoogleDriveFile} from './googleDrive';

type Preferences={selectedId:string|null;selectedByKind?:Partial<Record<ItemKind,string>>;kind?:ItemKind;expanded:string[];viewport:number;fit:boolean};
type ImportResult={name:string;ok:boolean;message:string};
type QueueState={running:boolean;total:number;done:number;failed:number;current:string};
const emptyQueue:QueueState={running:false,total:0,done:0,failed:0,current:''};
const itemKind=(item:HtmlPage):ItemKind=>item.kind??'html';
const formatBytes=(bytes:number)=>bytes>1024*1024?(bytes/1024/1024).toFixed(1)+' MB':Math.max(1,Math.round(bytes/1024))+' KB';

function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement;const element=ref.current;element?.showModal();const frame=requestAnimationFrame(()=>element?.querySelector<HTMLElement>('input,select')?.focus());return()=>{cancelAnimationFrame(frame);element?.close();if(previous?.isConnected&&previous!==document.body)previous.focus();else document.querySelector<HTMLElement>('.settings-button')?.focus();};},[]);
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===ref.current)onClose();}}>
    <div className="modal-header"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={16}/></button></div>{children}
  </dialog>;
}

export default function App(){
  const [archives,setArchives]=useState<ArchiveMeta[]>([]);
  const [items,setItems]=useState<HtmlPage[]>([]);
  const [snapshots,setSnapshots]=useState<Map<string,Snapshot>>(new Map());
  const [folders,setFolders]=useState<WorkspaceFolder[]>([]);
  const [organization,setOrganization]=useState<Map<string,ItemOrganization>>(new Map());
  const [kind,setKind]=useState<ItemKind>('html');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [expanded,setExpanded]=useState<Set<string>>(new Set());
  const [query,setQuery]=useState('');
  const [favoritesOnly,setFavoritesOnly]=useState(false);
  const [view,setView]=useState<'preview'|'gallery'>('preview');
  const [mode,setMode]=useState<'live'|'snapshot'>('live');
  const [viewport,setViewport]=useState(1440);
  const [fit,setFit]=useState(true);
  const [loaded,setLoaded]=useState(false);
  const [storageError,setStorageError]=useState('');
  const [importing,setImporting]=useState(false);
  const [importProgress,setImportProgress]=useState('');
  const [importResults,setImportResults]=useState<ImportResult[]>([]);
  const [reportOpen,setReportOpen]=useState(false);
  const [queue,setQueue]=useState<QueueState>(emptyQueue);
  const [captureErrors,setCaptureErrors]=useState<Map<string,string>>(new Map());
  const [captureDialog,setCaptureDialog]=useState(false);
  const [captureOptions,setCaptureOptions]=useState<CaptureOptions>(DEFAULT_CAPTURE);
  const [recapture,setRecapture]=useState(false);
  const [popover,setPopover]=useState<'settings'|'move'|null>(null);
  const [helpOpen,setHelpOpen]=useState(false);
  const [importsOpen,setImportsOpen]=useState(false);
  const [removeId,setRemoveId]=useState<string|null>(null);
  const [folderDialog,setFolderDialog]=useState<{moveId:string|null}|null>(null);
  const [folderName,setFolderName]=useState('');
  const [folderError,setFolderError]=useState('');
  const [savingFolder,setSavingFolder]=useState(false);
  const [organizing,setOrganizing]=useState(false);
  const [downloading,setDownloading]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [narrow,setNarrow]=useState(()=>window.matchMedia('(max-width:650px)').matches);
  const [dragging,setDragging]=useState(false);
  const [toast,setToast]=useState('');
  const [warnings,setWarnings]=useState<string[]>([]);
  const [warningsOpen,setWarningsOpen]=useState(false);
  const [driveOpen,setDriveOpen]=useState(false);
  const [driveUrl,setDriveUrl]=useState('');
  const [driveError,setDriveError]=useState('');
  const inputRef=useRef<HTMLInputElement>(null);
  const searchRef=useRef<HTMLInputElement>(null);
  const importLock=useRef(false);
  const captureAbort=useRef<AbortController|null>(null);
  const dragDepth=useRef(0);
  const toastTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const mounted=useRef(true);
  const remembered=useRef<Partial<Record<ItemKind,string>>>({});
  const organizationLock=useRef(false);

  const itemMap=useMemo(()=>new Map(items.map(item=>[item.id,item])),[items]);
  const archiveMap=useMemo(()=>new Map(archives.map(archive=>[archive.id,archive])),[archives]);
  const kindItems=useMemo(()=>items.filter(item=>itemKind(item)===kind),[items,kind]);
  const tree=useMemo(()=>buildOrganizedTree(archives,items,folders,organization,kind,favoritesOnly),[archives,items,folders,organization,kind,favoritesOnly]);
  const filteredItems=useMemo(()=>getPageOrder(filterTree(tree,query,itemMap)).map(id=>itemMap.get(id)).filter((item):item is HtmlPage=>!!item),[tree,query,itemMap]);
  const selected=selectedId?itemMap.get(selectedId):undefined;
  const selectedArchive=selected?archiveMap.get(selected.archiveId):undefined;
  const position=filteredItems.findIndex(item=>item.id===selectedId);
  const roots=archives.filter(archive=>!archive.parentId);
  const htmlCount=items.filter(item=>itemKind(item)==='html').length;
  const imageCount=items.length-htmlCount;
  const favoriteCount=kindItems.filter(item=>organization.get(item.id)?.favorite).length;
  const selectedFavorite=!!selectedId&&!!organization.get(selectedId)?.favorite;
  const selectedFolder=selectedId?organization.get(selectedId)?.folderId??null:null;
  const anyModal=helpOpen||importsOpen||captureDialog||reportOpen||!!removeId||!!folderDialog||warningsOpen||driveOpen;
  const notify=useCallback((message:string)=>{setToast(message);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),6000);},[]);

  useEffect(()=>{
    mounted.current=true;
    void Promise.all([listWorkspace(),getPreference<Preferences>('workspace')]).then(([workspace,prefs])=>{
      if(!mounted.current)return;
      setArchives(workspace.archives);setItems(workspace.pages);setFolders(workspace.folders);setOrganization(new Map(workspace.organization.map(item=>[item.id,item])));
      setSnapshots(new Map(workspace.snapshots.map(item=>[item.pageId,item])));
      const nextKind=prefs?.kind??'html';
      setKind(nextKind);remembered.current=prefs?.selectedByKind??{};
      const preferred=prefs?.selectedId;
      const first=workspace.pages.find(item=>itemKind(item)===nextKind);
      setSelectedId(workspace.pages.some(item=>item.id===preferred&&itemKind(item)===nextKind)?preferred!:first?.id??null);
      setExpanded(new Set(prefs?.expanded??workspace.archives.map(item=>item.id)));
      setViewport(prefs?.viewport??1440);setFit(prefs?.fit??true);setLoaded(true);
    }).catch(error=>{setStorageError(error instanceof Error?error.message:'Browser storage is unavailable.');setLoaded(true);});
    return()=>{mounted.current=false;};
  },[]);
  useEffect(()=>{
    if(!loaded||storageError)return;
    if(selectedId)remembered.current[kind]=selectedId;
    const timer=setTimeout(()=>void setPreference('workspace',{selectedId,selectedByKind:remembered.current,kind,expanded:[...expanded],viewport,fit}).catch(()=>setStorageError('Workspace settings could not be saved. Check available browser storage.')),300);
    return()=>clearTimeout(timer);
  },[loaded,selectedId,kind,expanded,viewport,fit,storageError]);
  useEffect(()=>{
    if(!loaded)return;
    const current=selectedId?itemMap.get(selectedId):undefined;
    if(current&&itemKind(current)===kind&&filteredItems.some(item=>item.id===current.id))return;
    const preferred=remembered.current[kind];
    const next=filteredItems.find(item=>item.id===preferred)??filteredItems[0];
    setSelectedId(next?.id??null);
  },[loaded,kind,filteredItems,itemMap,selectedId]);
  useEffect(()=>{
    if(!selectedId)return;
    setExpanded(current=>{
      const next=new Set([...current,...getAncestorIds(tree,selectedId)]);
      return next.size===current.size?current:next;
    });
  },[selectedId,tree]);
  useEffect(()=>{
    if(!selectedId)return;
    const timer=setTimeout(()=>document.querySelector<HTMLElement>('[data-page-id="'+CSS.escape(selectedId)+'"]')?.scrollIntoView({block:'nearest'}),0);
    return()=>clearTimeout(timer);
  },[selectedId,expanded]);
  useEffect(()=>{
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(importLock.current||captureAbort.current)event.preventDefault();};
    window.addEventListener('beforeunload',beforeUnload);return()=>window.removeEventListener('beforeunload',beforeUnload);
  },[]);
  useEffect(()=>{
    const media=window.matchMedia('(max-width:650px)');const change=()=>setNarrow(media.matches);
    media.addEventListener('change',change);return()=>media.removeEventListener('change',change);
  },[]);
  useEffect(()=>{
    if(!sidebarOpen||!narrow)return;
    const frame=requestAnimationFrame(()=>searchRef.current?.focus());
    const keys=(event:KeyboardEvent)=>{
      if(document.querySelector('dialog[open]'))return;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setSidebarOpen(false);}
      if(event.key==='Tab'){
        const controls=Array.from(document.querySelectorAll<HTMLElement>('.sidebar button:not(:disabled),.sidebar input,.sidebar [tabindex="0"]')).filter(el=>el.getClientRects().length);
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',keys,true);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',keys,true);document.querySelector<HTMLElement>('.mobile-menu')?.focus();};
  },[sidebarOpen,narrow]);
  useEffect(()=>{
    if(!popover)return;
    const prior=document.activeElement as HTMLElement;
    let returnFocus=true;
    const frame=requestAnimationFrame(()=>document.querySelector<HTMLElement>('[data-popover-panel] button,[data-popover-panel] select,[data-popover-panel] input')?.focus());
    const outside=(event:PointerEvent)=>{if(!(event.target as Element)?.closest('[data-popover-root="'+popover+'"]')){returnFocus=false;setPopover(null);}};
    const keys=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();setPopover(null);prior?.focus();}
      if(event.key==='Tab'){
        const controls=Array.from(document.querySelectorAll<HTMLElement>('[data-popover-panel] button:not(:disabled),[data-popover-panel] input,[data-popover-panel] select')).filter(el=>el.getClientRects().length);
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',keys);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keys);if(returnFocus&&prior?.isConnected&&!document.querySelector('dialog[open]'))prior.focus();};
  },[popover]);

  const selectItem=useCallback((id:string,nextMode?:'live'|'snapshot')=>{
    const item=itemMap.get(id);if(!item)return;
    remembered.current[itemKind(item)]=id;
    setSelectedId(id);setKind(itemKind(item));setView('preview');if(nextMode)setMode(nextMode);
    setExpanded(current=>new Set([...current,...getAncestorIds(tree,id)]));setSidebarOpen(false);setPopover(null);
    if(document.activeElement?.closest('[role=tree]'))requestAnimationFrame(()=>document.querySelector<HTMLElement>('[data-page-id="'+CSS.escape(id)+'"]')?.focus({preventScroll:true}));
  },[tree,itemMap]);
  const step=useCallback((direction:number)=>{
    if(!filteredItems.length)return;
    const next=position<0?(direction>0?0:filteredItems.length-1):(position+direction+filteredItems.length)%filteredItems.length;
    selectItem(filteredItems[next].id);
  },[filteredItems,position,selectItem]);
  useEffect(()=>{
    const keydown=(event:KeyboardEvent)=>{
      if(anyModal||popover||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      const target=event.target as Element;
      if(target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]'))return;
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();step(event.key==='ArrowDown'?1:-1);}
      if(event.key==='Home'&&filteredItems.length){event.preventDefault();selectItem(filteredItems[0].id);}
      if(event.key==='End'&&filteredItems.length){event.preventDefault();selectItem(filteredItems[filteredItems.length-1].id);}
      if(event.key==='/'){event.preventDefault();setSidebarOpen(true);requestAnimationFrame(()=>searchRef.current?.focus());}
    };
    window.addEventListener('keydown',keydown);return()=>window.removeEventListener('keydown',keydown);
  },[step,filteredItems,selectItem,anyModal,popover]);
  const switchKind=(nextKind:ItemKind)=>{
    if(selectedId)remembered.current[kind]=selectedId;
    setKind(nextKind);setQuery('');setSelectedId(remembered.current[nextKind]??null);setPopover(null);setWarnings([]);
  };

  const importZip=(file:File)=>new Promise<ImportBundle>((resolve,reject)=>{
    const worker=new Worker(new URL('./archive.worker.ts',import.meta.url),{type:'module'});
    const cleanup=()=>{clearTimeout(timer);worker.terminate();};
    const timer=setTimeout(()=>{cleanup();reject(new Error('This archive took too long to extract. Try a smaller ZIP.'));},120000);
    worker.onmessage=event=>{
      const message=event.data;
      if(message.type==='progress')setImportProgress(message.message);
      if(message.type==='result'){cleanup();resolve(message.bundle);}
      if(message.type==='error'){cleanup();reject(new Error(message.message));}
    };
    worker.onerror=()=>{cleanup();reject(new Error('The archive worker could not read this ZIP.'));};
    void file.arrayBuffer().then(buffer=>worker.postMessage({buffer,name:file.name},[buffer])).catch(error=>{cleanup();reject(error);});
  });
  const importFiles=async(files:File[])=>{
    if(importLock.current){notify('An import is already running.');return;}
    if(!loaded||storageError){notify('Enable browser storage and reload before importing files.');return;}
    if(!files.length)return;
    importLock.current=true;setImporting(true);setDragging(false);
    const images=files.filter(file=>!/\.zip$/i.test(file.name));
    const jobs:{name:string;file?:File;images?:File[]}[]=files.filter(file=>/\.zip$/i.test(file.name)).map(file=>({name:file.name,file}));
    if(images.length)jobs.push({name:images.length===1?images[0].name:images.length+' images',images});
    const results:ImportResult[]=[];let nextArchives=archives;let nextItems=items;let firstNew:HtmlPage|undefined;
    for(const job of jobs){
      setImportProgress('Opening '+job.name+'…');
      try{
        if(job.file&&job.file.size>256*1024*1024)throw new Error('This ZIP is larger than the 256 MB per-archive limit.');
        const bundle=job.file?await importZip(job.file):await importImages(job.images!,'Image upload'+(job.images!.length>1?' ('+job.images!.length+')':''));
        await saveImport(bundle);
        nextArchives=[...nextArchives,...bundle.archives];nextItems=[...nextItems,...bundle.pages];
        setArchives(nextArchives);setItems(nextItems);setExpanded(current=>new Set([...current,...bundle.archives.map(archive=>archive.id)]));
        if(!firstNew){const order=getPageOrder(buildTree(bundle.archives,bundle.pages));const ordered=order.map(id=>bundle.pages.find(item=>item.id===id)!);firstNew=ordered.find(item=>itemKind(item)===kind)??ordered[0];}
        const html=bundle.pages.filter(item=>itemKind(item)==='html').length;const image=bundle.pages.length-html;
        results.push({name:job.name,ok:true,message:bundle.pages.length?html+' HTML · '+image+' images · '+bundle.files.length+' files retained':'No HTML pages or supported images found.'});
      }catch(error){results.push({name:job.name,ok:false,message:error instanceof Error?error.message:'Could not import this file.'});}
      setImportResults([...results]);
    }
    importLock.current=false;setImporting(false);setImportProgress('');
    if(firstNew){remembered.current[itemKind(firstNew)]=firstNew.id;setKind(itemKind(firstNew));setSelectedId(firstNew.id);setMode('live');setView('preview');setQuery('');setFavoritesOnly(false);}
    const success=results.filter(result=>result.ok).length;const failed=results.length-success;
    notify(success+' import'+(success===1?'':'s')+' saved'+(failed?' · '+failed+' could not be opened':'')+'.');
    if(failed||results.some(result=>result.message.startsWith('No HTML')))setReportOpen(true);
  };

  const importFromDrive=async()=>{
    const source=driveUrl.trim();
    if(!source||importLock.current)return;
    if(!loaded||storageError){setDriveError('Enable browser storage and reload before importing files.');return;}
    setDriveError('');setImporting(true);setImportProgress('Connecting to Google Drive…');
    try{
      const file=await fetchGoogleDriveFile(source,message=>setImportProgress(message));
      setDriveOpen(false);setDriveUrl('');
      await importFiles([file]);
    }catch(error){
      setDriveError(error instanceof Error?error.message:'Could not import this Google Drive file.');
      setImporting(false);setImportProgress('');
    }
  };

  const runCaptures=async(targets:HtmlPage[],options=captureOptions)=>{
    const htmlTargets=targets.filter(item=>itemKind(item)==='html');
    if(captureAbort.current||!htmlTargets.length){if(!htmlTargets.length)notify('Every matching HTML page already has a screenshot. Enable replace to capture again.');return;}
    const abort=new AbortController();captureAbort.current=abort;
    setQueue({running:true,total:htmlTargets.length,done:0,failed:0,current:htmlTargets[0].label});
    let done=0;let failed=0;
    for(const page of htmlTargets){
      if(abort.signal.aborted)break;
      setQueue({running:true,total:htmlTargets.length,done,failed,current:page.label});
      setCaptureErrors(current=>{const next=new Map(current);next.delete(page.id);return next;});
      try{
        const snapshot=await capturePage(page,options,abort.signal);if(abort.signal.aborted)break;
        await putSnapshot(snapshot);setSnapshots(current=>new Map(current).set(page.id,snapshot));done++;
      }catch(error){
        if(abort.signal.aborted)break;
        failed++;setCaptureErrors(current=>new Map(current).set(page.id,error instanceof Error?error.message:'Could not capture this page.'));
      }
    }
    captureAbort.current=null;setQueue({running:false,total:htmlTargets.length,done,failed,current:''});
    notify((abort.signal.aborted?'Capture stopped. ':'')+done+' screenshot'+(done===1?'':'s')+' saved'+(failed?' · '+failed+' failed. Open the page warning to retry.':'.'));
  };
  const updateOrganization=(values:ItemOrganization[])=>setOrganization(current=>{const next=new Map(current);for(const item of values)next.set(item.id,item);return next;});
  const toggleFavorite=async(id:string)=>{
    if(organizationLock.current)return;
    organizationLock.current=true;setOrganizing(true);
    try{updateOrganization([await setItemFavorite(id,!organization.get(id)?.favorite)]);}catch(error){notify(error instanceof Error?error.message:'Could not save favorite.');}
    finally{organizationLock.current=false;setOrganizing(false);}
  };
  const moveItem=async(folderId:string|null,id=selectedId)=>{
    if(!id||organizationLock.current)return;
    organizationLock.current=true;setOrganizing(true);
    try{
      updateOrganization(await moveItemsToFolder([id],folderId));setPopover(null);setQuery('');
      if(folderId)setExpanded(current=>new Set([...current,folderId]));
      notify(folderId?'Moved to '+(folders.find(folder=>folder.id===folderId)?.name??'folder')+'.':'Returned to original archive.');
    }catch(error){notify(error instanceof Error?error.message:'Could not move item.');}
    finally{organizationLock.current=false;setOrganizing(false);}
  };
  const openFolderDialog=(moveId:string|null=null)=>{setPopover(null);setFolderName('');setFolderError('');setFolderDialog({moveId});};
  const submitFolder=async(event:React.FormEvent)=>{
    event.preventDefault();if(savingFolder)return;setSavingFolder(true);setFolderError('');
    try{
      const folder=await createFolder(folderName);setFolders(current=>[...current,folder]);setExpanded(current=>new Set([...current,folder.id]));setQuery('');
      if(folderDialog?.moveId)updateOrganization(await moveItemsToFolder([folderDialog.moveId],folder.id));
      setFolderDialog(null);notify('Folder created'+(folderDialog?.moveId?' and item moved.':'.'));
    }catch(error){setFolderError(error instanceof Error?error.message:'Could not create folder.');}
    finally{setSavingFolder(false);}
  };
  const downloadSelected=async(sourceOnly=false)=>{
    if(!selected||downloading)return;setDownloading(true);setPopover(null);
    try{
      const file=await(sourceOnly?downloadHtmlSource(selected):downloadWorkspaceItem(selected));
      const url=URL.createObjectURL(file.blob);
      const link=document.createElement('a');link.href=url;link.download=file.filename;link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),30_000);
    }
    catch(error){notify(error instanceof Error?error.message:'Download could not be created.');}
    finally{setDownloading(false);}
  };
  const downloadScreenshot=()=>{
    const snapshot=selectedId?snapshots.get(selectedId):undefined;if(!snapshot||!selected)return;
    const url=URL.createObjectURL(snapshot.blob);const link=document.createElement('a');link.href=url;link.download=selected.label.replace(/[^\p{L}\p{N}._ -]/gu,'-')+'-'+snapshot.width+'.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setPopover(null);
  };
  const removeArchive=async()=>{
    if(!removeId)return;const rootId=removeId;setRemoveId(null);
    try{
      await deleteRoot(rootId);const nextItems=items.filter(item=>item.rootId!==rootId);const retained=new Set(nextItems.map(item=>item.id));
      setArchives(current=>current.filter(archive=>archive.rootId!==rootId));setItems(nextItems);
      setSnapshots(current=>new Map([...current].filter(([id])=>retained.has(id))));
      setOrganization(current=>new Map([...current].filter(([id])=>retained.has(id))));
      setCaptureErrors(current=>new Map([...current].filter(([id])=>retained.has(id))));
      notify('Import removed from this browser.');
    }catch(error){notify(error instanceof Error?error.message:'Could not remove this import.');}
  };
  const requestRemove=(id:string)=>{if(importing||queue.running)notify('Finish or cancel the current job before removing an import.');else setRemoveId(id);};
  const allGroupIds=()=>{const ids:string[]=[];const visit=(nodes:typeof tree)=>{for(const node of nodes){if(node.kind!=='page'){ids.push(node.id);visit(node.children);}}};visit(tree);return ids;};
  const navigateLocal=(path:string)=>{
    const target=items.find(item=>itemKind(item)==='html'&&item.archiveId===selected?.archiveId&&(item.path===path||item.path===path.replace(/\/$/,'')+'/index.html'));
    if(target){setQuery('');setFavoritesOnly(false);selectItem(target.id,'live');}else notify('That link does not point to an HTML page in this archive.');
  };
  const pendingCaptures=filteredItems.filter(item=>itemKind(item)==='html'&&(recapture||!snapshots.has(item.id)));
  const folderTitle=selectedFolder?folders.find(folder=>folder.id===selectedFolder)?.name:'Original archive';

  return <div className="app-shell"
    onDragEnter={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();dragDepth.current++;setDragging(true);}}}
    onDragLeave={event=>{event.preventDefault();dragDepth.current--;if(dragDepth.current<=0){dragDepth.current=0;setDragging(false);}}}
    onDragOver={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();event.dataTransfer.dropEffect='copy';}}}
    onDrop={event=>{event.preventDefault();dragDepth.current=0;setDragging(false);void importFiles(Array.from(event.dataTransfer.files));}}>
    <input ref={inputRef} type="file" accept=".zip,.png,.jpg,.jpeg,.webp,.gif,.svg,.avif,.bmp,.ico" multiple hidden aria-label="Import ZIPs or images" onChange={event=>{void importFiles(Array.from(event.target.files??[]));event.target.value='';}}/>
    {sidebarOpen&&<button className="sidebar-scrim" aria-label="Close file sidebar" onClick={()=>setSidebarOpen(false)}/>}
    <aside className={'sidebar '+(sidebarOpen?'is-open':'')} aria-label="File navigation">
      <div className="sidebar-top">
        <div className="kind-tabs" role="tablist" aria-label="File type">
          <button role="tab" aria-selected={kind==='html'} className={kind==='html'?'active':''} onClick={()=>switchKind('html')}><FileCode2 size={14}/>HTML<span>{htmlCount}</span></button>
          <button role="tab" aria-selected={kind==='image'} className={kind==='image'?'active':''} onClick={()=>switchKind('image')}><Images size={14}/>Images<span>{imageCount}</span></button>
        </div>
        <button className="icon-button" aria-label="Import files" title="Import ZIPs or images" disabled={!loaded||importing} onClick={()=>inputRef.current?.click()}><Plus size={17}/></button>
        <button className="icon-button" aria-label="Import from Google Drive" title="Import from Google Drive" disabled={!loaded||importing} onClick={()=>{setDriveError('');setDriveOpen(true);}}><CloudDownload size={16}/></button>
      </div>
      <div className="search-field"><Search size={14}/><input ref={searchRef} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a file…" aria-label="Find a file" onKeyDown={event=>{if(event.key==='Escape'){setQuery('');event.currentTarget.blur();}}}/>{query?<button className="icon-button tiny" aria-label="Clear search" onClick={()=>setQuery('')}><X size={13}/></button>:<kbd>/</kbd>}</div>
      <div className="tree-actions">
        <button className={'favorites-filter '+(favoritesOnly?'active':'')} aria-pressed={favoritesOnly} onClick={()=>setFavoritesOnly(!favoritesOnly)} title="Show favorites only"><Star size={13} fill={favoritesOnly?'currentColor':'none'}/>Favorites{favoriteCount>0&&<span>{favoriteCount}</span>}</button>
        <span className="flex-space"/>
        <button className="icon-button tiny" title="New folder" aria-label="New folder" onClick={()=>openFolderDialog()} disabled={!loaded}><FolderPlus size={15}/></button>
        <button className="icon-button tiny" title="Expand all" aria-label="Expand all folders" onClick={()=>setExpanded(new Set(allGroupIds()))}><ChevronsUpDown size={14}/></button>
        <button className="icon-button tiny" title="Collapse all" aria-label="Collapse all folders" onClick={()=>setExpanded(new Set())}><ChevronsDownUp size={14}/></button>
      </div>
      <div className="sidebar-scroll">
        {!loaded?<div className="tree-placeholder"><LoaderCircle className="spin" size={15}/>Opening workspace…</div>:
          <ArchiveTree nodes={tree} pages={kindItems} selectedId={selectedId} expanded={expanded} snapshots={snapshots} captureErrors={captureErrors} query={query} kind={kind} organization={organization}
            onSelect={id=>selectItem(id)} onToggle={id=>setExpanded(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next;})} onRemove={requestRemove}/>}
      </div>
      <div className="sidebar-bottom">
        <button className="drop-note" onClick={()=>inputRef.current?.click()} disabled={importing} title={importing?importProgress:'Drop ZIPs or images anywhere in this workspace'}>
          {importing?<LoaderCircle size={12} className="spin"/>:<Upload size={12}/>}<span>{importing?importProgress:'Drop ZIPs or images here'}</span>
        </button>
        <button className="icon-button tiny" aria-label="Help" title="Help and shortcuts" onClick={()=>setHelpOpen(true)}><HelpCircle size={14}/></button>
      </div>
    </aside>
    <main className="main-workspace" inert={sidebarOpen&&narrow}>
      <header className="workspace-toolbar">
        <button className="icon-button mobile-menu" aria-label="Toggle file sidebar" aria-expanded={sidebarOpen} onClick={()=>setSidebarOpen(!sidebarOpen)}><Menu size={18}/></button>
        <div className="file-navigation" aria-label="Cycle through files">
          <button className="icon-button" aria-label="Previous file" title="Previous file · ↑ · loops through all folders" disabled={!filteredItems.length} onClick={()=>step(-1)}><ArrowLeft size={16}/></button>
          <span className="file-position" aria-live="polite">{position<0?'—':position+1}<span> / {filteredItems.length}</span></span>
          <button className="icon-button" aria-label="Next file" title="Next file · ↓ · loops through all folders" disabled={!filteredItems.length} onClick={()=>step(1)}><ArrowRight size={16}/></button>
        </div>
        <div className="current-file" title={selected?(selectedArchive?.name??'')+' / '+selected.path:kind==='html'?'HTML pages':'Images'}>
          <strong>{selected?.label??(kind==='html'?'HTML pages':'Images')}</strong>
          {selected&&<span>{selectedFolder?folderTitle:selectedArchive?.name}{kind==='html'&&mode==='snapshot'?' · Screenshot':''}</span>}
        </div>
        {kind==='html'&&selected&&(warnings.length>0||captureErrors.has(selected.id))&&<button className="icon-button warning-button" title="Page notices" aria-label="Page notices" onClick={()=>setWarningsOpen(true)}><AlertTriangle size={15}/></button>}
        <div className="item-actions">
          <button className={'icon-button '+(selectedFavorite?'is-favorite':'')} aria-label={selectedFavorite?'Remove favorite':'Add favorite'} title={selectedFavorite?'Remove favorite':'Add favorite'} aria-pressed={selectedFavorite} disabled={!selected||organizing} onClick={()=>selected&&void toggleFavorite(selected.id)}><Star size={16} fill={selectedFavorite?'currentColor':'none'}/></button>
          <div className="popover-root" data-popover-root="move">
            <button className="icon-button" aria-label="Move to folder" title="Move to folder" aria-haspopup="dialog" aria-expanded={popover==='move'} disabled={!selected||organizing} onClick={()=>setPopover(popover==='move'?null:'move')}><FolderInput size={16}/></button>
            {popover==='move'&&<div className="toolbar-popover move-popover" role="dialog" aria-label="Move to folder" data-popover-panel>
              <div className="popover-title">Move to folder</div>
              <button className="menu-row" onClick={()=>void moveItem(null)}><FileCode2 size={14}/>Original archive{!selectedFolder&&<Check size={14} className="menu-check"/>}</button>
              <div className="folder-options">{folders.map(folder=><button className="menu-row" key={folder.id} onClick={()=>void moveItem(folder.id)}><Folder size={14}/><span>{folder.name}</span>{selectedFolder===folder.id&&<Check size={14} className="menu-check"/>}</button>)}</div>
              <div className="menu-divider"/><button className="menu-row accent-text" onClick={()=>openFolderDialog(selectedId)}><FolderPlus size={14}/>New folder…</button>
            </div>}
          </div>
          <button className="icon-button" aria-label={kind==='image'?'Download image':'Download HTML with assets'} title={kind==='image'?'Download original image':'Download HTML with its assets as ZIP'} disabled={!selected||downloading} onClick={()=>void downloadSelected()}>{downloading?<LoaderCircle size={16} className="spin"/>:<Download size={16}/>}</button>
        </div>
        <div className="popover-root" data-popover-root="settings">
          <button className={'icon-button settings-button '+(popover==='settings'?'active':'')} aria-label="View and capture settings" title="View and capture settings" aria-haspopup="dialog" aria-expanded={popover==='settings'} onClick={()=>setPopover(popover==='settings'?null:'settings')}><Settings2 size={17}/></button>
          {popover==='settings'&&<div className="toolbar-popover" role="dialog" aria-label="View and capture settings" data-popover-panel>
            <div className="popover-title">View</div>
            {kind==='html'&&<><div className="mode-switch" role="group" aria-label="Preview mode"><button aria-pressed={mode==='live'} className={mode==='live'?'active':''} onClick={()=>{setMode('live');setView('preview');}}>Live HTML</button><button aria-pressed={mode==='snapshot'} className={mode==='snapshot'?'active':''} onClick={()=>{setMode('snapshot');setView('preview');}}>Screenshot</button></div>
              <label className="setting-row"><span>Preview width</span><select aria-label="Preview width" value={viewport} onChange={event=>setViewport(Number(event.target.value))}><option value={1440}>Desktop · 1440</option><option value={1920}>Wide · 1920</option><option value={768}>Tablet · 768</option><option value={390}>Mobile · 390</option></select></label></>}
            <label className="setting-row checkbox-row"><span>Fit to window</span><input type="checkbox" checked={fit} onChange={event=>setFit(event.target.checked)}/></label>
            {kind==='html'&&<><div className="menu-divider"/><div className="popover-title">Screenshots</div>
              <button className="menu-row" disabled={!selected||queue.running} onClick={()=>{setPopover(null);if(selected)void runCaptures([selected],{...captureOptions,width:viewport});}}><Camera size={14}/>Capture current page</button>
              <button className="menu-row" disabled={!filteredItems.length||queue.running} onClick={()=>{setPopover(null);setCaptureDialog(true);}}><Images size={14}/>Capture pages…<span className="menu-meta">{filteredItems.length}</span></button>
              {selectedId&&snapshots.has(selectedId)&&<button className="menu-row" onClick={downloadScreenshot}><Download size={14}/>Download screenshot</button>}
              {selected&&<button className="menu-row" onClick={()=>void downloadSelected(true)}><FileCode2 size={14}/>Download HTML source only</button>}
            </>}
            <div className="menu-divider"/>
            <button className="menu-row" onClick={()=>{setPopover(null);setImportsOpen(true);}}><Folder size={14}/>Manage imports<span className="menu-meta">{roots.length}</span></button>
            {importResults.length>0&&<button className="menu-row" onClick={()=>{setPopover(null);setReportOpen(true);}}><FileCode2 size={14}/>Last import details</button>}
            <button className="menu-row" onClick={()=>{setPopover(null);setHelpOpen(true);}}><HelpCircle size={14}/>Help & shortcuts</button>
          </div>}
        </div>
        <button className={'gallery-toggle '+(view==='gallery'?'active':'')} aria-pressed={view==='gallery'} onClick={()=>setView(view==='gallery'?'preview':'gallery')} title={kind==='html'?'Screenshot gallery':'Image gallery'}><Images size={15}/><span>{view==='gallery'?'Preview':'Gallery'}</span></button>
      </header>
      {storageError&&<div className="error-banner" role="alert"><AlertTriangle size={14}/>{storageError}</div>}
      {queue.running&&<div className="queue-banner" role="status"><LoaderCircle className="spin" size={13}/><span>Capturing {Math.min(queue.done+queue.failed+1,queue.total)} / {queue.total}</span><strong>{queue.current}</strong><span>{queue.done} saved</span><button onClick={()=>captureAbort.current?.abort()}>Cancel</button></div>}
      <div className="content-region">
        {view==='gallery'?(kind==='image'?<ImageGallery items={filteredItems} archives={archives} organization={organization} onOpen={id=>selectItem(id)} onFavorite={id=>void toggleFavorite(id)}/>:<Gallery pages={filteredItems} archives={archives} snapshots={snapshots} query={query} onOpen={(id,nextMode)=>selectItem(id,nextMode)} onCaptureMissing={()=>setCaptureDialog(true)} busy={queue.running}/>):
          selected?(kind==='image'?<ImageViewer item={selected} fit={fit}/>:<PreviewPane page={selected} mode={mode} snapshot={snapshots.get(selected.id)} viewport={viewport} fit={fit} reloadKey={0} onStep={step} onNavigate={navigateLocal} onCapture={()=>setCaptureDialog(true)} busy={queue.running} onWarnings={setWarnings}/>):
          <div className="workspace-empty">
            {favoritesOnly?<Star size={24}/>:kind==='image'?<Images size={26}/>:<FileCode2 size={26}/>}
            <h1>{query?'No matching files':favoritesOnly?'No favorites yet':kind==='image'?'Your images, all in one place':'Drop a ZIP. Browse every page.'}</h1>
            <p>{query?'Try another filename or folder name.':favoritesOnly?'Star a file to keep it close.':'Drop ZIPs or images anywhere, or use the + button to import.'}</p>
            {!query&&!favoritesOnly&&<div className="empty-actions"><button className="button primary" onClick={()=>inputRef.current?.click()} disabled={!loaded||importing}><Upload size={14}/>Import files</button><button className="button" onClick={()=>{setDriveError('');setDriveOpen(true);}} disabled={!loaded||importing}><CloudDownload size={14}/>Google Drive link</button>{!items.length&&<button className="text-button" disabled={!loaded||importing} onClick={()=>void createDemoZip().then(file=>importFiles([file]))}>Try a sample collection</button>}</div>}
          </div>}
      </div>
    </main>
    {dragging&&<div className="drop-overlay"><span><Upload size={18}/>Drop ZIPs or images</span></div>}
    {toast&&<div className="toast" role="status"><span>{toast}</span><button className="icon-button tiny" aria-label="Dismiss notification" onClick={()=>setToast('')}><X size={13}/></button></div>}

    {driveOpen&&<Modal title="Import from Google Drive" onClose={()=>{if(!importing){setDriveOpen(false);setDriveError('');}}}><form onSubmit={event=>{event.preventDefault();void importFromDrive();}}><div className="modal-body"><p className="modal-intro">Paste a Google Drive share link for a ZIP or supported image. The file must be downloadable by anyone with the link.</p><label className="field-label" htmlFor="drive-url">Google Drive file link</label><input autoFocus id="drive-url" className="text-input" type="url" value={driveUrl} onChange={event=>{setDriveUrl(event.target.value);setDriveError('');}} placeholder="https://drive.google.com/file/d/…" required disabled={importing}/>{driveError&&<p className="form-error" role="alert">{driveError}</p>}{importing&&<p className="form-note"><LoaderCircle size={12} className="spin"/> {importProgress||'Downloading…'}</p>}<p className="form-note">Single-file Drive links are supported. Folder links and private files that require sign-in are not.</p></div><div className="modal-footer"><button type="button" className="button" onClick={()=>{setDriveOpen(false);setDriveError('');}} disabled={importing}>Cancel</button><button className="button primary" disabled={importing||!driveUrl.trim()}>{importing?<><LoaderCircle size={14} className="spin"/>Importing…</>:<><CloudDownload size={14}/>Import from Drive</>}</button></div></form></Modal>}
    {folderDialog&&<Modal title={folderDialog.moveId?'Create folder & move item':'New folder'} onClose={()=>{if(!savingFolder)setFolderDialog(null);}}><form onSubmit={submitFolder}><div className="modal-body"><label className="field-label" htmlFor="folder-name">Folder name</label><input autoFocus id="folder-name" className="text-input" value={folderName} onChange={event=>setFolderName(event.target.value)} maxLength={80} placeholder="e.g. Keepers" required/>{folderError&&<p className="form-error" role="alert">{folderError}</p>}<p className="form-note">HTML and images can share a folder. Linked resources stay attached to their pages.</p></div><div className="modal-footer"><button type="button" className="button" onClick={()=>setFolderDialog(null)} disabled={savingFolder}>Cancel</button><button className="button primary" disabled={savingFolder||!folderName.trim()}>{savingFolder?'Saving…':folderDialog.moveId?'Create & move':'Create folder'}</button></div></form></Modal>}
    {captureDialog&&<Modal title="Capture HTML pages" onClose={()=>setCaptureDialog(false)}><div className="modal-body"><p className="modal-intro"><strong>{pendingCaptures.length} pages</strong> to capture{query?' matching “'+query+'”':favoritesOnly?' in favorites':''}. You can keep browsing.</p><div className="form-grid"><label>Viewport width<select value={captureOptions.width} onChange={event=>setCaptureOptions({...captureOptions,width:Number(event.target.value)})}><option value={1440}>Desktop · 1440 px</option><option value={1920}>Wide · 1920 px</option><option value={768}>Tablet · 768 px</option><option value={390}>Mobile · 390 px</option></select></label><label>Wait after loading<select value={captureOptions.delay} onChange={event=>setCaptureOptions({...captureOptions,delay:Number(event.target.value)})}><option value={500}>0.5 seconds</option><option value={1000}>1 second</option><option value={2500}>2.5 seconds</option><option value={5000}>5 seconds</option></select></label></div><label className="check-field"><input type="checkbox" checked={captureOptions.fullPage} onChange={event=>setCaptureOptions({...captureOptions,fullPage:event.target.checked})}/>Capture full page</label><label className="check-field"><input type="checkbox" checked={recapture} onChange={event=>setRecapture(event.target.checked)}/>Replace existing screenshots</label><p className="form-note">Keep this tab open. Browser captures may differ for remote images, embedded video, or some effects.</p></div><div className="modal-footer"><button className="button" onClick={()=>setCaptureDialog(false)}>Cancel</button><button className="button primary" disabled={!pendingCaptures.length||queue.running} onClick={()=>{setCaptureDialog(false);void runCaptures(pendingCaptures);}}><Camera size={14}/>Capture {pendingCaptures.length} pages</button></div></Modal>}
    {reportOpen&&<Modal title="Import details" onClose={()=>setReportOpen(false)}><div className="report-list">{importResults.map((result,index)=><div className="report-item" key={index}>{result.ok?<Check size={16}/>:<AlertTriangle size={16}/>}<div><strong>{result.name}</strong><p>{result.message}</p></div></div>)}</div></Modal>}
    {importsOpen&&<Modal title="Manage imports" onClose={()=>setImportsOpen(false)}><div className="import-list">{roots.length?roots.map(root=><div className="import-row" key={root.id}><div><strong>{root.name}</strong><span>{items.filter(item=>item.rootId===root.id).length} files · {formatBytes(archives.filter(archive=>archive.rootId===root.id).reduce((sum,archive)=>sum+archive.byteSize,0))}</span></div><button className="icon-button" aria-label={'Remove '+root.name} title="Remove import" disabled={importing||queue.running} onClick={()=>{setImportsOpen(false);requestRemove(root.id);}}><Trash2 size={15}/></button></div>):<p className="form-note">No imports yet.</p>}</div></Modal>}
    {removeId&&<Modal title="Remove this import?" onClose={()=>setRemoveId(null)}><div className="modal-body"><p><strong>{archiveMap.get(removeId)?.name}</strong></p><p>Its files, favorites, and screenshots will be removed from this browser. Your original files are unaffected. Items moved into your folders are part of this import.</p></div><div className="modal-footer"><button className="button" onClick={()=>setRemoveId(null)}>Cancel</button><button className="button danger" onClick={()=>void removeArchive()}>Remove import</button></div></Modal>}
    {warningsOpen&&<Modal title="Page notices" onClose={()=>setWarningsOpen(false)}><div className="modal-body">{selected&&captureErrors.has(selected.id)&&<div className="error-card"><strong>Screenshot could not be saved</strong><p>{captureErrors.get(selected.id)}</p><button className="button" disabled={queue.running} onClick={()=>{setWarningsOpen(false);void runCaptures([selected]);}}><Camera size={14}/>Retry capture</button></div>}<ul className="notice-list">{warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></div></Modal>}
    {helpOpen&&<Modal title="Workspace help" onClose={()=>setHelpOpen(false)}><div className="modal-body help-content">
      <section><h3>Import and browse</h3><p>Drop several ZIPs or images anywhere, use the + button, or import one downloadable ZIP/image from a Google Drive share link. Nested ZIPs keep their hierarchy. HTML and Images have separate tabs; HTML resources stay attached behind the scenes. Index pages use their folder names.</p><p><kbd>↑</kbd> <kbd>↓</kbd> or the top arrows cycle through every matching file across folders, including collapsed ones. The last file loops to the first. <kbd>←</kbd> <kbd>→</kbd> control focused tree branches. <kbd>/</kbd> finds a file. Typing fields keep their own arrow keys.</p></section>
      <section><h3>Keep what matters</h3><p>Star a file, filter Favorites, or use Move to folder. Create folders with the sidebar folder-plus button or directly from the move menu. Folders organize references; original paths and linked resources stay intact.</p><p>Download saves original image bytes. For HTML, it downloads a ZIP containing the page’s owning archive and its assets. Source-only HTML and saved PNGs are available in Settings.</p></section>
      <section><h3>Views and screenshots</h3><p>Settings contains preview width, fit, live/screenshot view, and current or batch captures. Gallery shows saved HTML screenshots or your original images. Captures run in the browser while you browse. These are DOM renderings, not server-side Playwright screenshots; remote resources, video, frames, canvas effects, and some CSS may differ.</p></section>
      <section><h3>Saved in this browser</h3><p>Imports, favorites, folders, and screenshots survive a normal refresh. They are not uploaded or synced. Keep your originals: clearing site storage clears this workspace. Imported scripts run in an isolated frame and can still request their external resources.</p><p>Supported images: PNG, JPEG, WebP, GIF, AVIF, SVG, BMP, and ICO. Limits: 256 MB per ZIP, 768 MB extracted per import, 128 MB per file, 20,000 entries, eight nested ZIP levels. Available browser storage limits the total collection. Password-protected ZIPs and server applications are unsupported.</p></section>
    </div></Modal>}
  </div>;
}

