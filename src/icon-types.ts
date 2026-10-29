import type {RasterMime} from './raster-input';
import type {ConversionMode} from './png-svg';
import type {PngSvgProgress, PngSvgResult} from './png-svg-browser';
import type {ViewOrder} from './order';
import type {ArchiveMeta, HtmlPage, ItemOrganization, TreeNode, WorkspaceFolder} from './types';

export type IconStatus = 'queued' | 'processing' | 'ready' | 'error' | 'cancelled';
export type IconResultMetadata = Omit<PngSvgResult, 'svg'>;

export interface IconLease {
  owner: string;
  token: string;
  expiresAt: number;
}

/** Metadata only: neither the original image nor the generated SVG is hydrated here. */
export interface IconRecord {
  id: string;
  folderId: string;
  name: string;
  sourceName: string;
  /** Absent in older PNG records; source bytes are validated again during conversion. */
  sourceMime?: RasterMime;
  sourcePath: string;
  filename: string;
  size: number;
  lastModified: number;
  createdAt: number;
  updatedAt: number;
  mode: ConversionMode;
  revision: number;
  status: IconStatus;
  message: string;
  favorite: boolean;
  result?: IconResultMetadata;
  claim?: IconLease;
}

export interface IconFolder {
  id: string;
  parentId: string | null;
  name: string;
  createdAt: number;
  favorite: boolean;
}

export interface IconPreferences {
  selectedId: string | null;
  expanded: string[];
  order: ViewOrder;
  /** The default for new imports; existing records retain their own mode. */
  defaultMode: ConversionMode;
  zoom: 'fit' | '1' | '2' | '4';
  background: 'checker' | 'light' | 'dark';
}

export interface IconCollectionSnapshot {
  items: IconRecord[];
  folders: IconFolder[];
  preferences: IconPreferences;
}

export interface IconImportFile {
  file: File;
  /** Relative source path, including the dropped root directory if present. */
  relativePath: string;
  /** Distinguishes separate directory roots, even when their names are equal. */
  rootKey?: string;
}

export interface IconImportDirectory {
  relativePath: string;
  rootKey: string;
}

export interface IconImportBatch {
  files: IconImportFile[];
  directories: IconImportDirectory[];
  notices?: string[];
  skipped?: number;
}

export interface IconImportReport {
  added: IconRecord[];
  folders: IconFolder[];
  skipped: number;
  notices: string[];
}

export interface IconClaim extends IconLease {
  id: string;
  revision: number;
}

export interface IconJob extends IconClaim {
  item: IconRecord;
}

export interface IconTreeProjection {
  tree: TreeNode[];
  pages: HtmlPage[];
  archives: ArchiveMeta[];
  folders: WorkspaceFolder[];
  organization: Map<string, ItemOrganization>;
  favoriteFolders: Set<string>;
}

export interface IconJobProgress extends PngSvgProgress {
  revision: number;
  /** Source preview is allowed only after the engine's native decode validation. */
  sourceValidated: boolean;
}
