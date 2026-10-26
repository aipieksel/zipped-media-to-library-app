import { useMemo } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { Camera, ChevronDown, ChevronRight, FileCode2, Image, Folder, FolderOpen, Star, TriangleAlert, X } from 'lucide-react';
import type { HtmlPage, ItemKind, ItemOrganization, Snapshot, TreeNode } from '../types';
import { filterTree } from '../tree';
import './collection.css';

export interface ArchiveTreeProps {
  nodes: TreeNode[];
  pages: HtmlPage[];
  selectedId: string | null;
  expanded: Set<string>;
  snapshots: Map<string, Snapshot>;
  captureErrors: Map<string, string>;
  query: string;
  kind?: ItemKind;
  organization?: ReadonlyMap<string, ItemOrganization>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onRemove: (rootId: string) => void;
}

export function ArchiveTree({
  nodes, pages, selectedId, expanded, snapshots, captureErrors, query,
  onSelect, onToggle, onRemove, kind='html', organization,
}: ArchiveTreeProps) {
  const pageMap = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);
  const search = query.trim().toLocaleLowerCase();
  const visible = useMemo(() => filterTree(nodes, search, pageMap), [nodes, pageMap, search]);
  const hasVisibleSelection = (branches: TreeNode[]): boolean => branches.some((node) =>
    node.pageId === selectedId || (node.kind !== 'page' && (!!search || expanded.has(node.id)) && hasVisibleSelection(node.children)),
  );
  const selectedIsVisible = !!selectedId && hasVisibleSelection(visible);

  const renderNode = (node: TreeNode, level: number, isFirst = false): ReactElement => {
    const page = node.pageId ? pageMap.get(node.pageId) : undefined;
    const isPage = node.kind === 'page';
    const isOpen = !!search || expanded.has(node.id);
    const selected = isPage && node.pageId === selectedId;
    const snapshot = node.pageId ? snapshots.get(node.pageId) : undefined;
    const captureError = node.pageId ? captureErrors.get(node.pageId) : undefined;
    const favorite = node.pageId ? organization?.get(node.pageId)?.favorite : false;
    const activate = () => {
      if (isPage && node.pageId) onSelect(node.pageId);
      else if (!isPage) onToggle(node.id);
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
          else event.currentTarget.parentElement?.closest<HTMLElement>('[role="treeitem"]')?.focus();
        } else if (!isPage) {
          if (!isOpen) onToggle(node.id);
          else event.currentTarget.querySelector<HTMLElement>(':scope > [role="group"] > [role="treeitem"]')?.focus();
        }
      }
    };
    const Icon = isPage ? (page?.kind==='image' ? Image : FileCode2) : isOpen ? FolderOpen : Folder;

    return (
      <li
        key={node.id}
        className={`folio-tree-branch${selected ? ' is-selected' : ''}`}
        role="treeitem"
        aria-level={level}
        aria-selected={isPage ? selected : undefined}
        aria-expanded={!isPage ? isOpen : undefined}
        aria-label={isPage ? `${node.label}${favorite ? ', favorite' : ''}${snapshot ? ', screenshot available' : ''}${captureError ? ', capture failed' : ''}` : `${node.label}, ${node.pageCount} ${kind==='image'?(node.pageCount===1?'image':'images'):(node.pageCount===1?'page':'pages')}`}
        tabIndex={selected || (!selectedIsVisible && isFirst) ? 0 : -1}
        data-page-id={node.pageId}
        data-tree-node={node.id}
        onKeyDown={onKeyDown}
      >
        <div
          className={`folio-tree-row${isPage ? ' is-page' : ' is-group'}`}
          title={page?.path ?? node.label}
          onClick={(event) => {
            event.currentTarget.parentElement?.focus({ preventScroll: true });
            activate();
          }}
        >
          <span className="folio-tree-disclosure" aria-hidden="true">
            {!isPage && (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
          </span>
          <Icon className="folio-tree-file-icon" size={15} strokeWidth={1.65} aria-hidden="true" />
          <span className="folio-tree-label">{node.label}</span>
          {favorite && <Star className="folio-tree-favorite" size={12} fill="currentColor" aria-label="Favorite" />}
          {snapshot && <Camera className="folio-tree-camera" size={14} aria-label="Screenshot available" />}
          {!snapshot && captureError && <TriangleAlert className="folio-tree-warning" size={14} aria-label={`Capture failed: ${captureError}`} />}
          {!isPage && <span className="folio-tree-count" aria-hidden="true">{node.pageCount}</span>}
          {level === 1 && node.kind === 'archive' && (
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
        {!isPage && isOpen && (
          node.children.length ? (
            <ul className="folio-tree-group" role="group">
              {node.children.map((child) => renderNode(child, level + 1))}
            </ul>
          ) : <div className="folio-tree-empty-archive">{node.kind==='collection'?'Move files here':kind==='image'?'No images':'No HTML pages'}</div>
        )}
      </li>
    );
  };

  if (!nodes.length) return <div className="folio-tree-empty">{kind==='image'?'No images here yet.':'No HTML pages here yet.'}<span>Import files or change the filter.</span></div>;
  if (!visible.length) return <div className="folio-tree-empty" role="status">No pages match “{query.trim()}”.<span>Try a filename or folder name.</span></div>;

  return <ul className="folio-tree" role="tree" aria-label={kind==='image'?'Images by folder':'HTML pages by folder'}>{visible.map((node, index) => renderNode(node, 1, index === 0))}</ul>;
}
