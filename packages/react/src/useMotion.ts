/**
 * useMotion - Hook for animated values using SceneValue
 * 
 * Provides React-friendly access to Scene's animation system,
 * wrapping SceneValue for use in components.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  SceneValue,
  SceneValue2D,
  springs,
  type SceneValueOptions,
  type AnimationConfig,
} from '@scene/motion';

/**
 * Return type for useMotion hook
 */
export interface UseMotionReturn {
  /** Current value */
  value: number;
  /** Set value immediately */
  set: (value: number) => void;
  /** Animate to a value */
  animateTo: (target: number, config?: AnimationConfig) => void;
  /** Animate by a relative amount */
  animateBy: (delta: number, config?: AnimationConfig) => void;
  /** Stop animation */
  stop: () => void;
  /** Whether currently animating */
  isAnimating: boolean;
  /** The underlying SceneValue instance */
  sceneValue: SceneValue;
}

/**
 * Hook for a single animated value
 * 
 * @param initial - Initial value
 * @param options - SceneValue options
 * 
 * @example
 * ```tsx
 * function AnimatedBox() {
 *   const { value, animateTo, isAnimating } = useMotion(0);
 *   
 *   return (
 *     <div
 *       style={{ transform: `translateX(${value}px)` }}
 *       onClick={() => animateTo(value === 0 ? 100 : 0, springs.snappy)}
 *     >
 *       {isAnimating ? 'Moving...' : 'Click me'}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMotion(
  initial = 0,
  options: SceneValueOptions = {}
): UseMotionReturn {
  // Create stable SceneValue instance
  const sceneValueRef = useRef<SceneValue | null>(null);
  if (!sceneValueRef.current) {
    sceneValueRef.current = new SceneValue(initial, options);
  }
  const sceneValue = sceneValueRef.current;

  // Track current value in state for re-renders
  const [value, setValue] = useState(initial);
  const [isAnimating, setIsAnimating] = useState(false);

  // Subscribe to value changes
  useEffect(() => {
    const unsubscribe = sceneValue.on('change', (newValue: number) => {
      setValue(newValue);
    });

    return unsubscribe;
  }, [sceneValue]);

  // Track animation state via change events
  // When value stops changing, animation has ended
  useEffect(() => {
    let animationCheckTimeoutId: number | undefined;
    let lastValue = sceneValue.get();
    
    const checkAnimationEnd = () => {
      const currentValue = sceneValue.get();
      if (currentValue === lastValue && isAnimating) {
        // Value hasn't changed, animation likely ended
        setIsAnimating(sceneValue.isAnimating);
      }
      lastValue = currentValue;
    };
    
    // Check periodically but only while animating
    if (isAnimating) {
      animationCheckTimeoutId = window.setInterval(checkAnimationEnd, 50);
    }
    
    return () => {
      if (animationCheckTimeoutId) {
        clearInterval(animationCheckTimeoutId);
      }
    };
  }, [sceneValue, isAnimating]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sceneValueRef.current?.destroy();
    };
  }, []);

  const set = useCallback((newValue: number) => {
    sceneValue.set(newValue);
    setValue(newValue);
    setIsAnimating(false);
  }, [sceneValue]);

  const animateTo = useCallback((target: number, config?: AnimationConfig) => {
    sceneValue.animateTo(target, config ?? springs.default);
    setIsAnimating(true);
  }, [sceneValue]);

  const animateBy = useCallback((delta: number, config?: AnimationConfig) => {
    sceneValue.animateBy(delta, config ?? springs.default);
    setIsAnimating(true);
  }, [sceneValue]);

  const stop = useCallback(() => {
    sceneValue.stop();
    setIsAnimating(false);
  }, [sceneValue]);

  return useMemo(
    () => ({
      value,
      set,
      animateTo,
      animateBy,
      stop,
      isAnimating,
      sceneValue,
    }),
    [value, set, animateTo, animateBy, stop, isAnimating, sceneValue]
  );
}

/**
 * Return type for useMotion2D hook
 */
