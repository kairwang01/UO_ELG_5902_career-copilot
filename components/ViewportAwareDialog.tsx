import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { lockBodyScroll, pushModalLayer, removeModalLayer, isTopModalLayer } from '../hooks/modalEnvironment';

type DialogStrategy = 'center' | 'anchor-or-center';

interface ViewportAwareDialogProps {
  open: boolean;
  anchorRef?: React.RefObject<HTMLElement | null>;
  strategy?: DialogStrategy;
  labelledBy?: string;
  describedBy?: string;
  ariaLabel?: string;
  className?: string;
  maxWidth?: number;
  zIndex?: number;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  onClose?: () => void;
  children: React.ReactNode;
}

type DialogPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const EDGE_GAP = 16;
const ANCHOR_GAP = 12;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getViewport = () => {
  const vv = window.visualViewport;
  return {
    left: vv?.offsetLeft ?? 0,
    top: vv?.offsetTop ?? 0,
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
  };
};

const nearlyEqual = (a: DialogPosition | null, b: DialogPosition) => {
  if (!a) return false;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.maxHeight - b.maxHeight) < 0.5
  );
};

export const ViewportAwareDialog: React.FC<ViewportAwareDialogProps> = ({
  open,
  anchorRef,
  strategy = 'center',
  labelledBy,
  describedBy,
  ariaLabel,
  className = '',
  maxWidth = 560,
  zIndex = 95,
  closeOnBackdrop = false,
  closeOnEscape = true,
  onClose,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const layerIdRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<DialogPosition | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  // Register this dialog as a modal layer so only the topmost one handles Esc / Tab.
  useEffect(() => {
    if (!open) return undefined;
    const id = pushModalLayer();
    layerIdRef.current = id;
    return () => {
      removeModalLayer(id);
      layerIdRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const onKeyDown = (event: KeyboardEvent) => {
      // Only the topmost stacked dialog responds — so one Esc doesn't close every
      // layer and nested focus traps don't fight over Tab.
      if (layerIdRef.current === null || !isTopModalLayer(layerIdRef.current)) return;
      if (event.key === 'Escape' && closeOnEscape) {
        onClose?.();
        return;
      }
      // Trap Tab within the panel — the a11y contract for aria-modal.
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) => el.offsetParent !== null,
      );
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeOnEscape, onClose, open]);

  // Move focus into the dialog on open and restore it to the trigger on close.
  useEffect(() => {
    if (!open || !mounted) return undefined;
    previouslyFocused.current = (document.activeElement as HTMLElement | null) ?? null;
    // Focus the panel itself (tabIndex=-1) rather than a control, so opening doesn't
    // pre-arm an action (e.g. the close button) but focus is still inside the dialog.
    panelRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open, mounted]);

  useLayoutEffect(() => {
    if (!open || !mounted) return undefined;

    const calculate = () => {
      rafRef.current = null;
      const panel = panelRef.current;
      if (!panel) return;

      const viewport = getViewport();
      const viewportRight = viewport.left + viewport.width;
      const viewportBottom = viewport.top + viewport.height;
      const availableWidth = Math.max(280, viewport.width - EDGE_GAP * 2);
      const width = Math.min(maxWidth, availableWidth);
      const maxHeight = Math.max(240, viewport.height - EDGE_GAP * 2);

      const panelRect = panel.getBoundingClientRect();
      const panelHeight = Math.min(panelRect.height || maxHeight, maxHeight);
      const centerTop = viewport.top + (viewport.height - panelHeight) / 2;
      const centerLeft = viewport.left + (viewport.width - width) / 2;

      let next: DialogPosition = {
        top: clamp(centerTop, viewport.top + EDGE_GAP, viewportBottom - panelHeight - EDGE_GAP),
        left: clamp(centerLeft, viewport.left + EDGE_GAP, viewportRight - width - EDGE_GAP),
        width,
        maxHeight,
      };

      const anchor = anchorRef?.current;
      if (strategy === 'anchor-or-center' && anchor) {
        const anchorRect = anchor.getBoundingClientRect();
        const anchorVisible =
          anchorRect.bottom >= viewport.top + EDGE_GAP &&
          anchorRect.top <= viewportBottom - EDGE_GAP &&
          anchorRect.right >= viewport.left + EDGE_GAP &&
          anchorRect.left <= viewportRight - EDGE_GAP;

        if (anchorVisible) {
          const spaceBelow = viewportBottom - anchorRect.bottom - ANCHOR_GAP - EDGE_GAP;
          const spaceAbove = anchorRect.top - viewport.top - ANCHOR_GAP - EDGE_GAP;
          const canFitBelow = spaceBelow >= panelHeight;
          const canFitAbove = spaceAbove >= panelHeight;
          const useBelow = canFitBelow || spaceBelow >= spaceAbove;
          const anchoredTop = useBelow
            ? anchorRect.bottom + ANCHOR_GAP
            : anchorRect.top - ANCHOR_GAP - panelHeight;

          if (canFitBelow || canFitAbove || Math.max(spaceBelow, spaceAbove) >= Math.min(panelHeight * 0.65, 360)) {
            next = {
              top: clamp(anchoredTop, viewport.top + EDGE_GAP, viewportBottom - panelHeight - EDGE_GAP),
              left: clamp(
                anchorRect.left + anchorRect.width / 2 - width / 2,
                viewport.left + EDGE_GAP,
                viewportRight - width - EDGE_GAP,
              ),
              width,
              maxHeight,
            };
          }
        }
      }

      setPosition((current) => (nearlyEqual(current, next) ? current : next));
    };

    const schedule = () => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(calculate);
    };

    const scrollOptions: AddEventListenerOptions = { capture: true, passive: true };
    const visualViewportOptions: AddEventListenerOptions = { passive: true };

    calculate();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, scrollOptions);
    window.visualViewport?.addEventListener('resize', schedule, visualViewportOptions);
    window.visualViewport?.addEventListener('scroll', schedule, visualViewportOptions);

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    if (panelRef.current && observer) observer.observe(panelRef.current);

    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, scrollOptions);
      window.visualViewport?.removeEventListener('resize', schedule, visualViewportOptions);
      window.visualViewport?.removeEventListener('scroll', schedule, visualViewportOptions);
      observer?.disconnect();
    };
  }, [anchorRef, maxWidth, mounted, open, strategy]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="viewport-aware-dialog-overlay"
      role="presentation"
      style={{ zIndex }}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`viewport-aware-dialog-panel ${className}`}
        style={{
          top: position?.top ?? '50%',
          left: position?.left ?? '50%',
          width: position?.width ?? `min(${maxWidth}px, calc(100vw - ${EDGE_GAP * 2}px))`,
          maxHeight: position?.maxHeight ?? `calc(100dvh - ${EDGE_GAP * 2}px)`,
          opacity: position ? 1 : 0,
          transform: position ? undefined : 'translate(-50%, -50%)',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};
