/**
 * @scene/react - useSize
 *
 * Hooks for measuring element dimensions and canvas resolution.
 */

import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';

export interface Size {
  width: number;
  height: number;
}

export interface UseSizeOptions {
  /** Whether to observe size changes (default: true) */
  enabled?: boolean;
}

/**
 * Measure an element's dimensions using ResizeObserver.
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * const { width, height } = useSize(ref);
 *
 * return <div ref={ref}>Size: {width} x {height}</div>;
 * ```
 */
export function useSize<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: UseSizeOptions = {}
): Size {
  const { enabled = true } = options;
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setSize((prev) => {
          if (prev.width === width && prev.height === height) return prev;
          return { width, height };
        });
      }
    });

    observer.observe(element);

    // Get initial size
    const rect = element.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });

    return () => observer.disconnect();
  }, [ref, enabled]);

  return size;
}

export interface Resolution extends Size {
  /** Device pixel ratio used */
  dpr: number;
}

export interface UseResolutionOptions {
  /** Maximum DPR to use (default: 2) */
  maxDpr?: number;
  /** Whether to observe size changes (default: true) */
  enabled?: boolean;
}

/**
 * Get canvas resolution accounting for device pixel ratio.
 *
 * @example
 * ```tsx
 * const canvasRef = useRef<HTMLCanvasElement>(null);
 * const { width, height, dpr } = useResolution(canvasRef, { maxDpr: 2 });
 *
 * // Use width/height for canvas.width/height
 * // dpr for context.scale(dpr, dpr) if needed
 * ```
 */
export function useResolution(
  ref: RefObject<HTMLCanvasElement | null>,
  options: UseResolutionOptions = {}
): Resolution {
  const { maxDpr = 2, enabled = true } = options;
  const [resolution, setResolution] = useState<Resolution>({
    width: 0,
    height: 0,
    dpr: 1,
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !enabled) return;

    const updateResolution = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const width = Math.floor(rect.width * dpr);
      const height = Math.floor(rect.height * dpr);

      setResolution((prev) => {
        if (prev.width === width && prev.height === height && prev.dpr === dpr) {
          return prev;
        }
        return { width, height, dpr };
      });
    };

    const observer = new ResizeObserver(updateResolution);
    observer.observe(canvas);
    updateResolution();

    // Also listen for DPR changes (e.g., moving between monitors)
    const mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const handleDprChange = () => updateResolution();
    mediaQuery.addEventListener('change', handleDprChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleDprChange);
    };
  }, [ref, maxDpr, enabled]);

  return resolution;
}

/**
 * Get window dimensions with resize tracking.
 *
 * @example
 * ```tsx
 * const { width, height } = useWindowSize();
 * ```
 */
export function useWindowSize(): Size {
  const [size, setSize] = useState<Size>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }));

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

/**
 * Create a ref callback that measures element size.
 * Useful when you need the ref callback pattern.
 *
 * @example
 * ```tsx
 * const [ref, size] = useMeasure<HTMLDivElement>();
 * return <div ref={ref}>Size: {size.width} x {size.height}</div>;
 * ```
 */
export function useMeasure<T extends HTMLElement>(): [
  (node: T | null) => void,
  Size
] {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (node) {
      observerRef.current = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const { width, height } = entry.contentRect;
          setSize((prev) => {
            if (prev.width === width && prev.height === height) return prev;
            return { width, height };
          });
        }
      });
      observerRef.current.observe(node);

      // Get initial size
      const rect = node.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    }
  }, []);

  return [ref, size];
}
