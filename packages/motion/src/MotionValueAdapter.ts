/**
 * MotionValueAdapter - Bridge between Scene's SceneValue and Motion's MotionValue
 * 
 * Enables two-way synchronization so animated values can drive both
 * GPU uniforms (via SceneValue) and React component styles (via MotionValue).
 */

import { motionValue, type MotionValue } from 'motion';
import { SceneValue, type SceneValueOptions } from './SceneValue';

/**
 * Options for MotionValue adapter
 */
export interface MotionValueAdapterOptions {
  /** 
   * Sync direction
   * - 'both': Changes sync in both directions (default)
   * - 'toMotion': SceneValue → MotionValue only
   * - 'toScene': MotionValue → SceneValue only
   */
  direction?: 'both' | 'toMotion' | 'toScene';
}

/**
 * MotionValueAdapter - Manages two-way sync between SceneValue and MotionValue
 * 
 * @example
 * ```typescript
 * const sceneValue = new SceneValue(0);
 * const adapter = new MotionValueAdapter(sceneValue);
 * 
 * // Use the MotionValue in React components
 * const mv = adapter.motionValue;
 * 
 * // Changes to SceneValue update MotionValue
 * sceneValue.animateTo(100); // mv also goes to 100
 * 
 * // Changes to MotionValue update SceneValue
 * mv.set(50); // sceneValue also goes to 50
 * ```
 */
export class MotionValueAdapter {
  readonly sceneValue: SceneValue;
  readonly motionValue: MotionValue<number>;
  
  private unsubscribeScene: (() => void) | null = null;
  private unsubscribeMotion: (() => void) | null = null;
  private isSyncing = false;
  private options: MotionValueAdapterOptions;

  constructor(sceneValue: SceneValue, options: MotionValueAdapterOptions = {}) {
    this.sceneValue = sceneValue;
    this.options = { direction: 'both', ...options };
    
    // Create MotionValue with current SceneValue
    this.motionValue = motionValue(sceneValue.get());
    
    // Set up synchronization
    this.setupSync();
  }

  /**
   * Set up bidirectional synchronization
   */
  private setupSync(): void {
    const { direction } = this.options;
    
    // SceneValue → MotionValue
    if (direction === 'both' || direction === 'toMotion') {
      this.unsubscribeScene = this.sceneValue.on('change', (value) => {
        if (this.isSyncing) return;
        this.isSyncing = true;
        this.motionValue.set(value);
        this.isSyncing = false;
      });
    }
    
    // MotionValue → SceneValue
    if (direction === 'both' || direction === 'toScene') {
      this.unsubscribeMotion = this.motionValue.on('change', (value) => {
        if (this.isSyncing) return;
        this.isSyncing = true;
        // Use internal set to avoid stopping animations
        this.sceneValue.set(value);
        this.isSyncing = false;
      });
    }
  }

  /**
   * Get the current value (from SceneValue)
   */
  get(): number {
    return this.sceneValue.get();
  }

  /**
   * Disconnect the adapter and clean up subscriptions
   */
  destroy(): void {
    if (this.unsubscribeScene) {
      this.unsubscribeScene();
      this.unsubscribeScene = null;
    }
    if (this.unsubscribeMotion) {
      this.unsubscribeMotion();
      this.unsubscribeMotion = null;
    }
  }
}

/**
 * Create a MotionValue that stays in sync with a SceneValue
 * 
 * This is the primary way to use Scene animations with Motion-powered
 * React components. The returned MotionValue can be used directly in
 * motion components' style prop.
 * 
 * @param sceneValue - The SceneValue to sync with
 * @param options - Adapter options
 * @returns A MotionValue that syncs with the SceneValue
 * 
 * @example
 * ```typescript
 * import { SceneValue, createMotionValue } from '@scene/motion';
 * import { motion } from 'motion/react';
 * 
 * const offset = new SceneValue(0);
 * const mv = createMotionValue(offset);
 * 
 * // Animate SceneValue - MotionValue follows
 * offset.animateTo(100, springs.snappy);
 * 
 * // Use in React
 * function AnimatedBox() {
 *   return <motion.div style={{ x: mv }} />;
 * }
 * ```
 */
export function createMotionValue(
  sceneValue: SceneValue,
  options?: MotionValueAdapterOptions
): MotionValue<number> & { adapter: MotionValueAdapter } {
  const adapter = new MotionValueAdapter(sceneValue, options);
  
  // Attach adapter to MotionValue for lifecycle management
  const mv = adapter.motionValue as MotionValue<number> & { adapter: MotionValueAdapter };
  mv.adapter = adapter;
  
  return mv;
}

/**
 * Create a SceneValue from an existing MotionValue
 * 
 * Useful when you have a MotionValue from a gesture or existing animation
 * and want to bind it to GPU uniforms.
 * 
 * @param mv - The MotionValue to sync with
 * @param options - SceneValue options
 * @returns A SceneValue that syncs with the MotionValue
 * 
 * @example
 * ```typescript
 * import { useMotionValue } from 'motion/react';
 * import { fromMotionValue } from '@scene/motion';
 * 
 * function GestureEffect({ material }) {
 *   const x = useMotionValue(0);
 *   const sceneX = fromMotionValue(x);
 *   
 *   // Bind to GPU uniform
 *   sceneX.bindTo(material, 'uOffsetX');
 *   
 *   return <motion.div style={{ x }} drag />;
 * }
 * ```
 */
export function fromMotionValue(
  mv: MotionValue<number>,
  options?: SceneValueOptions
): SceneValue & { adapter: MotionValueAdapter } {
  const sceneValue = new SceneValue(mv.get(), options);
  const adapter = new MotionValueAdapter(sceneValue, { direction: 'toScene' });
  
  // Override the default unidirectional sync with bidirectional
  // by also subscribing MotionValue to SceneValue changes
  const unsubMotion = mv.on('change', (value) => {
    sceneValue.set(value);
  });
  
  // Store cleanup
  const originalDestroy = adapter.destroy.bind(adapter);
  adapter.destroy = () => {
    unsubMotion();
    originalDestroy();
  };
  
  // Attach adapter to SceneValue for lifecycle management
  const sv = sceneValue as SceneValue & { adapter: MotionValueAdapter };
  sv.adapter = adapter;
  
  return sv;
}

/**
 * Type guard to check if a MotionValue has an adapter attached
 */
export function hasAdapter(
  mv: MotionValue<number>
): mv is MotionValue<number> & { adapter: MotionValueAdapter } {
  return 'adapter' in mv && mv.adapter instanceof MotionValueAdapter;
}

/**
 * Destroy the adapter attached to a MotionValue or SceneValue
 */
export function destroyAdapter(
  value: MotionValue<number> | SceneValue
): void {
  if ('adapter' in value && value.adapter instanceof MotionValueAdapter) {
    value.adapter.destroy();
  }
}
