/**
 * useMotionBridge - Hook for bridging SceneValue with Motion's MotionValue
 * 
 * Provides React-friendly lifecycle management for the MotionValueAdapter,
 * enabling two-way sync between Scene animations and Motion components.
 */

import { useEffect, useRef, useMemo, useState } from 'react';
import {
  SceneValue,
  MotionValueAdapter,
  createMotionValue,
  type MotionValueAdapterOptions,
  type MotionValue,
} from '@scene/motion';

/**
 * Hook to bridge a SceneValue with a MotionValue for React components
 * 
 * Creates and manages a MotionValue that stays in sync with a SceneValue.
 * The returned MotionValue can be used directly in motion components.
 * 
 * @param sceneValue - The SceneValue to bridge
 * @param options - Adapter options for sync direction
 * @returns A MotionValue that syncs with the SceneValue
 * 
 * @example
 * ```tsx
 * import { SceneValue, springs } from '@scene/motion';
 * import { motion } from 'motion/react';
 * import { useMotionBridge } from '@scene/react';
 * 
 * function AnimatedCard({ sceneValue }: { sceneValue: SceneValue }) {
 *   // Create a MotionValue that syncs with the SceneValue
 *   const x = useMotionBridge(sceneValue);
 *   
 *   return (
 *     <motion.div 
 *       style={{ x }}
 *       className="card"
 *     >
 *       Animated by Scene!
 *     </motion.div>
 *   );
 * }
 * 
 * // Usage:
 * const offset = new SceneValue(0);
 * offset.bindTo(material, 'uOffset'); // GPU uniform
 * 
 * // Both GPU and DOM animate together
 * offset.animateTo(200, springs.snappy);
 * ```
 */
export function useMotionBridge(
  sceneValue: SceneValue,
  options?: MotionValueAdapterOptions
): MotionValue<number> {
  // Create adapter with stable reference
  const adapterRef = useRef<MotionValueAdapter | null>(null);
  
  // Create/recreate adapter when sceneValue changes
  const motionValue = useMemo(() => {
    // Clean up previous adapter
    if (adapterRef.current) {
      adapterRef.current.destroy();
    }
    
    const mv = createMotionValue(sceneValue, options);
    adapterRef.current = mv.adapter;
    
    return mv as MotionValue<number>;
  }, [sceneValue, options?.direction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (adapterRef.current) {
        adapterRef.current.destroy();
        adapterRef.current = null;
      }
    };
  }, []);

  return motionValue;
}

/**
 * Hook to create multiple bridged MotionValues from SceneValues
 * 
 * Useful when you have multiple SceneValues to bridge at once.
 * 
 * @param sceneValues - Object map of SceneValues
 * @param options - Adapter options (applied to all)
 * @returns Object map of MotionValues
 * 
 * @example
 * ```tsx
 * function AnimatedElement({ values }) {
 *   const { x, y, scale } = useMotionBridgeMany({
 *     x: values.offsetX,
 *     y: values.offsetY,
 *     scale: values.zoom,
 *   });
 *   
 *   return (
 *     <motion.div style={{ x, y, scale }}>
 *       Multi-animated!
 *     </motion.div>
 *   );
 * }
 * ```
 */
export function useMotionBridgeMany<T extends Record<string, SceneValue>>(
  sceneValues: T,
  options?: MotionValueAdapterOptions
): { [K in keyof T]: MotionValue<number> } {
  const adaptersRef = useRef<Map<string, MotionValueAdapter>>(new Map());
  
  const motionValues = useMemo(() => {
    // Clean up old adapters that are no longer needed
    const newKeys = new Set(Object.keys(sceneValues));
    for (const [key, adapter] of adaptersRef.current) {
      if (!newKeys.has(key)) {
        adapter.destroy();
        adaptersRef.current.delete(key);
      }
    }
    
    // Create/update adapters
    const result: Record<string, MotionValue<number>> = {};
    
    for (const [key, sv] of Object.entries(sceneValues)) {
      const existingAdapter = adaptersRef.current.get(key);
      
      // Reuse existing adapter if SceneValue hasn't changed
      if (existingAdapter && existingAdapter.sceneValue === sv) {
        result[key] = existingAdapter.motionValue;
      } else {
        // Clean up old adapter for this key
        if (existingAdapter) {
          existingAdapter.destroy();
        }
        
        // Create new adapter
        const mv = createMotionValue(sv, options);
        adaptersRef.current.set(key, mv.adapter);
        result[key] = mv as MotionValue<number>;
      }
    }
    
    return result as { [K in keyof T]: MotionValue<number> };
  }, [sceneValues, options?.direction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const adapter of adaptersRef.current.values()) {
        adapter.destroy();
      }
      adaptersRef.current.clear();
    };
  }, []);

  return motionValues;
}

/**
 * Return type for useMotionBridgeWithState
 */
export interface UseMotionBridgeWithStateReturn {
  /** MotionValue for use in motion components */
  motionValue: MotionValue<number>;
  /** Current value (triggers re-renders) */
  value: number;
  /** The underlying SceneValue */
  sceneValue: SceneValue;
}

/**
 * Hook that bridges SceneValue to MotionValue AND tracks value in React state
 * 
 * Useful when you need to both animate with MotionValue and display the
 * current value in your component.
 * 
 * @param sceneValue - The SceneValue to bridge
 * @param options - Adapter options
 * @returns Object with motionValue, current value, and sceneValue
 * 
 * @example
 * ```tsx
 * function AnimatedProgress({ sceneValue }) {
 *   const { motionValue, value } = useMotionBridgeWithState(sceneValue);
 *   
 *   return (
 *     <div>
 *       <motion.div 
 *         style={{ scaleX: motionValue }}
 *         className="progress-bar"
 *       />
 *       <span>{Math.round(value * 100)}%</span>
 *     </div>
 *   );
 * }
 * ```
 */
export function useMotionBridgeWithState(
  sceneValue: SceneValue,
  options?: MotionValueAdapterOptions
): UseMotionBridgeWithStateReturn {
  const motionValue = useMotionBridge(sceneValue, options);
  
  // Track value in React state for re-renders
  const [value, setValue] = useState(sceneValue.get());
  
  useEffect(() => {
    const unsubscribe = sceneValue.on('change', setValue);
    return unsubscribe;
  }, [sceneValue]);

  return useMemo(
    () => ({ motionValue, value, sceneValue }),
    [motionValue, value, sceneValue]
  );
}
