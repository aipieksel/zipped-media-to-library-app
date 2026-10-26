import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Image as ImageIcon, Star } from 'lucide-react';
import type { ArchiveMeta, HtmlPage, ItemOrganization } from '../types';
import { imageBytes, useImageResource } from './ImageViewer';
import './images.css';

export interface ImageGalleryProps {
  items: HtmlPage[];
  archives: ArchiveMeta[];
  organization: ReadonlyMap<string, ItemOrganization>;
  onOpen: (id: string) => void;
  onFavorite: (id: string) => void;
}

type ObserveCard = (element: Element, onVisible: () => void) => () => void;

/** A single observer delays Blob reads until cards approach the visible scroll area. */
function useCardObserver(): ObserveCard {
  const observer = useRef<IntersectionObserver | null>(null);
  const callbacks = useRef(new Map<Element, () => void>());
  const observe = useCallback<ObserveCard>((element, onVisible) => {
    if (typeof IntersectionObserver === 'undefined') {
      onVisible();
      return () => undefined;
    }
    if (!observer.current) {
      observer.current = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const callback = callbacks.current.get(entry.target);
          callbacks.current.delete(entry.target);
          observer.current?.unobserve(entry.target);
          callback?.();
        }
      }, { rootMargin: '240px 0px' });
    }
    callbacks.current.set(element, onVisible);
    observer.current.observe(element);
    return () => {
      callbacks.current.delete(element);
      observer.current?.unobserve(element);
    };
  }, []);
  useEffect(() => () => {
    observer.current?.disconnect();
    observer.current = null;
    callbacks.current.clear();
  }, []);
  return observe;
}

function ImageCard({ item, archive, favorite, observe, onOpen, onFavorite }: {
  item: HtmlPage;
  archive: string;
  favorite: boolean;
  observe: ObserveCard;
  onOpen: ImageGalleryProps['onOpen'];
  onFavorite: ImageGalleryProps['onFavorite'];
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [decodeFailed, setDecodeFailed] = useState(false);
  const resource = useImageResource(item.id, visible);
  useEffect(() => {
    if (!ref.current) return;
    return observe(ref.current, () => setVisible(true));
  }, [observe, item.id]);
  const failed = Boolean(resource.error) || decodeFailed;
  const source = `${archive} / ${item.path}`;

  return (
    <article ref={ref} className="folio-image-card">
      <button className="folio-image-thumbnail" type="button" onClick={() => onOpen(item.id)} aria-label={`Open image ${item.label}`}>
        {resource.url && !failed ? (
          <img src={resource.url} alt={item.label} loading="lazy" decoding="async" onError={() => setDecodeFailed(true)} />
        ) : failed ? (
          <span className="folio-image-thumbnail-state"><AlertCircle size={21} aria-hidden="true" /><span>Preview unavailable</span></span>
        ) : <ImageIcon size={24} strokeWidth={1.3} aria-hidden="true" />}
      </button>
      <div className="folio-image-card-meta">
        <button className="folio-image-card-name" type="button" title={item.label} onClick={() => onOpen(item.id)}>{item.label}</button>
        <button className={`folio-image-favorite ${favorite ? 'is-favorite' : ''}`} type="button" aria-label={`${favorite ? 'Remove' : 'Add'} ${item.label} ${favorite ? 'from' : 'to'} favorites`} aria-pressed={favorite} onClick={() => onFavorite(item.id)}><Star size={14} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" /></button>
        <p className="folio-image-card-path" title={source}>{source}</p>
        <span className="folio-image-card-bytes">{imageBytes(item.size)}</span>
      </div>
    </article>
  );
}

export function ImageGallery({ items, archives, organization, onOpen, onFavorite }: ImageGalleryProps) {
  const archiveMap = useMemo(() => new Map(archives.map((archive) => [archive.id, archive.name])), [archives]);
  const observe = useCardObserver();
  return (
    <section className="folio-image-gallery" aria-label="Image gallery">
      {items.length ? (
        <div className="folio-image-grid">
          {items.map((item) => <ImageCard key={item.id} item={item} archive={archiveMap.get(item.archiveId) ?? 'Archive'} favorite={organization.get(item.id)?.favorite ?? false} observe={observe} onOpen={onOpen} onFavorite={onFavorite} />)}
        </div>
      ) : <p className="folio-image-gallery-empty">No images in this view. Import an image or a ZIP, or adjust the current filters.</p>}
    </section>
  );
}
