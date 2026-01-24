/**
 * Carousel-specific dismiss gesture management.
 *
 * Handles drag-to-dismiss with axis locking, threshold detection,
 * and spring animations.
 */

import { useRef, useCallback } from 'react';
import { useMotion, springs } from '@scene/react';

export interface DismissThresholds {
  /** Y threshold as ratio of card height (default: 0.5) */
  yRatio: number;
  /** X threshold as ratio of card width (default: 1.25) */
  xRatio: number;
  /** Y threshold for wheel dismiss (default: 0.4) */
  wheelYRatio: number;
  /** X threshold for wheel dismiss (default: 1.2) */
  wheelXRatio: number;
  /** Velocity threshold for flick dismiss in px/ms (default: 15) */
  velocityThreshold: number;
}

export interface DismissState {
  /** Current X offset (dampened) */
  dragX: number;
  /** Current Y offset */
  dragY: number;
  /** Whether a dismiss drag is active */
  isDragging: boolean;
  /** Starting X position */
  startX: number;
  /** Starting Y position */
  startY: number;
  /** Locked axis ('x' | 'y' | null) */
  lockedAxis: 'x' | 'y' | null;
  /** Wheel accumulator X */
  wheelAccX: number;
  /** Wheel accumulator Y */
  wheelAccY: number;
  /** Wheel accumulator timeout ID */
  wheelTimeout: ReturnType<typeof setTimeout> | null;
  /** Time of last wheel event (for momentum filtering) */
  lastWheelTime: number;
  /** Time of last dismiss (for post-dismiss momentum filtering) */
  postDismissTime: number;
  /** Smoothed wheel velocity Y for flick detection */
  wheelVelocityY: number;
}

export interface UseDismissGestureOptions {
  /** Card dimensions for threshold calculation */
  cardWidth: number;
  cardHeight: number;
  /** Custom thresholds (optional) */
  thresholds?: Partial<DismissThresholds>;
  /** Dampening factor for X axis (default: 0.7) */
  xDampening?: number;
  /** Axis lock threshold in px (default: 15) */
  axisLockThreshold?: number;
  /** Callback when dismiss is triggered */
  onDismiss: () => void;
}

export interface UseDismissGestureReturn {
  /** Start tracking a dismiss drag */
  startDrag: (x: number, y: number) => void;
  /** Update drag position */
  moveDrag: (x: number, y: number) => void;
  /** End drag and check threshold */
  endDrag: () => void;
  /** Handle wheel input for dismiss (tracks velocity internally) */
  handleWheel: (deltaX: number, deltaY: number) => boolean;
  /** Reset dismiss state (call after dismiss animation) */
  reset: () => void;
  /** Whether currently dragging */
  isDragging: () => boolean;
  /** Get current offset for rendering */
  getOffset: () => { x: number; y: number };
  /** Motion value for X offset (for visual feedback) */
  offsetX: ReturnType<typeof useMotion>;
  /** Motion value for Y offset (for visual feedback) */
  offsetY: ReturnType<typeof useMotion>;
  /** Direct access to state ref */
  state: React.RefObject<DismissState>;
}

const DEFAULT_THRESHOLDS: DismissThresholds = {
  yRatio: 0.5,
  xRatio: 1.25,
  wheelYRatio: 0.4,
  wheelXRatio: 1.2,
  velocityThreshold: 15,
};

/**
 * Manages dismiss gesture for expanded cards.
 *
 * @example
 * ```tsx
 * const dismiss = useDismissGesture({
 *   cardWidth: config.cardWidth,
 *   cardHeight: config.cardHeight,
 *   onDismiss: () => {
 *     setExpandedIndex(-1);
 *     ripples.addCollapseRipple(expandedCardId);
 *   },
 * });
 *
 * // In pointer handlers
 * const handlePointerDown = (e) => {
 *   if (expandedIndex >= 0) {
 *     dismiss.startDrag(e.clientX, e.clientY);
 *   }
 * };
 *
 * // In render loop, use dismiss.offsetX.value and dismiss.offsetY.value
 * // for visual feedback on the expanded card
 * ```
 */
