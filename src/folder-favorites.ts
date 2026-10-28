import {buildOrganizedTree, favoriteFolderId} from './tree';
import type {ArchiveMeta, HtmlPage, ItemOrganization, TreeNode, WorkspaceFolder} from './types';

export function normalizeFolderFavorites(value: unknown): Set<string> {
  return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 8192) : []);
}

/** Accept actual display identities in either tab, including collapsed index-folder aliases. */
export function hasFavoriteFolder(id: string, archives: ArchiveMeta[], items: HtmlPage[], folders: WorkspaceFolder[], organization: ReadonlyMap<string, ItemOrganization>): boolean {
  const contains = (nodes: TreeNode[]): boolean => nodes.some(node => favoriteFolderId(node) === id || contains(node.children));
  return contains(buildOrganizedTree(archives,items,folders,organization,'html')) || contains(buildOrganizedTree(archives,items,folders,organization,'image'));
}

export function removeArchiveFolderFavorites(value: unknown, archiveIds: readonly string[]): string[] {
  return [...normalizeFolderFavorites(value)].filter(id => !archiveIds.some(archiveId => id === archiveId || id.startsWith(`${archiveId}::folder::`)));
}

/** The preview target uses exactly the current filtered, sorted tree, never storage order. */
export function firstFolderPage(tree: readonly TreeNode[], folderId: string): string | undefined {
  const first = (node: TreeNode): string | undefined => {
    if (node.kind === 'page') return node.pageId;
    for (const child of node.children) {const id=first(child);if(id)return id;}
    return undefined;
  };
  const find = (nodes: readonly TreeNode[]): string | undefined => {
    for (const node of nodes) {
      if (node.id === folderId || node.sourceFolderId === folderId) return first(node);
      const id=find(node.children);if(id)return id;
    }
    return undefined;
  };
  return find(tree);
}
