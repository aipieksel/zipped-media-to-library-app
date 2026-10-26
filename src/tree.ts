import type { ArchiveMeta, HtmlPage, ItemKind, ItemOrganization, TreeNode, WorkspaceFolder } from './types';

const natural = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** A projection of canonical page IDs; hidden assets never become navigation nodes. */
export function buildTree(archives: ArchiveMeta[], pages: HtmlPage[]): TreeNode[] {
  const archiveMap = new Map(archives.map(archive => [archive.id, archive]));
  const pageMap = new Map(pages.map(page => [page.id, page]));
  const nodes = new Map<string, TreeNode>();
  const folderPaths = new Map<string, string>();
  const folderMaps = new Map<string, Map<string, TreeNode>>();
  const roots: TreeNode[] = [];
  for (const archive of archives) {
    nodes.set(archive.id, {
      id: archive.id, archiveId: archive.id, label: archive.name, kind: 'archive', children: [], pageCount: 0,
    });
    folderMaps.set(archive.id, new Map());
  }

  const folderAt = (archiveId: string, segments: string[]): TreeNode => {
    let current = nodes.get(archiveId)!;
    const folders = folderMaps.get(archiveId)!;
    let path = '';
    for (const segment of segments) {
      path = path ? `${path}/${segment}` : segment;
      let folder = folders.get(path);
      if (!folder) {
        folder = { id: `${archiveId}::folder::${path}`, label: segment, kind: 'folder', archiveId, children: [], pageCount: 0 };
        folders.set(path, folder);
        folderPaths.set(folder.id, path);
        current.children.push(folder);
      }
      current = folder;
    }
    return current;
  };

  for (const archive of archives) {
    const node = nodes.get(archive.id)!;
    if (archive.parentId && archiveMap.has(archive.parentId)) {
      folderAt(archive.parentId, archive.mountPath.split('/').filter(Boolean).slice(0, -1)).children.push(node);
    } else roots.push(node);
  }
  for (const page of pages) {
    if (!nodes.has(page.archiveId)) continue;
    folderAt(page.archiveId, page.path.split('/').slice(0, -1)).children.push({
      id: page.id, pageId: page.id, archiveId: page.archiveId, label: page.label, kind: 'page', children: [], pageCount: 1,
    });
  }

  const tidy = (node: TreeNode): TreeNode => {
    node.children = node.children.map(tidy).sort((a, b) => {
      const aIndex = a.kind === 'page' && Boolean(pageMap.get(a.pageId!)?.isIndex);
      const bIndex = b.kind === 'page' && Boolean(pageMap.get(b.pageId!)?.isIndex);
      return Number(bIndex) - Number(aIndex) || natural.compare(a.label, b.label) || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0);
    });
    if (node.kind !== 'page') node.pageCount = node.children.reduce((count, child) => count + child.pageCount, 0);
    if (node.kind === 'folder' && node.children.length === 1 && node.children[0].kind === 'page') {
      const child = node.children[0];
      const page = pageMap.get(child.pageId!);
      if (page?.isIndex && page.path.split('/').slice(0, -1).join('/') === folderPaths.get(node.id)) {
        return { ...child, label: node.label };
      }
    }
    return node;
  };
  // Top-level order is import order. Within each import, index-first natural order is stable.
  return roots.map(tidy);
}

/** One identity-preserving projection for kind tabs, favorites, navigation, and galleries. */
export function buildOrganizedTree(
  archives: ArchiveMeta[],
  items: HtmlPage[],
  folders: WorkspaceFolder[],
  organization: ReadonlyMap<string, ItemOrganization>,
  kind: ItemKind,
  favoritesOnly = false,
): TreeNode[] {
  const folderIds = new Set(folders.map(folder => folder.id));
  const available = items.filter(item => (item.kind ?? 'html') === kind && (!favoritesOnly || organization.get(item.id)?.favorite));
  const assigned = new Map<string, HtmlPage[]>();
  const unassigned: HtmlPage[] = [];
  for (const item of available) {
    const folderId = organization.get(item.id)?.folderId;
    if (folderId && folderIds.has(folderId)) {
      const group = assigned.get(folderId) ?? [];
      group.push(item);
      assigned.set(folderId, group);
    } else unassigned.push(item);
  }
  const collections: TreeNode[] = folders.map(folder => ({
    id: folder.id, folderId: folder.id, archiveId: '', label: folder.name, kind: 'collection',
    children: (assigned.get(folder.id) ?? []).sort((a, b) => natural.compare(a.label, b.label) || natural.compare(a.path, b.path) || a.id.localeCompare(b.id)).map(item => ({
      id: item.id, pageId: item.id, archiveId: item.archiveId, label: item.label, kind: 'page', children: [], pageCount: 1,
    })),
    pageCount: assigned.get(folder.id)?.length ?? 0,
  }));
  const prune = (nodes: TreeNode[]): TreeNode[] => nodes.flatMap(node => {
    if (node.kind === 'page') return [node];
    const children = prune(node.children);
    return children.length ? [{ ...node, children, pageCount: children.reduce((count, child) => count + child.pageCount, 0) }] : [];
  });
  // Empty user folders remain usable; archive groups without items in this view do not consume space.
  return [...collections, ...prune(buildTree(archives, unassigned))];
}

export function getPageOrder(tree: TreeNode[]): string[] {
  const result: string[] = [];
  const visit = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'page' && node.pageId) result.push(node.pageId);
      visit(node.children);
    }
  };
  visit(tree);
  return result;
}

/** Search the same projection for the tree, keyboard order, gallery, and capture queue. */
export function filterTree(tree: TreeNode[], query: string, pagesById: ReadonlyMap<string, HtmlPage>): TreeNode[] {
  const search = query.trim().toLocaleLowerCase();
  if (!search) return tree;
  const visit = (nodes: TreeNode[]): TreeNode[] => nodes.flatMap((node) => {
    if (node.kind === 'page') {
      const page = node.pageId ? pagesById.get(node.pageId) : undefined;
      return `${node.label} ${page?.path ?? ''}`.toLocaleLowerCase().includes(search) ? [node] : [];
    }
    // Matching an archive or folder includes every HTML page below it, including nested ZIPs.
    if (node.label.toLocaleLowerCase().includes(search)) return [node];
    const children = visit(node.children);
    return children.length ? [{ ...node, children, pageCount: children.reduce((count, child) => count + child.pageCount, 0) }] : [];
  });
  return visit(tree);
}

export function getAncestorIds(tree: TreeNode[], pageId: string): string[] {
  const search = (nodes: TreeNode[], parents: string[]): string[] | undefined => {
    for (const node of nodes) {
      if (node.kind === 'page' && node.pageId === pageId) return parents;
      const result = search(node.children, [...parents, node.id]);
      if (result) return result;
    }
    return undefined;
  };
  return search(tree, []) ?? [];
}
