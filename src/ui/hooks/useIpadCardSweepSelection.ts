import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface SweepState {
  pointerId: number;
  startCardId: string;
  mode: 'select' | 'deselect';
  visited: Set<string>;
  startX: number;
  startY: number;
  active: boolean;
}

interface UseIpadCardSweepSelectionOptions {
  enabled: boolean;
  selectedIds: Set<string>;
  onToggleCard: (cardId: string) => void;
}

const EXPANDED_VERTICAL_MARGIN = 24;
// Maximum horizontal overshoot for a TAP to register on a card.
// Prevents accidental selection when tapping empty space to the right of the hand.
// Sweeps use Infinity so they still snap to the nearest card during movement.
const TAP_MAX_X_DISTANCE = 12;

function findCardIdAtPoint(
  container: HTMLElement,
  clientX: number,
  clientY: number,
  maxXDistance = Infinity,
): string | null {
  const containerRect = container.getBoundingClientRect();
  if (clientY < containerRect.top - EXPANDED_VERTICAL_MARGIN || clientY > containerRect.bottom + EXPANDED_VERTICAL_MARGIN) {
    return null;
  }

  const cards = [...container.querySelectorAll<HTMLButtonElement>('.ddz-card[data-card-id]')];
  let bestId: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const card of cards) {
    const cardId = card.dataset.cardId;
    if (!cardId) continue;
    const rect = card.getBoundingClientRect();
    const xDistance =
      clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
    // Reject cards that are too far horizontally when a strict tap threshold is set
    if (xDistance > maxXDistance) continue;
    const centerY = rect.top + rect.height / 2;
    const yDistance = Math.max(0, Math.abs(clientY - centerY) - rect.height / 2);
    const totalDistance = xDistance + yDistance * 0.35;

    if (totalDistance < bestDistance) {
      bestDistance = totalDistance;
      bestId = cardId;
    }
  }

  return bestId;
}

export function useIpadCardSweepSelection({ enabled, selectedIds, onToggleCard }: UseIpadCardSweepSelectionOptions) {
  const selectedIdsRef = useRef(selectedIds);
  const sweepStateRef = useRef<SweepState | null>(null);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  const applyCard = useCallback((cardId: string | null) => {
    const sweepState = sweepStateRef.current;
    if (!sweepState || !cardId || sweepState.visited.has(cardId)) {
      return;
    }

    sweepState.visited.add(cardId);
    const isSelected = selectedIdsRef.current.has(cardId);
    if ((sweepState.mode === 'select' && !isSelected) || (sweepState.mode === 'deselect' && isSelected)) {
      onToggleCard(cardId);
    }
  }, [onToggleCard]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled) {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    // Use strict horizontal threshold for tap start to avoid mistouch in empty space
    const cardId = findCardIdAtPoint(event.currentTarget, event.clientX, event.clientY, TAP_MAX_X_DISTANCE);
    if (!cardId) {
      return;
    }

    sweepStateRef.current = {
      pointerId: event.pointerId,
      startCardId: cardId,
      mode: selectedIdsRef.current.has(cardId) ? 'deselect' : 'select',
      visited: new Set<string>(),
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
  }, [enabled]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const sweepState = sweepStateRef.current;
    if (!enabled || !sweepState || sweepState.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - sweepState.startX;
    const dy = event.clientY - sweepState.startY;
    if (!sweepState.active) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        return;
      }
      sweepState.active = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      applyCard(sweepState.startCardId);
    }

    applyCard(findCardIdAtPoint(event.currentTarget, event.clientX, event.clientY));
  }, [applyCard, enabled]);

  const finishSweep = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const sweepState = sweepStateRef.current;
    if (!enabled || !sweepState || sweepState.pointerId !== event.pointerId) {
      return;
    }

    if (!sweepState.active) {
      applyCard(sweepState.startCardId);
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    sweepStateRef.current = null;
  }, [applyCard, enabled]);

  const cancelSweep = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const sweepState = sweepStateRef.current;
    if (!enabled || !sweepState || sweepState.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    sweepStateRef.current = null;
  }, [enabled]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finishSweep,
    onPointerCancel: cancelSweep,
  };
}
