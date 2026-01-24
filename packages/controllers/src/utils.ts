/**
 * @scene/controllers - Utilities
 * 
 * Shared utility functions for controllers.
 */

/**
 * Check if the user prefers reduced motion
 * 
 * @returns true if the user has enabled reduced motion in OS settings
 * 
 * @example
 * ```typescript
 * import { prefersReducedMotion } from '@scene/controllers';
 * 
 * const scrollable = new Scrollable({
 *   reducedMotion: prefersReducedMotion(),
 * });
 * ```
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Subscribe to reduced motion preference changes
 * 
 * @param callback - Called when the preference changes
 * @returns Unsubscribe function
 * 
 * @example
 * ```typescript
 * import { onReducedMotionChange } from '@scene/controllers';
 * 
 * const unsubscribe = onReducedMotionChange((prefers) => {
 *   console.log('Reduced motion:', prefers);
 *   scrollable.setConfig({ reducedMotion: prefers });
 * });
 * 
 * // Later: cleanup
 * unsubscribe();
 * ```
 */
export function onReducedMotionChange(callback: (prefers: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (e: MediaQueryListEvent): void => callback(e.matches);
  
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

// ============================================
// Snap Point Utilities
// ============================================

export interface SnapPointOptions {
  /** Number of items */
  count: number;
  /** Spacing between item centers */
  spacing: number;
  /** Alignment of items (default: 'center') */
  align?: 'start' | 'center' | 'end';
}

/**
 * Calculate snap points for evenly spaced items.
 * 
 * @example
 * ```typescript
 * // 5 items with 300px spacing, centered
 * const snaps = calculateSnapPoints({ count: 5, spacing: 300 });
 * // Returns: [600, 300, 0, -300, -600]
 * 
 * // 3 items with 200px spacing, start-aligned
 * const snaps = calculateSnapPoints({ count: 3, spacing: 200, align: 'start' });
 * // Returns: [0, -200, -400]
 * ```
 */
export function calculateSnapPoints(options: SnapPointOptions): number[] {
  const { count, spacing, align = 'center' } = options;
  
  if (count <= 0) return [0];
  
  const midIndex = align === 'center' ? (count - 1) / 2 : 0;
  
  return Array.from({ length: count }, (_, i) => -(i - midIndex) * spacing);
}

export interface BoundsOptions {
  /** Number of items */
  count: number;
  /** Spacing between item centers */
  spacing: number;
  /** Alignment of items (default: 'center') */
  align?: 'start' | 'center' | 'end';
}

export interface Bounds {
  min: number;
  max: number;
}

/**
 * Calculate scroll bounds for a set of items.
 * 
 * @example
 * ```typescript
 * // 5 items with 300px spacing, centered
 * const bounds = calculateBounds({ count: 5, spacing: 300 });
 * // Returns: { min: -600, max: 600 }
 * 
 * // 3 items with 200px spacing, start-aligned
 * const bounds = calculateBounds({ count: 3, spacing: 200, align: 'start' });
 * // Returns: { min: -400, max: 0 }
 * ```
 */
export function calculateBounds(options: BoundsOptions): Bounds {
  const { count, spacing, align = 'center' } = options;
  
  if (count <= 0) return { min: 0, max: 0 };
  
  const midIndex = align === 'center' ? (count - 1) / 2 : 0;
  
  return {
    min: -(count - 1 - midIndex) * spacing,
    max: midIndex * spacing,
  };
}

/**
 * Find the nearest snap point to a value.
 * 
 * @example
 * ```typescript
 * const snaps = [600, 300, 0, -300, -600];
 * findNearestSnap(snaps, 150); // Returns 300
 * findNearestSnap(snaps, -450); // Returns -300
 * ```
 */
export function findNearestSnap(snapPoints: number[], value: number): number {
  if (snapPoints.length === 0) return value;
  
  let nearest = snapPoints[0];
  let minDist = Math.abs(value - nearest);
  
  for (let i = 1; i < snapPoints.length; i++) {
    const dist = Math.abs(value - snapPoints[i]);
    if (dist < minDist) {
      minDist = dist;
      nearest = snapPoints[i];
    }
  }
  
  return nearest;
}

/**
 * Find the snap point index for a value.
 * 
 * @example
 * ```typescript
 * const snaps = [600, 300, 0, -300, -600];
 * findSnapIndex(snaps, 150); // Returns 1 (index of 300)
 * ```
 */
export function findSnapIndex(snapPoints: number[], value: number): number {
  if (snapPoints.length === 0) return 0;
  
  let nearestIndex = 0;
  let minDist = Math.abs(value - snapPoints[0]);
  
  for (let i = 1; i < snapPoints.length; i++) {
    const dist = Math.abs(value - snapPoints[i]);
    if (dist < minDist) {
      minDist = dist;
      nearestIndex = i;
    }
  }
  
  return nearestIndex;
}