export function useDismissGesture(
  options: UseDismissGestureOptions
): UseDismissGestureReturn {
  const {
    cardWidth,
    cardHeight,
    thresholds: customThresholds,
    xDampening = 0.7,
    axisLockThreshold = 15,
    onDismiss,
  } = options;

  const thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds };

  const offsetX = useMotion(0);
  const offsetY = useMotion(0);

  const state = useRef<DismissState>({
    dragX: 0,
    dragY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    lockedAxis: null,
    wheelAccX: 0,
    wheelAccY: 0,
    wheelTimeout: null,
    lastWheelTime: 0,
    postDismissTime: 0,
    wheelVelocityY: 0,
  });

  const triggerDismiss = useCallback(() => {
    const s = state.current;
    s.postDismissTime = performance.now();
    s.isDragging = false;
    s.lockedAxis = null;
    if (s.wheelTimeout) {
      clearTimeout(s.wheelTimeout);
      s.wheelTimeout = null;
    }
    onDismiss();
    // Animate back to center
    offsetX.animateTo(0, springs.settle);
    offsetY.animateTo(0, springs.settle);
  }, [onDismiss, offsetX, offsetY]);

  const startDrag = useCallback((x: number, y: number) => {
    const s = state.current;
    s.isDragging = true;
    s.startX = x;
    s.startY = y;
    s.dragX = 0;
    s.dragY = 0;
    s.lockedAxis = null;
  }, []);

  const moveDrag = useCallback(
    (x: number, y: number) => {
      const s = state.current;
      if (!s.isDragging) return;

      const rawDeltaX = x - s.startX;
      const rawDeltaY = y - s.startY;

      // Lock axis after threshold
      if (!s.lockedAxis) {
        const absX = Math.abs(rawDeltaX);
        const absY = Math.abs(rawDeltaY);
        if (absX > axisLockThreshold || absY > axisLockThreshold) {
          s.lockedAxis = absX > absY ? 'x' : 'y';
        }
      }

      // Apply dampening to X, Y follows 1:1
      const deltaX = rawDeltaX * xDampening;
      const deltaY = rawDeltaY;

      s.dragX = deltaX;
      s.dragY = deltaY;
      offsetX.set(deltaX);
      offsetY.set(deltaY);
    },
    [axisLockThreshold, xDampening, offsetX, offsetY]
  );

  const endDrag = useCallback(() => {
    const s = state.current;
    if (!s.isDragging) return;

    s.isDragging = false;

    const absY = Math.abs(s.dragY);
    // Undo dampening for threshold check
    const rawDeltaX = s.dragX / xDampening;
    const absX = Math.abs(rawDeltaX);

    const thresholdY = cardHeight * thresholds.yRatio;
    const thresholdX = cardWidth * thresholds.xRatio;

    // Check threshold based on locked axis
    let isDismissThresholdMet = false;
    if (s.lockedAxis === 'y') {
      isDismissThresholdMet = absY >= thresholdY;
    } else if (s.lockedAxis === 'x') {
      isDismissThresholdMet = absX >= thresholdX;
    }

    if (isDismissThresholdMet) {
      triggerDismiss();
      return;
    }

    // Spring back
    s.dragX = 0;
    s.dragY = 0;
    offsetX.animateTo(0, springs.settle);
    offsetY.animateTo(0, springs.settle);
  }, [cardWidth, cardHeight, thresholds, xDampening, triggerDismiss, offsetX, offsetY]);

  const handleWheel = useCallback(
    (deltaX: number, deltaY: number): boolean => {
      const s = state.current;
      const now = performance.now();

      // Post-dismiss momentum filtering
      if (s.postDismissTime > 0) {
        const timeSinceDismiss = now - s.postDismissTime;
        const timeSinceLastWheel = now - s.lastWheelTime;

        // If gap detected, clear post-dismiss state
        if (timeSinceLastWheel > 100 || timeSinceDismiss > 500) {
          s.postDismissTime = 0;
        } else {
          // Still in momentum phase, ignore
          s.lastWheelTime = now;
          return false;
        }
      }

      // Calculate smoothed velocity (matches original behavior)
      const timeDelta = s.lastWheelTime > 0 ? now - s.lastWheelTime : 16;
      const velocityY = Math.abs(deltaY) / Math.max(timeDelta, 1);
      // Smooth velocity with previous value for stable detection
      s.wheelVelocityY = s.wheelVelocityY * 0.3 + velocityY * 0.7;

      s.lastWheelTime = now;

      // Clear existing timeout
      if (s.wheelTimeout) {
        clearTimeout(s.wheelTimeout);
      }

      // Accumulate with dampening on X
      s.wheelAccX -= deltaX * 0.3;
      s.wheelAccY -= deltaY;

      offsetX.set(s.wheelAccX);
      offsetY.set(s.wheelAccY);

      // Check dismiss thresholds
      const thresholdY = cardHeight * thresholds.wheelYRatio;
      const thresholdX = cardWidth * thresholds.wheelXRatio;
      const absY = Math.abs(s.wheelAccY);
      const rawAbsX = Math.abs(s.wheelAccX / 0.3);
      // Use sum of both axes to determine minimum movement (matches original)
      const totalMovement = absY + rawAbsX;

      const MIN_MOVEMENT = 30;
      if (totalMovement >= MIN_MOVEMENT) {
        const isYDominant = absY > rawAbsX;
        const isDismiss = isYDominant
          ? absY >= thresholdY
          : rawAbsX >= thresholdX;

        // Check velocity for flick dismiss (only on Y axis, with minimum movement)
        const isFlick = isYDominant && 
          s.wheelVelocityY >= thresholds.velocityThreshold && 
          absY > 30;

        if (isDismiss || isFlick) {
          s.wheelVelocityY = 0;
          triggerDismiss();
          return true;
        }
      }

      // Reset after inactivity
      s.wheelTimeout = setTimeout(() => {
        s.wheelAccX = 0;
        s.wheelAccY = 0;
        s.wheelVelocityY = 0;
        s.wheelTimeout = null;
        offsetX.animateTo(0, springs.settle);
        offsetY.animateTo(0, springs.settle);
      }, 150);

      return false;
    },
    [cardWidth, cardHeight, thresholds, triggerDismiss, offsetX, offsetY]
  );

  const reset = useCallback(() => {
    const s = state.current;
    s.dragX = 0;
    s.dragY = 0;
    s.isDragging = false;
    s.startX = 0;
    s.startY = 0;
    s.lockedAxis = null;
    s.wheelAccX = 0;
    s.wheelAccY = 0;
    if (s.wheelTimeout) {
      clearTimeout(s.wheelTimeout);
      s.wheelTimeout = null;
    }
    s.lastWheelTime = 0;
    s.postDismissTime = 0;
    s.wheelVelocityY = 0;
    offsetX.set(0);
    offsetY.set(0);
  }, [offsetX, offsetY]);

  const isDragging = useCallback(() => state.current.isDragging, []);

  const getOffset = useCallback(
    () => ({
      x: offsetX.value,
      y: offsetY.value,
    }),
    [offsetX, offsetY]
  );

  return {
    startDrag,
    moveDrag,
    endDrag,
    handleWheel,
    reset,
    isDragging,
    getOffset,
    offsetX,
    offsetY,
    state,
  };
}
