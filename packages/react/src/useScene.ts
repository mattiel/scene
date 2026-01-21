/**
 * useScene - Hook to access the Scene engine
 * 
 * Provides convenient access to engine properties and events.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { InteractionMode, type EventMap, type EventCallback } from '@scene/core';
import { useSceneContext } from './SceneProvider';

/**
 * Return type for useScene hook
 */
export interface UseSceneReturn {
  /** The Scene engine instance */
  engine: ReturnType<typeof useSceneContext>['engine'];
  /** Whether the engine is ready */
  isReady: boolean;
  /** Whether WebGPU is available */
  isGPUEnabled: boolean;
  /** Current interaction mode */
  mode: InteractionMode;
  /** Set interaction mode */
  setMode: (mode: InteractionMode) => void;
  /** Current FPS (if tracking enabled) */
  fps: number;
  /** Whether render loop is running */
  isRunning: boolean;
  /** Start render loop */
  start: () => void;
  /** Stop render loop */
  stop: () => void;
  /** Pause render loop */
  pause: () => void;
  /** Resume render loop */
  resume: () => void;
}

/**
 * Hook to access Scene engine and common operations
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isReady, mode, setMode, fps } = useScene();
 *   
 *   return (
 *     <div>
 *       <p>Ready: {isReady ? 'Yes' : 'No'}</p>
 *       <p>FPS: {fps}</p>
 *       <button onClick={() => setMode(InteractionMode.CANVAS_INTERACTIVE)}>
 *         Switch to Canvas Mode
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useScene(): UseSceneReturn {
  const { engine, isReady, isGPUEnabled, mode, setMode } = useSceneContext();
  
  // Track FPS with local state (updates frequently)
  const [fps, setFps] = useState(0);
  const [isRunning, setIsRunning] = useState(engine.isRunning);

  // Update FPS periodically
  useEffect(() => {
    const intervalId = setInterval(() => {
      setFps(engine.fps);
      setIsRunning(engine.isRunning);
    }, 100);

    return () => clearInterval(intervalId);
  }, [engine]);

  const start = useCallback(() => {
    engine.start();
    setIsRunning(true);
  }, [engine]);

  const stop = useCallback(() => {
    engine.stop();
    setIsRunning(false);
  }, [engine]);

  const pause = useCallback(() => {
    engine.pause();
  }, [engine]);

  const resume = useCallback(() => {
    engine.resume();
  }, [engine]);

  return useMemo(
    () => ({
      engine,
      isReady,
      isGPUEnabled,
      mode,
      setMode,
      fps,
      isRunning,
      start,
      stop,
      pause,
      resume,
    }),
    [engine, isReady, isGPUEnabled, mode, setMode, fps, isRunning, start, stop, pause, resume]
  );
}

/**
 * Hook to subscribe to Scene engine events
 * 
 * @param event - Event name to subscribe to
 * @param callback - Callback function
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   useSceneEvent('render', ({ deltaTime }) => {
 *     console.log('Frame:', deltaTime);
 *   });
 *   
 *   useSceneEvent('resize', ({ width, height }) => {
 *     console.log('Resized:', width, height);
 *   });
 * }
 * ```
 */
export function useSceneEvent<K extends keyof EventMap>(
  event: K,
  callback: EventCallback<EventMap[K]>
): void {
  const { engine } = useSceneContext();

  useEffect(() => {
    const unsubscribe = engine.on(event, callback);
    return unsubscribe;
  }, [engine, event, callback]);
}

/**
 * Hook to track a specific engine property
 * 
 * @param selector - Function to select the property
 * @param interval - Update interval in ms (default: 100)
 * 
 * @example
 * ```tsx
 * function FPSDisplay() {
 *   const fps = useSceneProperty(engine => engine.fps, 50);
 *   return <span>FPS: {fps}</span>;
 * }
 * ```
 */
export function useSceneProperty<T>(
  selector: (engine: ReturnType<typeof useSceneContext>['engine']) => T,
  interval = 100
): T {
  const { engine } = useSceneContext();
  const [value, setValue] = useState(() => selector(engine));

  useEffect(() => {
    const id = setInterval(() => {
      setValue(selector(engine));
    }, interval);

    return () => clearInterval(id);
  }, [engine, selector, interval]);

  return value;
}
