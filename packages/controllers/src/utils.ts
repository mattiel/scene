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
  const handler = (e: MediaQueryListEvent) => callback(e.matches);
  
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
