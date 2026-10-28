import JSZip from 'jszip';
import { resolveFileBlob } from './cloud';
import { getArchiveFiles, getFile } from './db';
import type { HtmlPage } from './types';

function safeFilename(name: string, fallback: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_').replace(/[. ]+$/g, '').trim() || fallback;
}

export interface PreparedDownload { blob: Blob; filename: string }

/** Images keep their original bytes; HTML exports include the owning archive's resources. */
export async function downloadWorkspaceItem(item: HtmlPage): Promise<PreparedDownload> {
  if (item.kind === 'image') {
    const file = await getFile(item.id);
    if (!file) throw new Error('This image is no longer in the workspace.');
    return { blob: file.blob, filename: safeFilename(item.path.split('/').at(-1) ?? item.label, 'image') };
  }
  const files = await getArchiveFiles(item.archiveId);
  if (!files.has(item.path)) throw new Error('This HTML page is no longer in the workspace.');
  const zip = new JSZip();
  for (const file of files.values()) zip.file(file.path, await resolveFileBlob(file), { createFolders: true });
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 3 }, streamFiles: true });
  const base = safeFilename(item.label.replace(/\.html?$/i, ''), 'html-page');
  return { blob, filename: `${base}-resources.zip` };
}

/** Explicit source-only export; linked files remain in the primary resources ZIP. */
export async function downloadHtmlSource(item: HtmlPage): Promise<PreparedDownload> {
  if (item.kind === 'image') throw new Error('Source-only HTML download is available for HTML pages.');
  const file = await getFile(item.id);
  if (!file) throw new Error('This HTML page is no longer in the workspace.');
  return { blob: file.blob, filename: safeFilename(item.path.split('/').at(-1) ?? item.label, 'index.html') };
}
