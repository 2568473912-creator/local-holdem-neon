import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../i18n';
import { useLanguage } from '../../i18n/languageContext';

interface IpadInfoSheetProps {
  title: string;
  summary?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  sheetId?: string;
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function IpadInfoSheet({ title, summary, onClose, children, className = '', sheetId }: IpadInfoSheetProps) {
  const language = useLanguage();
  const generatedId = useId();
  const dialogId = sheetId ?? generatedId;
  const titleId = `${dialogId}-title`;
  const summaryId = summary ? `${dialogId}-summary` : undefined;
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (typeof document !== 'undefined') {
      previousActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !sheetRef.current) {
        return;
      }

      const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey) {
        if (activeElement === first || activeElement === sheetRef.current) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (previousActiveElementRef.current?.isConnected) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [onClose]);

  const overlay = (
    <div className="ipad-info-overlay" role="presentation" onClick={onClose}>
      <div
        ref={sheetRef}
        id={dialogId}
        className={`ipad-info-sheet glass-panel ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={summaryId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ipad-info-sheet-head">
          <div className="ipad-info-sheet-title">
            <strong id={titleId}>{title}</strong>
            {summary ? <span id={summaryId}>{summary}</span> : null}
          </div>
          <button ref={closeButtonRef} className="btn mini" type="button" onClick={onClose}>
            {t(language, 'common.close')}
          </button>
        </div>
        <div className="ipad-info-sheet-body">{children}</div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return overlay;
  }

  return createPortal(overlay, document.body);
}
