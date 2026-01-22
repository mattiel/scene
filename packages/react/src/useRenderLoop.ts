/**
 * useRenderLoop - Hook for frame-based rendering
 * 
 * Provides a declarative way to subscribe to the Scene engine's render loop,
 * with automatic cleanup and performance optimizations.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useSceneContext } from './SceneProvider';

/**
 * Render callback arguments
 */
export interface RenderCallbackArgs {
  /** Time since last frame in milliseconds */
  deltaTime: number;
  /** Total elapsed time in milliseconds */
  elapsedTime: number;
  /** Current frame number */
  frame: number;
}

/**
 * Render callback function
 */
export type RenderCallback = (args: RenderCallbackArgs) => void;

/**
 * Options for useRenderLoop
 */
export interface UseRenderLoopOptions {
  /** Whether the render loop is active (default: true) */
  enabled?: boolean;
  /** Priority for render callback (lower = earlier, default: 0) */
  priority?: number;
}

/**
 * Return type for useRenderLoop
 */
export interface UseRenderLoopReturn {
  /** Manually trigger a single render */
  requestRender: () => void;
  /** Current frame count */
  frameCount: number;
  /** Whether the render loop is currently enabled */
  isEnabled: boolean;
}

/**
 * Hook to subscribe to the Scene engine's render loop
 * 
 * Provides a clean way to run code on every animation frame,
 * integrated with the Scene engine's timing and lifecycle.
 * 
 * @param callback - Function called on each frame
 * @param options - Render loop options
 * 
 * @example
 * ```tsx
 * function AnimatedScene() {
 *   const gpuRef = useRef<MyGPURenderer>(null);
 *   
 *   useRenderLoop(({ deltaTime, elapsedTime }) => {
 *     // Update GPU uniforms
 *     gpuRef.current?.setUniform('uTime', elapsedTime * 0.001);
 *     
 *     // Render
 *     gpuRef.current?.render();
 *   });
 *   
 *   return <canvas ref={canvasRef} />;
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // Conditional rendering
 * function Scene({ isPlaying }) {
 *   useRenderLoop(
 *     ({ deltaTime }) => updatePhysics(deltaTime),
 *     { enabled: isPlaying }
 *   );
 * }
 * ```
 */
export function useRenderLoop(
  callback: RenderCallback,
  options: UseRenderLoopOptions = {}
): UseRenderLoopReturn {
  const { enabled = true } = options;

  const { engine } = useSceneContext();
  
  // Refs for stable callback and state
  const callbackRef = useRef(callback);
  const frameCountRef = useRef(0);
  const startTimeRef = useRef(0);
  
  // Keep callback ref updated
  callbackRef.current = callback;

  // Subscribe to engine render events
  useEffect(() => {
    if (!enabled) return;
    
    // Initialize start time
    if (startTimeRef.current === 0) {
      startTimeRef.current = performance.now();
    }

    const unsubscribe = engine.events.on('render', ({ deltaTime }: { deltaTime: number }) => {
      frameCountRef.current++;
      const elapsedTime = performance.now() - startTimeRef.current;
      
      callbackRef.current({
        deltaTime,
        elapsedTime,
        frame: frameCountRef.current,
      });
    });

    return unsubscribe;
  }, [engine, enabled]);

  // Manual render request (no-op, render loop is continuous)
  // The engine's RAFScheduler runs continuously, so renders happen automatically
  const requestRender = useCallback(() => {
    // No-op: The engine render loop is always running
    // This is here for API completeness if needed in future
  }, []);

  return useMemo(
    () => ({
      requestRender,
      frameCount: frameCountRef.current,
      isEnabled: enabled,
    }),
    [requestRender, enabled]
  );
}

/**
 * Hook for frame-independent updates (fixed timestep)
 * 
 * Useful for physics simulations that need consistent timing
 * regardless of frame rate.
 * 
 * @param callback - Function called with fixed timestep
 * @param timestep - Fixed timestep in milliseconds (default: 16.67ms = 60fps)
 * @param options - Render loop options
 * 
 * @example
 * ```tsx
 * function PhysicsScene() {
 *   useFixedUpdate(
 *     ({ deltaTime }) => {
 *       // Physics runs at consistent 60fps regardless of display refresh
 *       updatePhysics(deltaTime);
 *     },
 *     16.67, // 60fps fixed timestep
 *   );
 * }
 * ```
 */
export function useFixedUpdate(
  callback: RenderCallback,
  timestep: number = 1000 / 60,
  options: UseRenderLoopOptions = {}
): UseRenderLoopReturn {
  const accumulatorRef = useRef(0);
  const frameRef = useRef(0);
  
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const fixedCallback = useCallback(({ deltaTime, elapsedTime }: RenderCallbackArgs) => {
    accumulatorRef.current += deltaTime;
    
    // Run fixed updates until we've caught up
    while (accumulatorRef.current >= timestep) {
      frameRef.current++;
      callbackRef.current({
        deltaTime: timestep,
        elapsedTime,
        frame: frameRef.current,
      });
      accumulatorRef.current -= timestep;
    }
  }, [timestep]);

  return useRenderLoop(fixedCallback, options);
}

/**
 * Hook for throttled render updates
 * 
 * Limits how often the callback runs, useful for expensive operations
 * that don't need to run every frame.
 * 
 * @param callback - Function called at throttled rate
 * @param fps - Target frames per second (default: 30)
 * @param options - Render loop options
 * 
 * @example
 * ```tsx
 * function SlowUpdate() {
 *   useThrottledRender(
 *     () => {
 *       // Expensive operation runs at 30fps max
 *       updateAnalytics();
 *       syncToServer();
 *     },
 *     30
 *   );
 * }
 * ```
 */
export function useThrottledRender(
  callback: RenderCallback,
  fps: number = 30,
  options: UseRenderLoopOptions = {}
): UseRenderLoopReturn {
  const lastCallRef = useRef(0);
  const frameRef = useRef(0);
  const minInterval = 1000 / fps;
  
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const throttledCallback = useCallback(({ elapsedTime }: RenderCallbackArgs) => {
    const now = performance.now();
    const elapsed = now - lastCallRef.current;
    
    if (elapsed >= minInterval) {
      frameRef.current++;
      const deltaTime = elapsed;
      lastCallRef.current = now;
      
      callbackRef.current({
        deltaTime,
        elapsedTime,
        frame: frameRef.current,
      });
    }
  }, [minInterval]);

  return useRenderLoop(throttledCallback, options);
}
