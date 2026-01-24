/**
 * @scene/react - useGestureControls
 *
 * Imperative control for useGesture, similar to Motion's useDragControls.
 */

import { useRef, useCallback, useMemo } from 'react';
import type { GestureControls } from './useGesture';

interface GestureInstance {
  startDrag: (event: PointerEvent, snapToCursor?: boolean) => void;
  stopDrag: () => void;
  cancelDrag: () => void;
}

/**
 * Create imperative controls for useGesture.
 *
 * @example
 * ```tsx
 * const controls = useGestureControls();
 *
 * const { bind } = useGesture({
 *   controls,
 *   onDrag: (e, info) => console.log(info.offset),
 * });
 *
 * // Start drag from a different element
 * const handleDragHandle = (e: React.PointerEvent) => {
 *   controls.start(e.nativeEvent, { snapToCursor: true });
 * };
 *
 * return (
 *   <>
 *     <div className="handle" onPointerDown={handleDragHandle}>
 *       Drag handle
 *     </div>
 *     <div {...bind()}>
 *       Draggable content
 *     </div>
 *   </>
 * );
 * ```
 */
export function useGestureControls(): GestureControls {
  const instanceRef = useRef<GestureInstance | null>(null);

  const start = useCallback(
    (event: PointerEvent, options?: { snapToCursor?: boolean }) => {
      if (instanceRef.current) {
        instanceRef.current.startDrag(event, options?.snapToCursor ?? false);
      }
    },
    []
  );

  const stop = useCallback(() => {
    if (instanceRef.current) {
      instanceRef.current.stopDrag();
    }
  }, []);

  const cancel = useCallback(() => {
    if (instanceRef.current) {
      instanceRef.current.cancelDrag();
    }
  }, []);

  const _register = useCallback((instance: GestureInstance) => {
    instanceRef.current = instance;
  }, []);

  return useMemo(
    () => ({
      start,
      stop,
      cancel,
      _register,
    }),
    [start, stop, cancel, _register]
  );
}
