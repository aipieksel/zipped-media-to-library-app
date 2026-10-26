export interface ArchiveMeta {
  id: string;
  rootId: string;
  parentId: string | null;
  mountPath: string;
  name: string;
  createdAt: number;
  fileCount: number;
  pageCount: number;
  imageCount?: number;
  byteSize: number;
  warnings: string[];
}

export interface HtmlPage {
  id: string;
  archiveId: string;
  rootId: string;
  path: string;
  label: string;
  isIndex: boolean;
  size: number;
  /** Missing on original workspaces; those records are HTML pages. */
  kind?: ItemKind;
}

export type ItemKind = 'html' | 'image';
export type WorkspaceItem = HtmlPage;

export interface WorkspaceFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface ItemOrganization {
  id: string;
  favorite: boolean;
  folderId: string | null;
}

export interface ArchiveFile {
  id: string;
  archiveId: string;
  path: string;
  blob: Blob;
  mime: string;
}

export interface Snapshot {
  pageId: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
  warnings: string[];
}

export interface ImportBundle {
  archives: ArchiveMeta[];
  pages: HtmlPage[];
  files: ArchiveFile[];
}

export interface TreeNode {
  id: string;
  label: string;
  kind: 'archive' | 'folder' | 'collection' | 'page';
  archiveId: string;
  folderId?: string;
  pageId?: string;
  children: TreeNode[];
  pageCount: number;
}

export interface ImportLimits {
  maxCompressedBytes: number;
  maxExpandedBytes: number;
  maxEntryBytes: number;
  maxFiles: number;
  maxDepth: number;
}
