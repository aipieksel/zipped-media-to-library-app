import {useEffect, useId, useRef} from 'react';
import type {ReactNode} from 'react';
import {X} from 'lucide-react';

/** The workspace's native dialog, shared by imports, settings and AI review. */
export function Modal({title, children, onClose, className = ''}: {title: string; children: ReactNode; onClose: () => void; className?: string}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const element = ref.current;
    element?.showModal();
    const frame = requestAnimationFrame(() => element?.querySelector<HTMLElement>('input,select,[role="tab"][aria-selected="true"]')?.focus());
    return () => {
      cancelAnimationFrame(frame); element?.close();
      if (previous?.isConnected && previous !== document.body && !previous.matches(':disabled')) previous.focus();
      else document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    };
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby={titleId} onCancel={event => {event.preventDefault(); onClose();}} onClick={event => {if (event.target === ref.current) onClose();}}>
    <div className="modal-header"><h2 id={titleId}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={16}/></button></div>
    {children}
  </dialog>;
}
