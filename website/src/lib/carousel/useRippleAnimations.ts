/**
 * Carousel-specific ripple animation management.
 *
 * Handles expand ripples, collapse ripples, and scroll-based ripple effects.
 */

import { useRef, useCallback } from 'react';

export interface RippleState {
  originX: number;
  originY: number;
  progress: number;
}

export interface CollapseRippleState {
  progress: number;
}

export interface RippleAnimations {
  /** Active expand ripples by card ID */
  ripples: Map<string, RippleState>;
  /** Active collapse ripples by card ID */
  collapseRipples: Map<string, CollapseRippleState>;
  /** Scroll ripple direction (-1 or 1) */
  scrollRippleDirection: number;
  /** Scroll ripple intensity (0-1) */
  scrollRippleIntensity: number;
}

export interface UseRippleAnimationsOptions {
  /** Speed multiplier for expand ripples (default: 0.5, faster with reduced motion: 0.7) */
  expandSpeed?: number;
  /** Speed multiplier for collapse ripples (default: 0.6, faster with reduced motion: 0.8) */
  collapseSpeed?: number;
  /** Whether user prefers reduced motion */
  prefersReducedMotion?: boolean;
}

export interface UseRippleAnimationsReturn {
  /** Start an expand ripple on a card */
  addRipple: (cardId: string, originX: number, originY: number) => void;
  /** Start a collapse ripple on a card */
  addCollapseRipple: (cardId: string) => void;
  /** Update scroll ripple based on movement */
  updateScrollRipple: (
    intensity: number,
    direction: number,
    smoothing: number
  ) => void;
  /** Tick all ripple animations (call each frame) */
  tick: (deltaTime: number) => void;
  /** Get current ripple state for a card */
  getRipple: (cardId: string) => RippleState | undefined;
  /** Get current collapse ripple state for a card */
  getCollapseRipple: (cardId: string) => CollapseRippleState | undefined;
  /** Get current scroll ripple state */
  getScrollRipple: () => { direction: number; intensity: number };
  /** Reset all ripple state */
  reset: () => void;
  /** Direct access to animation state ref (for render loop) */
  state: React.RefObject<RippleAnimations>;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Manages ripple animations for the carousel.
 *
 * @example
 * ```tsx
 * const ripples = useRippleAnimations({ prefersReducedMotion });
 *
 * // In pointer handler
 * const handleTap = (cardId: string, x: number, y: number) => {
 *   ripples.addRipple(cardId, x, y);
 * };
 *
 * // In render loop
 * useRenderLoop(({ deltaTime }) => {
 *   ripples.tick(deltaTime);
 *   ripples.updateScrollRipple(speed, direction, 0.08);
 *
 *   // Use in shader uniforms
 *   const ripple = ripples.getRipple(cardId);
 *   const scrollRipple = ripples.getScrollRipple();
 * });
 * ```
 */
export function useRippleAnimations(
  options: UseRippleAnimationsOptions = {}
): UseRippleAnimationsReturn {
  const { prefersReducedMotion = false } = options;

  const expandSpeed = options.expandSpeed ?? (prefersReducedMotion ? 0.7 : 0.5);
  const collapseSpeed = options.collapseSpeed ?? (prefersReducedMotion ? 0.8 : 0.6);

  const state = useRef<RippleAnimations>({
    ripples: new Map(),
    collapseRipples: new Map(),
    scrollRippleDirection: 0,
    scrollRippleIntensity: 0,
  });

  const addRipple = useCallback((cardId: string, originX: number, originY: number) => {
    state.current.ripples.set(cardId, {
      originX,
      originY,
      progress: 0,
    });
  }, []);

  const addCollapseRipple = useCallback((cardId: string) => {
    state.current.collapseRipples.set(cardId, { progress: 0.001 });
  }, []);

  const updateScrollRipple = useCallback(
    (intensity: number, direction: number, smoothing: number) => {
      const s = state.current;
      s.scrollRippleDirection = direction;
      s.scrollRippleIntensity = lerp(s.scrollRippleIntensity, intensity, smoothing);
    },
    []
  );

  const tick = useCallback(
    (deltaTime: number) => {
      const s = state.current;

      // Animate expand ripples
      for (const [cardId, ripple] of s.ripples) {
        ripple.progress += deltaTime * expandSpeed * 0.001;
        if (ripple.progress >= 1) s.ripples.delete(cardId);
      }

      // Animate collapse ripples
      for (const [cardId, ripple] of s.collapseRipples) {
        ripple.progress += deltaTime * collapseSpeed * 0.001;
        if (ripple.progress >= 1) s.collapseRipples.delete(cardId);
      }
    },
    [expandSpeed, collapseSpeed]
  );

  const getRipple = useCallback((cardId: string) => {
    return state.current.ripples.get(cardId);
  }, []);

  const getCollapseRipple = useCallback((cardId: string) => {
    return state.current.collapseRipples.get(cardId);
  }, []);

  const getScrollRipple = useCallback(() => {
    return {
      direction: state.current.scrollRippleDirection,
      intensity: state.current.scrollRippleIntensity,
    };
  }, []);

  const reset = useCallback(() => {
    state.current.ripples.clear();
    state.current.collapseRipples.clear();
    state.current.scrollRippleDirection = 0;
    state.current.scrollRippleIntensity = 0;
  }, []);

  return {
    addRipple,
    addCollapseRipple,
    updateScrollRipple,
    tick,
    getRipple,
    getCollapseRipple,
    getScrollRipple,
    reset,
    state,
  };
}
