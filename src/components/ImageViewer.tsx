import { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { getFile } from '../db';
import type { HtmlPage } from '../types';
import './images.css';

interface ImageResource {
  id: string;
  url?: string;
  bytes?: number;
  error?: string;
}

/** Read only the requested image, and keep its object URL owned by this mount. */
export function useImageResource(id: string, enabled = true): ImageResource {
  const [resource, setResource] = useState<ImageResource>({ id: '' });
  useEffect(() => {
    let disposed = false;
    let ownedUrl: string | undefined;
    setResource({ id });
    if (enabled) {
      void getFile(id).then((file) => {
        if (disposed) return;
        if (!file) throw new Error('This image is no longer in the workspace. Re-import its source file.');
        if (!file.mime.startsWith('image/')) throw new Error('This item is not a supported image.');
        const blob = file.blob.type === file.mime ? file.blob : file.blob.slice(0, file.blob.size, file.mime);
        ownedUrl = URL.createObjectURL(blob);
        setResource({ id, url: ownedUrl, bytes: file.blob.size });
      }).catch((error: unknown) => {
        if (!disposed) setResource({ id, error: error instanceof Error ? error.message : 'Could not read this image.' });
      });
    }
    return () => {
      disposed = true;
      if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    };
  }, [id, enabled]);
  return resource.id === id ? resource : { id };
}

export function imageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ImageViewerProps {
  item: HtmlPage;
  fit: boolean;
}

export function ImageViewer({ item, fit }: ImageViewerProps) {
  const resource = useImageResource(item.id);
  const [decoded, setDecoded] = useState<{ url: string; width?: number; height?: number; error?: string }>({ url: '' });
  const current = decoded.url === resource.url ? decoded : undefined;
  const error = resource.error ?? current?.error;

  return (
    <section className="folio-image-viewer" aria-label={`Image preview: ${item.label}`}>
      <div className={`folio-image-scroll ${fit ? 'is-fit' : 'is-actual'}`}>
        {resource.url && !error && (
          <img
            className="folio-image-original"
            src={resource.url}
            alt={item.label}
            decoding="async"
            onLoad={(event) => setDecoded({ url: resource.url!, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            onError={() => setDecoded({ url: resource.url!, error: 'This browser could not decode the image. You can still download its original file.' })}
          />
        )}
      </div>
      {error ? (
        <div className="folio-image-message" role="status"><AlertCircle size={21} aria-hidden="true" /><strong>Couldn’t open this image</strong><span>{error}</span></div>
      ) : !current?.width ? (
        <div className="folio-image-message" role="status"><LoaderCircle className="folio-image-loading" size={19} aria-hidden="true" /><span>Opening image…</span></div>
      ) : (
        <div className="folio-image-info" aria-label="Image dimensions and file size">
          <span>{current.width} × {current.height}</span><span>{imageBytes(resource.bytes ?? item.size)}</span><span>{fit ? 'Fit' : '100%'}</span>
        </div>
      )}
    </section>
  );
}
