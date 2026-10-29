import JSZip from 'jszip';

export interface SvgDownloadEntry {
  filename: string;
  svg: string;
}

/** Build a local archive without altering the names already shown in individual downloads. */
export async function buildSvgZip(entries: SvgDownloadEntry[]): Promise<Blob> {
  if (!entries.length) throw new Error('There are no converted SVG files to download.');
  const zip = new JSZip();
  const names = new Set<string>();
  for (const entry of entries) {
    const name = entry.filename;
    const key = name.normalize('NFC').toLowerCase();
    if (!name || /[<>:"/\\|?*\u0000-\u001f\u007f-\u009f]/.test(name) || /[. ]$/.test(name) ||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ||
      !/\.svg$/i.test(name) || names.has(key)) {
      throw new Error('SVG download names must be unique, safe filenames. Re-import the affected icons.');
    }
    names.add(key);
    zip.file(name, entry.svg, { createFolders: false });
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 3 }, streamFiles: true });
}
