import {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react';
import type {AriaAttributes, KeyboardEvent, ReactNode, SyntheticEvent} from 'react';
import {Select} from '@base-ui/react/select';
import {Check, ChevronDown} from 'lucide-react';
import './popover-select.css';

export interface PopoverSelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
  count?: number;
}

export interface PopoverSelectProps extends AriaAttributes {
  value: string | number;
  onValueChange: (value: string) => void;
  options: readonly PopoverSelectOption[];
  /** Accessible name when an explicit aria-label is not supplied. */
  label?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  title?: string;
}

/** App-level capture handlers must yield before a nested select handles keys. */
export function isFolioSelectPopupOpen(root?: ParentNode): boolean {
  const scope = root ?? (typeof document === 'undefined' ? undefined : document);
  return !!scope?.querySelector('[data-folio-select-trigger][aria-expanded="true"]');
}

/** Includes portaled options, which are outside an App-owned popover's DOM tree. */
export function isFolioSelectEvent(event: Event | SyntheticEvent): boolean {
  const native = 'nativeEvent' in event ? event.nativeEvent : event;
  const path = typeof native.composedPath === 'function' ? native.composedPath() : [event.target];
  return path.some(target => typeof Element !== 'undefined' && target instanceof Element &&
    !!target.closest('[data-folio-select-trigger],[data-folio-select-popup]'));
}

function stopWorkspaceShortcuts(event: KeyboardEvent<HTMLElement>) {
  // Let Base UI handle navigation, typeahead and dismissal before the event can
  // reach the library's Arrow/Home/End or search shortcuts. Do not cancel Tab.
  event.stopPropagation();
}

/** Folio's single-value dropdown. Native dialogs retain their own portal tree. */
export const PopoverSelect = forwardRef<HTMLButtonElement, PopoverSelectProps>(function PopoverSelect({
  value, onValueChange, options, label, name, id, disabled = false, className = '',
  placeholder = 'Choose…', title, 'aria-label': ariaLabel, ...ariaProps
}, forwardedRef) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState(false);
  const stringValue = String(value);
  const selected = options.find(option => String(option.value) === stringValue);
  const setTrigger = useCallback((element: HTMLButtonElement | null) => {
    trigger.current = element;
    setPortalContainer(element?.closest('dialog') ?? null);
  }, []);
  useImperativeHandle(forwardedRef, () => trigger.current!, []);
  useEffect(() => {if (disabled) setOpen(false);}, [disabled]);

  return <Select.Root<string>
    value={stringValue}
    items={options.map(option => ({value: String(option.value), label: option.label}))}
    name={name}
    id={id}
    disabled={disabled}
    modal={false}
    open={open && !disabled}
    onOpenChange={setOpen}
    onValueChange={(next, details) => {
      const option = options.find(item => String(item.value) === next);
      // Browsing and closed-trigger typeahead must not launch a conversion or
      // change workspace. Pointer/keyboard item activation is the commit point.
      if (disabled || next === null || !option || option.disabled || details.reason !== 'item-press') {
        details.cancel();
        return;
      }
      if (next !== stringValue) onValueChange(next);
    }}
  >
    <Select.Trigger
      {...ariaProps}
      ref={setTrigger}
      className={`folio-select-trigger ${className}`.trim()}
      aria-label={ariaLabel ?? label}
      title={title}
      data-folio-select-trigger=""
      data-value={stringValue}
      onKeyDown={stopWorkspaceShortcuts}
    >
      {selected?.icon && <span className="folio-select-option-icon" aria-hidden="true">{selected.icon}</span>}
      <Select.Value className="folio-select-value">{selected?.label ?? placeholder}</Select.Value>
      {selected?.count !== undefined && <span className="folio-select-count" aria-hidden="true">{selected.count.toLocaleString()}</span>}
      <Select.Icon className="folio-select-chevron"><ChevronDown size={13} aria-hidden="true"/></Select.Icon>
    </Select.Trigger>
    <Select.Portal container={portalContainer}>
      <Select.Positioner className="folio-select-positioner" side="bottom" align="start" sideOffset={5} collisionPadding={8} alignItemWithTrigger={false} positionMethod="fixed">
        <Select.Popup className="folio-select-popup" data-folio-select-popup="" onKeyDown={stopWorkspaceShortcuts}>
          <Select.List className="folio-select-list">
            {options.map(option => <Select.Item
              key={String(option.value)}
              className="folio-select-option"
              value={String(option.value)}
              label={option.label}
              disabled={option.disabled}
            >
              <span className="folio-select-option-content">
                {option.icon && <span className="folio-select-option-icon" aria-hidden="true">{option.icon}</span>}
                <Select.ItemText className="folio-select-option-label">{option.label}</Select.ItemText>
              </span>
              {option.count !== undefined && <span className="folio-select-count" aria-hidden="true">{option.count.toLocaleString()}</span>}
              <span className="folio-select-check" aria-hidden="true"><Select.ItemIndicator><Check size={13}/></Select.ItemIndicator></span>
            </Select.Item>)}
          </Select.List>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>;
});
