/**
 * @scene/react - useFrameRate
 *
 * Hook for monitoring frame rate (FPS) in render loops.
 */

import { useRef, useCallback, useState } from 'react';

export interface UseFrameRateOptions {
  /** Number of frames to average over (default: 30) */
  sampleSize?: number;
  /** Minimum interval between state updates in ms (default: 500) */
  updateInterval?: number;
}

export interface UseFrameRateReturn {
  /** Current frames per second */
  fps: number;
  /** Average frame time in milliseconds */
  avgFrameTime: number;
  /** Call this each frame to record timing */
  tick: () => void;
  /** Reset the frame rate tracking */
  reset: () => void;
}

/**
 * Monitor frame rate in a render loop.
 *
 * @example
 * ```tsx
 * const { fps, tick } = useFrameRate();
 *
 * useRenderLoop(() => {
 *   tick();
 *   // ... render logic
 * });
 *
 * return <div>FPS: {fps}</div>;
 * ```
 */
export function useFrameRate(options: UseFrameRateOptions = {}): UseFrameRateReturn {
  const { sampleSize = 30, updateInterval = 500 } = options;

  const [fps, setFps] = useState(60);
  const [avgFrameTime, setAvgFrameTime] = useState(16.67);

  const frameTimesRef = useRef<number[]>([]);
  const lastTickRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);

  const tick = useCallback(() => {
    const now = performance.now();

    if (lastTickRef.current > 0) {
      const delta = now - lastTickRef.current;
      const frameTimes = frameTimesRef.current;

      frameTimes.push(delta);
      if (frameTimes.length > sampleSize) {
        frameTimes.shift();
      }

      // Throttle state updates
      if (now - lastUpdateRef.current >= updateInterval && frameTimes.length > 0) {
        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        setAvgFrameTime(avg);
        setFps(Math.round(1000 / avg));
        lastUpdateRef.current = now;
      }
    }

    lastTickRef.current = now;
  }, [sampleSize, updateInterval]);

  const reset = useCallback(() => {
    frameTimesRef.current = [];
    lastTickRef.current = 0;
    lastUpdateRef.current = 0;
    setFps(60);
    setAvgFrameTime(16.67);
  }, []);

  return { fps, avgFrameTime, tick, reset };
}
