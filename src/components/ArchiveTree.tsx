import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { Camera, ChevronDown, ChevronRight, FileCode2, Image, Folder, FolderOpen, ScanLine, Star, TriangleAlert, X } from 'lucide-react';
import type { FileDateInfo, HtmlPage, ItemKind, ItemOrganization, Snapshot, TreeNode } from '../types';
import { filterTree, favoriteFolderId } from '../tree';
import {flattenVisibleTree,treeWindow,treeRowScroll,TREE_ROW_HEIGHT,TREE_WINDOW_THRESHOLD} from '../tree-window';
import type {TreeRow} from '../tree-window';
import './collection.css';

export interface ArchiveTreeProps {
  nodes: TreeNode[];
  pages: HtmlPage[];
  selectedId: string | null;
  expanded: Set<string>;
  snapshots: Map<string, Snapshot>;
  captureErrors: Map<string, string>;
  query: string;
  preFiltered?: boolean;
  kind?: ItemKind;
  organization?: ReadonlyMap<string, ItemOrganization>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onRemove: (rootId: string) => void;
  favoriteFolders?:ReadonlySet<string>;
  onFavoriteFolder?:(id:string)=>void;
  onOpenFolder?:(id:string)=>void;
  nodeDates?:ReadonlyMap<string,FileDateInfo>;
  showDates?:boolean;
  collectionLabel?:string;
  itemNoun?:string;
  removableFolderIds?:ReadonlySet<string>;
}

