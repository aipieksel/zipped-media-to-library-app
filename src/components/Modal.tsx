import {useEffect, useId, useRef} from 'react';
import type {ReactNode} from 'react';
import {X} from 'lucide-react';
import {isFolioSelectPopupOpen} from './PopoverSelect';

function canFocus(element: HTMLElement) {
  return element.isConnected && !element.matches(':disabled') && element.getClientRects().length > 0 &&
    !element.closest('[inert]') && getComputedStyle(element).visibility !== 'hidden';
}

/** The workspace's native dialog, shared by imports, capture and AI review. */
export function Modal({title, children, onClose, className = ''}: {title: string; children: ReactNode; onClose: () => void; className?: string}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const element = ref.current;
    element?.showModal();
    const frame = requestAnimationFrame(() => {
      const controls = element?.querySelectorAll<HTMLElement>('input:not([type="hidden"]):not(:disabled),textarea:not(:disabled),[data-folio-select-trigger]:not(:disabled),[role="tab"][aria-selected="true"]');
      const first = controls && Array.from(controls).find(canFocus);
      (first ?? element?.querySelector<HTMLElement>('button:not(:disabled)'))?.focus();
    });
    return () => {
      cancelAnimationFrame(frame); element?.close();
      if (previous && previous !== document.body && canFocus(previous)) previous.focus();
      else Array.from(document.querySelectorAll<HTMLElement>('[data-workspace-switcher],[data-folio-select-trigger]:not(:disabled),.mobile-menu')).find(canFocus)?.focus();
    };
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby={titleId} onCancel={event => {event.preventDefault(); if (!isFolioSelectPopupOpen(ref.current ?? undefined)) onClose();}} onClick={event => {if (event.target === ref.current) onClose();}}>
    <div className="modal-header"><h2 id={titleId}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={16}/></button></div>
    {children}
  </dialog>;
}
