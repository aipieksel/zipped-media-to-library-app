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
  cloud?: { manifest: string; generation: string };
  modifiedAt?: number;
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
  modifiedAt?: number;
  dateSource?: 'file' | 'library' | 'imported';
  /** Source creation date, only when supplied by the source. */
  createdAt?: number;
  /** Time this file was added to the workspace. */
  addedAt?: number;
  imageHash?: string;
  mime?: string;
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

interface ArchiveFileBase {
  id: string;
  archiveId: string;
  path: string;
  mime: string;
}

export interface LocalArchiveFile extends ArchiveFileBase {
  blob: Blob;
  remote?: undefined;
}

export interface RemoteArchiveFile extends ArchiveFileBase {
  blob?: undefined;
  remote: { archiveId: string; path: string; size: number; sha256: string };
}

export type ArchiveFile = LocalArchiveFile | RemoteArchiveFile;

export interface CloudFileDescriptor {
  id: string; archiveId: string; path: string; mime: string; size: number; sha256: string;
  slices: { hash: string; offset: number; length: number }[];
}

export interface CloudCatalogue {
  schema: 1;
  generation: string;
  archives: ArchiveMeta[];
  pages: HtmlPage[];
  manifests: Record<string, string>;
  images?: Record<string, ImageRendition>;
  stats?: { packages?: number; html?: number; images?: number; [key: string]: number | undefined };
}

export interface ImageRendition {
  width?: number;
  height?: number;
  placeholder?: string;
  thumbnail?: string;
  preview?: string;
  thumbnailBytes?: number;
  previewBytes?: number;
  animated?: boolean;
  original: { archiveId: string; path: string; mime: string; size: number };
}

export interface Snapshot {
  pageId: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
  warnings: string[];
}

/** Disposable small gallery previews; full user-requested screenshots remain separate. */
export interface GalleryThumbnail {
  key: string;
  pageId: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
  lastUsedAt: number;
}

export interface ImportBundle {
  archives: ArchiveMeta[];
  pages: HtmlPage[];
  files: LocalArchiveFile[];
}

export interface TreeNode {
  id: string;
  label: string;
  kind: 'archive' | 'folder' | 'collection' | 'page';
  archiveId: string;
  folderId?: string;
  pageId?: string;
  /** Canonical folder identity retained when its only index page is collapsed. */
  sourceFolderId?: string;
  children: TreeNode[];
  pageCount: number;
}

export interface FileDateInfo {
  timestamp: number;
  kind: 'modified' | 'created' | 'source' | 'added';
  label: string;
}

export interface ImportLimits {
  maxCompressedBytes: number;
  maxExpandedBytes: number;
  maxEntryBytes: number;
  maxFiles: number;
  maxDepth: number;
}
