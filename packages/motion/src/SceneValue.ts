/**
 * SceneValue - Animated value that syncs with Scene uniforms
 * 
 * Wraps Motion's animation system to provide a simple API for
 * animating values and binding them to GPU uniforms.
 */

import { animate, type AnimationPlaybackControls } from 'motion';
import type { AnimationConfig } from './springs';
import { springs } from './springs';

/** Callback for value change events */
export type ValueChangeCallback = (value: number) => void;

/** Options for SceneValue animations */
export interface SceneValueOptions {
  /** Initial value */
  initial?: number;
  /** Clamp value to min/max bounds */
  clamp?: { min?: number; max?: number };
  /** Round value to nearest integer */
  round?: boolean;
}

/**
 * Material-like interface for uniform binding
 * This allows SceneValue to work with any object that has setUniform
 */
export interface UniformTarget {
  setUniform(name: string, value: number): void;
}

/**
 * SceneValue - An animated value for Scene
 * 
 * Provides a reactive value that can be animated using Motion's
 * spring physics and bound to GPU uniforms.
 * 
 * @example
 * ```typescript
 * const offset = new SceneValue(0);
 * 
 * // Animate with spring
 * offset.animateTo(500, { type: 'spring', stiffness: 300 });
 * 
 * // Subscribe to changes
 * offset.on('change', (v) => console.log(v));
 * 
 * // Bind to material
 * offset.bindTo(material, 'uOffset');
 * ```
 */
export class SceneValue {
  private _value: number;
  private listeners: Set<ValueChangeCallback> = new Set();
  private bindings: Map<UniformTarget, string> = new Map();
  private animation: AnimationPlaybackControls | null = null;
  private options: SceneValueOptions;

  constructor(initial = 0, options: SceneValueOptions = {}) {
    this._value = initial;
    this.options = options;
    
    if (options.initial !== undefined) {
      this._value = options.initial;
    }
  }

  /**
   * Get the current value
   */
  get(): number {
    return this._value;
  }

  /**
   * Set the value immediately (no animation)
   */
  set(value: number): void {
    // Stop any running animation
    this.stop();
    this.setValue(value);
  }

  /**
   * Animate to a target value
   * 
   * @param target - Target value to animate to
   * @param options - Animation options (spring or tween config)
   * @returns Animation controls
   * 
   * @example
   * ```typescript
   * // Spring animation
   * value.animateTo(100, { type: 'spring', stiffness: 300, damping: 30 });
   * 
   * // Tween animation
   * value.animateTo(100, { duration: 0.3, ease: 'easeOut' });
   * 
   * // Using presets
   * import { springs } from '@scene/motion';
   * value.animateTo(100, springs.snappy);
   * ```
   */
  animateTo(
    target: number,
    options: AnimationConfig = springs.default
  ): AnimationPlaybackControls {
    // Stop any existing animation
    this.stop();

    // Create the animation with Motion's animate function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.animation = animate(this._value, target, {
      ...(options as any),
      onUpdate: (latest: number) => {
        this.setValue(latest);
      },
      onComplete: () => {
        this.animation = null;
      },
    });

    return this.animation;
  }

  /**
   * Animate by a relative amount
   * 
   * @param delta - Amount to add to current value
   * @param options - Animation options
   */
  animateBy(
    delta: number,
    options: AnimationConfig = springs.default
  ): AnimationPlaybackControls {
    return this.animateTo(this._value + delta, options);
  }

  /**
   * Stop any running animation
   */
  stop(): void {
    if (this.animation) {
      this.animation.stop();
      this.animation = null;
    }
  }

  /**
   * Check if currently animating
   */
  get isAnimating(): boolean {
    return this.animation !== null;
  }

  /**
   * Subscribe to value changes
   * 
   * @param callback - Function called with new value on each change
   * @returns Unsubscribe function
   */
  on(event: 'change', callback: ValueChangeCallback): () => void {
    if (event !== 'change') {
      throw new Error(`Unknown event: ${event}`);
    }
    
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Bind this value to a material uniform
   * 
   * When the value changes, the uniform will be automatically updated.
   * 
   * @param target - Object with setUniform method
   * @param uniformName - Name of the uniform to update
   * @returns Unbind function
   */
  bindTo(target: UniformTarget, uniformName: string): () => void {
    this.bindings.set(target, uniformName);
    
    // Set initial value
    target.setUniform(uniformName, this._value);
    
    return () => {
      this.bindings.delete(target);
    };
  }

  /**
   * Unbind from all targets
   */
  unbindAll(): void {
    this.bindings.clear();
  }

  /**
   * Clean up all subscriptions and animations
   */
  destroy(): void {
    this.stop();
    this.listeners.clear();
    this.bindings.clear();
  }

  /**
   * Internal: Set value and notify listeners
   */
  private setValue(value: number): void {
    // Apply clamping
    if (this.options.clamp) {
      const { min, max } = this.options.clamp;
      if (min !== undefined && value < min) value = min;
      if (max !== undefined && value > max) value = max;
    }

    // Apply rounding
    if (this.options.round) {
      value = Math.round(value);
    }

    // Skip if value hasn't changed
    if (value === this._value) return;

    this._value = value;

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(value);
      } catch (error) {
        console.error('Error in SceneValue listener:', error);
      }
    }

    // Update bound uniforms
    for (const [target, uniformName] of this.bindings) {
      try {
        target.setUniform(uniformName, value);
      } catch (error) {
        console.error('Error updating bound uniform:', error);
      }
    }
  }
}

/**
 * Create a SceneValue with spring animation helpers
 * 
 * @param initial - Initial value
 * @param options - SceneValue options
 * 
 * @example
 * ```typescript
 * const offset = createSceneValue(0, { clamp: { min: 0, max: 1000 } });
 * offset.animateTo(500, springs.snappy);
 * ```
 */
export function createSceneValue(
  initial = 0,
  options: SceneValueOptions = {}
): SceneValue {
  return new SceneValue(initial, options);
}

/**
 * SceneValue2D - Animated 2D vector value
 * 
 * Manages two SceneValues as a single unit for x/y animations.
 */
export class SceneValue2D {
  readonly x: SceneValue;
  readonly y: SceneValue;

  constructor(initialX = 0, initialY = 0, options: SceneValueOptions = {}) {
    this.x = new SceneValue(initialX, options);
    this.y = new SceneValue(initialY, options);
  }

  /**
   * Get current values as tuple
   */
  get(): [number, number] {
    return [this.x.get(), this.y.get()];
  }

  /**
   * Set both values immediately
   */
  set(x: number, y: number): void {
    this.x.set(x);
    this.y.set(y);
  }

  /**
   * Animate both values
   */
  animateTo(
    targetX: number,
    targetY: number,
    options: AnimationConfig = springs.default
  ): void {
    this.x.animateTo(targetX, options);
    this.y.animateTo(targetY, options);
  }

  /**
   * Stop both animations
   */
  stop(): void {
    this.x.stop();
    this.y.stop();
  }

  /**
   * Check if either value is animating
   */
  get isAnimating(): boolean {
    return this.x.isAnimating || this.y.isAnimating;
  }

  /**
   * Subscribe to changes on both values
   */
  on(
    _event: 'change',
    callback: (x: number, y: number) => void
  ): () => void {
    const unsubX = this.x.on('change', () => callback(this.x.get(), this.y.get()));
    const unsubY = this.y.on('change', () => callback(this.x.get(), this.y.get()));
    return () => {
      unsubX();
      unsubY();
    };
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.x.destroy();
    this.y.destroy();
  }
}
