import { useEffect } from 'react';
import { lockBodyScroll } from './modalEnvironment';

/**
 * Shared behavior for hand-rolled modal overlays: closes on Escape and locks
 * body scroll while open. Components that always render open can omit `enabled`;
 * components gated by an `isOpen` prop pass it through.
 */
export function useModalBehavior(onClose: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const releaseScrollLock = lockBodyScroll();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      releaseScrollLock();
    };
  }, [onClose, enabled]);
}