export interface UseMotion2DReturn {
  /** Current x value */
  x: number;
  /** Current y value */
  y: number;
  /** Set both values immediately */
  set: (x: number, y: number) => void;
  /** Animate to x/y values */
  animateTo: (x: number, y: number, config?: AnimationConfig) => void;
  /** Stop all animations */
  stop: () => void;
  /** Whether currently animating */
  isAnimating: boolean;
  /** The underlying SceneValue2D instance */
  sceneValue: SceneValue2D;
}

/**
 * Hook for 2D animated values
 * 
 * @param initialX - Initial X value
 * @param initialY - Initial Y value
 * @param options - SceneValue options
 * 
 * @example
 * ```tsx
 * function DraggableBox() {
 *   const { x, y, animateTo, set } = useMotion2D(0, 0);
 *   
 *   const handleDragEnd = (endX: number, endY: number) => {
 *     // Snap to grid
 *     const gridX = Math.round(endX / 50) * 50;
 *     const gridY = Math.round(endY / 50) * 50;
 *     animateTo(gridX, gridY, springs.bouncy);
 *   };
 *   
 *   return (
 *     <div style={{ transform: `translate(${x}px, ${y}px)` }}>
 *       Drag me
 *     </div>
 *   );
 * }
 * ```
 */
export function useMotion2D(
  initialX = 0,
  initialY = 0,
  options: SceneValueOptions = {}
): UseMotion2DReturn {
  const sceneValueRef = useRef<SceneValue2D | null>(null);
  if (!sceneValueRef.current) {
    sceneValueRef.current = new SceneValue2D(initialX, initialY, options);
  }
  const sceneValue = sceneValueRef.current;

  const [x, setX] = useState(initialX);
  const [y, setY] = useState(initialY);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const unsubscribe = sceneValue.on('change', (newX: number, newY: number) => {
      setX(newX);
      setY(newY);
    });

    return unsubscribe;
  }, [sceneValue]);

  useEffect(() => {
    const checkAnimating = () => {
      setIsAnimating(sceneValue.isAnimating);
    };
    const intervalId = setInterval(checkAnimating, 16);
    return () => clearInterval(intervalId);
  }, [sceneValue]);

  useEffect(() => {
    return () => {
      sceneValueRef.current?.destroy();
    };
  }, []);

  const set = useCallback((newX: number, newY: number) => {
    sceneValue.set(newX, newY);
    setX(newX);
    setY(newY);
    setIsAnimating(false);
  }, [sceneValue]);

  const animateTo = useCallback((targetX: number, targetY: number, config?: AnimationConfig) => {
    sceneValue.animateTo(targetX, targetY, config ?? springs.default);
    setIsAnimating(true);
  }, [sceneValue]);

  const stop = useCallback(() => {
    sceneValue.stop();
    setIsAnimating(false);
  }, [sceneValue]);

  return useMemo(
    () => ({
      x,
      y,
      set,
      animateTo,
      stop,
      isAnimating,
      sceneValue,
    }),
    [x, y, set, animateTo, stop, isAnimating, sceneValue]
  );
}

/**
 * Hook to bind a SceneValue to a material uniform
 * 
 * @param sceneValue - The SceneValue to bind
 * @param target - Object with setUniform method
 * @param uniformName - Name of the uniform
 * 
 * @example
 * ```tsx
 * function AnimatedMaterial({ material }: Props) {
 *   const { value, animateTo, sceneValue } = useMotion(0);
 *   
 *   // Automatically syncs value to material uniform
 *   useMotionBinding(sceneValue, material, 'uProgress');
 *   
 *   return (
 *     <button onClick={() => animateTo(1)}>
 *       Animate Progress: {value}
 *     </button>
 *   );
 * }
 * ```
 */
export function useMotionBinding(
  sceneValue: SceneValue,
  target: { setUniform(name: string, value: number): void } | null,
  uniformName: string
): void {
  useEffect(() => {
    if (!target) return;
    
    const unbind = sceneValue.bindTo(target, uniformName);
    return unbind;
  }, [sceneValue, target, uniformName]);
}

// Re-export spring presets for convenience
export { springs } from '@scene/motion';
