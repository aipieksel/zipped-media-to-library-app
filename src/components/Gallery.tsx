import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Camera, FileCode2, Image as ImageIcon } from 'lucide-react';
import type { ArchiveMeta, HtmlPage, Snapshot } from '../types';
import './collection.css';

export interface GalleryProps {
  pages: HtmlPage[];
  archives: ArchiveMeta[];
  snapshots: Map<string, Snapshot>;
  query: string;
  onOpen: (id: string, mode: 'live' | 'snapshot') => void;
  onCaptureMissing: () => void;
  busy: boolean;
}

function useSnapshotUrl(blob: Blob) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

function ScreenshotCard({ page, snapshot, archive, onOpen }: {
  page: HtmlPage;
  snapshot: Snapshot;
  archive: string;
  onOpen: GalleryProps['onOpen'];
}) {
  const imageUrl = useSnapshotUrl(snapshot.blob);
  const location = `${archive} / ${page.path}`;
  return (
    <article className="folio-gallery-card">
      <button type="button" className="folio-gallery-preview" aria-label={`View screenshot of ${page.label}`} onClick={() => onOpen(page.id, 'snapshot')}>
        {imageUrl && <img src={imageUrl} alt={`Saved screenshot of ${page.label}`} loading="lazy" decoding="async" />}
        <span className="folio-gallery-preview-hint"><ImageIcon size={14} aria-hidden="true" />View screenshot</span>
      </button>
      <div className="folio-gallery-card-body">
        <div className="folio-gallery-card-title"><FileCode2 size={15} aria-hidden="true" /><h3 title={page.label}>{page.label}</h3></div>
        <p className="folio-gallery-breadcrumb" title={location}>{location}</p>
        <div className="folio-gallery-card-footer">
          <span className="folio-gallery-dimensions">{snapshot.width} × {snapshot.height}</span>
          <button type="button" className="folio-gallery-open" aria-label={`Open HTML for ${page.label}`} onClick={() => onOpen(page.id, 'live')}>Open HTML<ArrowUpRight size={14} aria-hidden="true" /></button>
        </div>
      </div>
    </article>
  );
}

export function Gallery({ pages, archives, snapshots, query, onOpen, onCaptureMissing, busy }: GalleryProps) {
  const archiveMap = useMemo(() => new Map(archives.map((archive) => [archive.id, archive])), [archives]);
  const search = query.trim().toLocaleLowerCase();
  // Pages are already filtered by the shared archive/folder tree projection.
  const captured = pages.filter((page) => snapshots.has(page.id));
  const missing = pages.length - captured.length;

  return (
    <section className="folio-gallery" aria-label="Screenshot gallery">
      <header className="folio-gallery-header">
        <div>
          <h2>Screenshot gallery</h2>
          <p>{captured.length ? `${captured.length} saved ${captured.length === 1 ? 'preview' : 'previews'}${missing ? ` · ${missing} ${missing === 1 ? 'page' : 'pages'} to capture` : ' · All pages captured'}` : 'A visual index of your HTML pages.'}</p>
        </div>
        {!!pages.length && <button type="button" className="folio-gallery-capture" disabled={busy} onClick={onCaptureMissing}><Camera size={15} aria-hidden="true" />{busy ? 'Capturing…' : missing ? `Capture ${missing} missing` : 'Capture pages'}</button>}
      </header>
      {!captured.length ? (
        <div className="folio-gallery-empty">
          <span className="folio-gallery-empty-icon"><ImageIcon size={29} strokeWidth={1.4} aria-hidden="true" /></span>
          <h3>{search ? 'No matching screenshots yet' : 'Your pages, at a glance.'}</h3>
          <p>{search ? (pages.length ? `Capture the pages matching “${query.trim()}” to see them here.` : `No HTML pages match “${query.trim()}”. Try another filename or clear the search.`) : pages.length ? 'Capture your pages to browse them side by side. Each screenshot links straight back to its HTML.' : 'Import a ZIP, then capture its pages to build your visual index.'}</p>
          {!!pages.length && <button type="button" className="folio-gallery-capture" disabled={busy} onClick={onCaptureMissing}><Camera size={15} aria-hidden="true" />{busy ? 'Capturing…' : 'Capture all pages'}</button>}
        </div>
      ) : (
        <div className="folio-gallery-grid">
          {captured.map((page) => <ScreenshotCard key={page.id} page={page} snapshot={snapshots.get(page.id)!} archive={archiveMap.get(page.archiveId)?.name ?? 'Archive'} onOpen={onOpen} />)}
        </div>
      )}
    </section>
  );
}
