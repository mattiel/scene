/**
 * @scene/react - useBreakpoint
 *
 * Hook for responsive values based on screen breakpoints.
 */

import { useState, useEffect, useMemo } from 'react';

export interface BreakpointConfig<T> {
  /** Value for screens < 640px */
  sm?: T;
  /** Value for screens >= 640px and < 768px */
  md?: T;
  /** Value for screens >= 768px and < 1024px */
  lg?: T;
  /** Value for screens >= 1024px and < 1280px */
  xl?: T;
  /** Value for screens >= 1280px */
  '2xl'?: T;
  /** Default/base value (required) */
  base: T;
}

// Standard Tailwind breakpoints
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

function getBreakpointValue<T>(config: BreakpointConfig<T>, width: number): T {
  // Check from largest to smallest
  if (width >= BREAKPOINTS['2xl'] && config['2xl'] !== undefined) return config['2xl'];
  if (width >= BREAKPOINTS.xl && config.xl !== undefined) return config.xl;
  if (width >= BREAKPOINTS.lg && config.lg !== undefined) return config.lg;
  if (width >= BREAKPOINTS.md && config.md !== undefined) return config.md;
  if (width >= BREAKPOINTS.sm && config.sm !== undefined) return config.sm;
  return config.base;
}

/**
 * Get a value based on current screen breakpoint.
 *
 * @example
 * ```tsx
 * const columns = useBreakpoint({ base: 1, md: 2, lg: 3 });
 * const spacing = useBreakpoint({ base: 16, lg: 24 });
 * ```
 */
export function useBreakpoint<T>(config: BreakpointConfig<T>): T {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = (): void => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return useMemo(() => getBreakpointValue(config, width), [config, width]);
}

/**
 * Get the current breakpoint name.
 *
 * @example
 * ```tsx
 * const breakpoint = useCurrentBreakpoint(); // 'sm' | 'md' | 'lg' | 'xl' | '2xl'
 * ```
 */
export function useCurrentBreakpoint(): 'base' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = (): void => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'base';
}

/**
 * Check if screen width is at or above a breakpoint.
 *
 * @example
 * ```tsx
 * const isDesktop = useBreakpointUp('lg');
 * const isMobile = !useBreakpointUp('md');
 * ```
 */
export function useBreakpointUp(breakpoint: keyof typeof BREAKPOINTS): boolean {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = (): void => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width >= BREAKPOINTS[breakpoint];
}