export function ArchiveTree({
  nodes, pages, selectedId, expanded, snapshots, captureErrors, query,
  onSelect, onToggle, onRemove, kind='html', organization, preFiltered=false, favoriteFolders, onFavoriteFolder, onOpenFolder, nodeDates, showDates=false, collectionLabel, itemNoun, removableFolderIds,
}: ArchiveTreeProps) {
  const noun=itemNoun??(kind==='image'?'images':'pages');
  const pageMap = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);
  const search = query.trim().toLocaleLowerCase();
  const visible = useMemo(() => preFiltered ? nodes : filterTree(nodes, search, pageMap), [nodes, pageMap, search, preFiltered]);
  const hasVisibleSelection = (branches: TreeNode[]): boolean => branches.some((node) =>
    node.pageId === selectedId || (node.kind !== 'page' && (!!search || expanded.has(node.id)) && hasVisibleSelection(node.children)),
  );
  const selectedIsVisible = !!selectedId && hasVisibleSelection(visible);
  const rows=useMemo(()=>flattenVisibleTree(visible,expanded,!!search),[visible,expanded,search]);
  const virtual=rows.length>TREE_WINDOW_THRESHOLD;
  const treeRef=useRef<HTMLUListElement>(null);
  const [viewport,setViewport]=useState({top:0,height:500});
  const pendingFocus=useRef<string|null>(null);
  const [focusedRowId,setFocusedRowId]=useState<string|null>(null);
  const lastReveal=useRef<{id:string;nodes:TreeNode[]}|null>(null);
  const measure=useCallback(()=>{
    const root=treeRef.current,scroller=root?.closest<HTMLElement>('.sidebar-scroll');
    if(!root||!scroller)return;
    const offset=root.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop;
    const next={top:Math.max(0,scroller.scrollTop-offset),height:scroller.clientHeight};
    setViewport(current=>current.top===next.top&&current.height===next.height?current:next);
  },[]);
  useLayoutEffect(()=>{
    if(!virtual)return;
    const root=treeRef.current,scroller=root?.closest<HTMLElement>('.sidebar-scroll');
    if(!root||!scroller)return;
    measure();scroller.addEventListener('scroll',measure,{passive:true});
    const observer=new ResizeObserver(measure);observer.observe(scroller);
    return()=>{scroller.removeEventListener('scroll',measure);observer.disconnect();};
  },[virtual,measure]);
  const revealRow=useCallback((index:number,focus=false)=>{
    const root=treeRef.current,scroller=root?.closest<HTMLElement>('.sidebar-scroll');
    const row=rows[index];if(!root||!scroller||!row)return;
    const offset=root.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop;
    const relative=Math.max(0,scroller.scrollTop-offset);
    if(focus)pendingFocus.current=row.node.id;
    scroller.scrollTop=offset+treeRowScroll(index,relative,scroller.clientHeight);
    measure();
    if(focus){const target=root.querySelector<HTMLElement>(`[data-tree-node="${CSS.escape(row.node.id)}"]`);if(target){target.focus({preventScroll:true});pendingFocus.current=null;}}
  },[rows,measure]);
  useLayoutEffect(()=>{
    if(!virtual){lastReveal.current=null;return;}
    if(!selectedId||(lastReveal.current?.id===selectedId&&lastReveal.current.nodes===nodes))return;
    const index=rows.findIndex(row=>row.node.pageId===selectedId);
    if(index>=0){revealRow(index,!!treeRef.current?.contains(document.activeElement));lastReveal.current={id:selectedId,nodes};}
  },[virtual,selectedId,nodes,rows,revealRow]);
  const windowed=treeWindow(rows.length,viewport.top,viewport.height);
  const mountedRows=rows.slice(windowed.start,windowed.end).map((row,index)=>({row,index:windowed.start+index}));
  const focusedIndex=focusedRowId?rows.findIndex(row=>row.node.id===focusedRowId):-1;
  if(virtual&&focusedIndex>=0&&(focusedIndex<windowed.start||focusedIndex>=windowed.end))mountedRows.push({row:rows[focusedIndex],index:focusedIndex});
  mountedRows.sort((a,b)=>a.index-b.index);
  const hasTabStop=virtual?mountedRows.some(({row})=>row.node.pageId===selectedId):selectedIsVisible;
  useLayoutEffect(()=>{
    if(!pendingFocus.current)return;
    const target=treeRef.current?.querySelector<HTMLElement>(`[data-tree-node="${CSS.escape(pendingFocus.current)}"]`);
    if(target){target.focus({preventScroll:true});pendingFocus.current=null;}
  },[windowed.start,windowed.end,rows]);
  useEffect(()=>()=>{pendingFocus.current=null;},[]);

  const renderNode = (node: TreeNode, level: number, isFirst = false, flat?:TreeRow, rowIndex?:number): ReactElement => {
    const page = node.pageId ? pageMap.get(node.pageId) : undefined;
    const isPage = node.kind === 'page';
    const isOpen = !!search || expanded.has(node.id);
    const selected = isPage && node.pageId === selectedId;
    const snapshot = node.pageId ? snapshots.get(node.pageId) : undefined;
    const captureError = node.pageId ? captureErrors.get(node.pageId) : undefined;
    const favorite = node.pageId ? organization?.get(node.pageId)?.favorite : false;
    const folderId=favoriteFolderId(node),folderFavorite=!!folderId&&!!favoriteFolders?.has(folderId);
    const dateInfo=showDates?nodeDates?.get(node.id):undefined;
    const date=dateInfo&&Number.isFinite(new Date(dateInfo.timestamp).getTime())?new Date(dateInfo.timestamp):undefined;
    const dateTitle=date&&dateInfo?`${dateInfo.label} · ${new Intl.DateTimeFormat('en',{dateStyle:'full',timeStyle:'long',timeZone:'UTC'}).format(date)}`:'';
    const dateLabel=date?new Intl.DateTimeFormat('en',{day:'numeric',month:'short',year:'2-digit',timeZone:'UTC'}).format(date):'';
    const activate = () => {
      if (isPage && node.pageId) onSelect(node.pageId);
      else if (!isPage) (onOpenFolder??onToggle)(node.id);
    };
    const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
      // Nested items own their keys; Up/Down deliberately reach the app's page navigator.
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        activate();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'ArrowLeft') {
          if (!isPage && isOpen && !search) onToggle(node.id);
          else if(flat?.parentId)revealRow(rows.findIndex(row=>row.node.id===flat.parentId),true);
          else event.currentTarget.parentElement?.closest<HTMLElement>('[role="treeitem"]')?.focus();
        } else if (!isPage) {
          if (!isOpen) onToggle(node.id);
          else if(flat&&node.children.length)revealRow((rowIndex??0)+1,true);
          else event.currentTarget.querySelector<HTMLElement>(':scope > [role="group"] > [role="treeitem"]')?.focus();
        }
      }
    };
    const Icon = isPage ? (itemNoun==='icons'?ScanLine:page?.kind==='image' ? Image : FileCode2) : isOpen ? FolderOpen : Folder;

    return (
      <li
        key={node.id}
        className={`folio-tree-branch${selected ? ' is-selected' : ''}${flat?' folio-tree-virtual-row':''}`}
        style={flat?{top:(rowIndex??0)*TREE_ROW_HEIGHT}:undefined}
        role="treeitem"
        aria-level={level}
        aria-posinset={flat?.position}
        aria-setsize={flat?.setSize}
        aria-selected={isPage ? selected : undefined}
        aria-expanded={!isPage ? isOpen : undefined}
        aria-label={isPage ? `${node.label}${favorite ? ', favorite' : ''}${snapshot ? ', screenshot available' : ''}${captureError ? ', capture failed' : ''}` : `${node.label}${folderFavorite?', favorite folder':''}, ${node.pageCount} ${node.pageCount===1?noun.replace(/s$/,''):noun}`}
        tabIndex={selected || (!hasTabStop && isFirst) ? 0 : -1}
        data-page-id={node.pageId}
        data-tree-node={node.id}
        onKeyDown={onKeyDown}
      >
        <div
          className={`folio-tree-row${isPage ? ' is-page' : ' is-group'}`}
          title={(page?.path ?? node.label)+(dateTitle?' · '+dateTitle:'')}
          style={flat?{paddingLeft:7+(level-1)*16}:undefined}
          onClick={(event) => {
            event.currentTarget.parentElement?.focus({ preventScroll: true });
            activate();
          }}
        >
          {isPage?<span className="folio-tree-disclosure" aria-hidden="true"/>:<button type="button" className="folio-tree-disclosure folio-tree-toggle" aria-label={`${isOpen?'Collapse':'Expand'} ${node.label}`} aria-expanded={isOpen} title={`${isOpen?'Collapse':'Expand'} folder`} onClick={event=>{event.stopPropagation();onToggle(node.id);}} onKeyDown={event=>event.stopPropagation()}>{isOpen?<ChevronDown size={13} aria-hidden="true"/>:<ChevronRight size={13} aria-hidden="true"/>}</button>}
          <Icon className="folio-tree-file-icon" size={15} strokeWidth={1.65} aria-hidden="true" />
          <span className="folio-tree-label">{node.label}</span>
          {date&&<span className="folio-tree-date" title={dateTitle} aria-label={dateTitle} data-date-kind={dateInfo?.kind}>{dateLabel}</span>}
          {favorite && <Star className="folio-tree-favorite" size={12} fill="currentColor" aria-label="File favorite" />}
          {folderId&&onFavoriteFolder&&<button type="button" className={'folio-tree-folder-favorite '+(folderFavorite?'is-favorite':'')} aria-label={`${folderFavorite?'Remove folder favorite':'Favorite folder'}: ${node.label}`} aria-pressed={folderFavorite} title={`${folderFavorite?'Remove folder favorite':'Favorite folder'}: ${node.label}`} data-favorite-folder-id={folderId} onClick={event=>{event.stopPropagation();onFavoriteFolder(folderId);}} onKeyDown={event=>event.stopPropagation()}><Star size={12} fill={folderFavorite?'currentColor':'none'} aria-hidden="true"/></button>}
          {snapshot && <Camera className="folio-tree-camera" size={14} aria-label="Screenshot available" />}
          {!snapshot && captureError && <TriangleAlert className="folio-tree-warning" size={14} aria-label={`Capture failed: ${captureError}`} />}
          {!isPage && <span className="folio-tree-count" aria-hidden="true">{node.pageCount}</span>}
          {((level === 1 && node.kind === 'archive') || (folderId&&removableFolderIds?.has(folderId))) && (
            <button
              type="button"
              className="folio-tree-remove"
              title={`Remove ${node.label}`}
              aria-label={`Remove ${node.label}`}
              onClick={(event) => { event.stopPropagation(); onRemove(node.id); }}
              onKeyDown={(event) => event.stopPropagation()}
            ><X size={13} aria-hidden="true" /></button>
          )}
        </div>
        {!flat && !isPage && isOpen && (
          node.children.length ? (
            <ul className="folio-tree-group" role="group">
              {node.children.map((child) => renderNode(child, level + 1))}
            </ul>
          ) : <div className="folio-tree-empty-archive">{node.kind==='collection'?'Move files here':kind==='image'?'No images':'No HTML pages'}</div>
        )}
      </li>
    );
  };

  if (!nodes.length) return <div className="folio-tree-empty">{itemNoun?`No ${itemNoun} here yet.`:kind==='image'?'No images here yet.':'No HTML pages here yet.'}<span>Import files or change the filter.</span></div>;
  if (!visible.length) return <div className="folio-tree-empty" role="status">No {noun} match “{query.trim()}”.<span>Try a filename or folder name.</span></div>;

  if(virtual)return <ul ref={treeRef} className="folio-tree folio-tree-virtual" style={{height:windowed.height}} role="tree" aria-label={collectionLabel??(kind==='image'?'Images':'HTML pages')} onFocusCapture={event=>setFocusedRowId((event.target as HTMLElement).closest<HTMLElement>('[data-tree-node]')?.dataset.treeNode??null)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setFocusedRowId(null);}}>{mountedRows.map(({row,index},position)=>renderNode(row.node,row.level,position===0,row,index))}</ul>;
  return <ul ref={treeRef} className="folio-tree" role="tree" aria-label={collectionLabel??(kind==='image'?'Images':'HTML pages')}>{visible.map((node, index) => renderNode(node, 1, index === 0))}</ul>;
}
