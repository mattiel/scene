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

/** Callback for velocity change events */
export type VelocityChangeCallback = (velocity: number) => void;

/** Options for SceneValue animations */
export interface SceneValueOptions {
  /** Initial value */
  initial?: number;
  /** Clamp value to min/max bounds */
  clamp?: { min?: number; max?: number };
  /** Round value to nearest integer */
  round?: boolean;
  /** Track velocity (enables velocity events) */
  trackVelocity?: boolean;
}

/** Interpolation range mapping */
export interface InterpolateOptions {
  /** Input range [from, to] */
  inputRange: [number, number];
  /** Output range [from, to] */
  outputRange: [number, number];
  /** Clamp output to outputRange bounds */
  clamp?: boolean;
  /** Extrapolation method when outside inputRange */
  extrapolate?: 'extend' | 'clamp' | 'identity';
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
  private _velocity: number = 0;
  private _lastValue: number;
  private _lastTime: number = 0;
  private listeners: Set<ValueChangeCallback> = new Set();
  private velocityListeners: Set<VelocityChangeCallback> = new Set();
  private bindings: Map<UniformTarget, string> = new Map();
  private animation: AnimationPlaybackControls | null = null;
  private options: SceneValueOptions;
  private derivedValues: Set<DerivedSceneValue> = new Set();

  constructor(initial = 0, options: SceneValueOptions = {}) {
    this._value = initial;
    this._lastValue = initial;
    this.options = options;
    
    if (options.initial !== undefined) {
      this._value = options.initial;
      this._lastValue = options.initial;
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
   * Get current velocity (requires trackVelocity option)
   */
  get velocity(): number {
    return this._velocity;
  }

  // ============================================
  // Derived Values
  // ============================================

  /**
   * Create a derived value that automatically updates when this value changes
   * 
   * @param transform - Function to transform the value
   * @returns A new SceneValue that stays in sync
   * 
   * @example
   * ```typescript
   * const offset = new SceneValue(0);
   * 
   * // Create a derived value that's always double
   * const doubled = offset.derive(v => v * 2);
   * 
   * // Create a normalized progress (0-1)
   * const progress = offset.derive(v => v / maxOffset);
   * 
   * // Chain derives
   * const opacity = progress.derive(p => 1 - p);
   * ```
   */
  derive(transform: (value: number) => number): DerivedSceneValue {
    const derived = new DerivedSceneValue(this, transform);
    this.derivedValues.add(derived);
    return derived;
  }

  /**
   * Create an interpolated value that maps this value to a different range
   * 
   * @param options - Interpolation options
   * @returns A new SceneValue that interpolates this value
   * 
   * @example
   * ```typescript
   * const scroll = new SceneValue(0);
   * 
   * // Map scroll 0-1000 to opacity 1-0
   * const opacity = scroll.interpolate({
   *   inputRange: [0, 1000],
   *   outputRange: [1, 0],
   *   clamp: true
   * });
   * 
   * // Map scroll 0-500 to scale 1-1.5
   * const scale = scroll.interpolate({
   *   inputRange: [0, 500],
   *   outputRange: [1, 1.5],
   *   extrapolate: 'clamp'
   * });
   * ```
   */
  interpolate(options: InterpolateOptions): DerivedSceneValue {
    const { inputRange, outputRange, clamp = false, extrapolate = 'extend' } = options;
    const [inMin, inMax] = inputRange;
    const [outMin, outMax] = outputRange;
    
    return this.derive((value) => {
      // Calculate normalized position in input range
      let t = (value - inMin) / (inMax - inMin);
      
      // Handle extrapolation
      if (t < 0 || t > 1) {
        if (extrapolate === 'clamp' || clamp) {
          t = Math.max(0, Math.min(1, t));
        } else if (extrapolate === 'identity') {
          return value;
        }
        // 'extend' continues linearly
      }
      
      // Map to output range
      return outMin + t * (outMax - outMin);
    });
  }

  /**
   * Create a derived value that blends this value with another
   * 
   * @param other - The other SceneValue to blend with
   * @param ratio - Blend ratio (0 = this, 1 = other) - number or SceneValue
   * @returns A derived value that blends the two sources
   * 
   * @example
   * ```typescript
   * const start = new SceneValue(0);
   * const end = new SceneValue(100);
   * 
   * // Static blend at 50%
   * const mid = start.mix(end, 0.5); // → 50
   * 
   * // Dynamic blend controlled by another value
   * const progress = new SceneValue(0);
   * const blended = start.mix(end, progress);
   * progress.animateTo(1); // blended goes from 0 → 100
   * ```
   */
  mix(other: SceneValue, ratio: number | SceneValue): DerivedSceneValue {
    if (typeof ratio === 'number') {
      // Static ratio - simple linear interpolation
      return this.derive((value) => {
        return value + (other.get() - value) * ratio;
      });
    } else {
      // Dynamic ratio - create a multi-source derived value
      const derived = new MultiSourceDerivedSceneValue(
        [this, other, ratio],
        ([a, b, t]) => a + (b - a) * t
      );
      this.derivedValues.add(derived);
      other._addDerived(derived);
      ratio._addDerived(derived);
      return derived;
    }
  }

  /**
   * Create a derived value that clamps this value to bounds
   * 
   * Unlike the constructor `clamp` option (which mutates during set),
   * this creates a read-only derived view with clamped output.
   * 
   * @param min - Minimum bound
   * @param max - Maximum bound
   * @returns A derived value clamped to [min, max]
   * 
   * @example
   * ```typescript
   * const raw = new SceneValue(150);
   * const clamped = raw.clamp(0, 100); // → 100
   * 
   * raw.set(-50);
   * console.log(clamped.get()); // → 0
   * console.log(raw.get()); // → -50 (unchanged)
   * ```
   */
  clamp(min: number, max: number): DerivedSceneValue {
    return this.derive((value) => Math.max(min, Math.min(max, value)));
  }

  /**
   * Create a derived value that snaps to the nearest value in an array
   * 
   * @param values - Array of values to snap to (must be sorted)
   * @returns A derived value that snaps to nearest
   * 
   * @example
   * ```typescript
   * const position = new SceneValue(73);
   * const snapped = position.snap([0, 50, 100]); // → 50
   * 
   * position.set(80);
   * console.log(snapped.get()); // → 100
   * ```
   */
  snap(values: number[]): DerivedSceneValue {
    if (values.length === 0) {
      throw new Error('snap() requires at least one value');
    }
    
    // Sort values for binary search
    const sorted = [...values].sort((a, b) => a - b);
    
    return this.derive((value) => {
      // Binary search for closest value
      let left = 0;
      let right = sorted.length - 1;
      
      // Handle edge cases
      if (value <= sorted[0]) return sorted[0];
      if (value >= sorted[right]) return sorted[right];
      
      // Binary search for the two closest values
      while (left < right - 1) {
        const mid = Math.floor((left + right) / 2);
        if (sorted[mid] === value) return value;
        if (sorted[mid] < value) {
          left = mid;
        } else {
          right = mid;
        }
      }
      
      // Return the closer of the two
      const distLeft = Math.abs(value - sorted[left]);
      const distRight = Math.abs(value - sorted[right]);
      return distLeft <= distRight ? sorted[left] : sorted[right];
    });
  }

  /**
   * Internal: Add a derived value to track (for multi-source derived values)
   */
  _addDerived(derived: DerivedSceneValue): void {
    this.derivedValues.add(derived);
  }

  /**
   * Remove a derived value (called internally when derived is destroyed)
   */
  _removeDerived(derived: DerivedSceneValue): void {
    this.derivedValues.delete(derived);
  }

  // ============================================
  // Velocity Tracking
  // ============================================

  /**
   * Subscribe to velocity changes
   * Only fires if trackVelocity option is enabled
   */
  onVelocityChange(callback: VelocityChangeCallback): () => void {
    this.velocityListeners.add(callback);
    return () => {
      this.velocityListeners.delete(callback);
    };
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
    this.velocityListeners.clear();
    this.bindings.clear();
    
    // Destroy all derived values
    for (const derived of this.derivedValues) {
      derived.destroy();
    }
    this.derivedValues.clear();
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

    // Track velocity if enabled
    if (this.options.trackVelocity) {
      const now = performance.now();
      const dt = now - this._lastTime;
      
      if (dt > 0 && this._lastTime > 0) {
        const newVelocity = (value - this._lastValue) / dt * 1000; // velocity per second
        
        if (newVelocity !== this._velocity) {
          this._velocity = newVelocity;
          
          // Notify velocity listeners
          for (const listener of this.velocityListeners) {
            try {
              listener(this._velocity);
            } catch (error) {
              console.error('Error in SceneValue velocity listener:', error);
            }
          }
        }
      }
      
      this._lastValue = value;
      this._lastTime = now;
    }

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

    // Update derived values
    for (const derived of this.derivedValues) {
      derived._update();
    }
  }
}

/**
 * DerivedSceneValue - A read-only value derived from another SceneValue
 * 
 * Created via SceneValue.derive() or SceneValue.interpolate()
 */
export class DerivedSceneValue {
  private source: SceneValue;
  private transform: (value: number) => number;
  private _value: number;
  private listeners: Set<ValueChangeCallback> = new Set();
  private bindings: Map<UniformTarget, string> = new Map();

  constructor(source: SceneValue, transform: (value: number) => number) {
    this.source = source;
    this.transform = transform;
    this._value = transform(source.get());
  }

  /**
   * Get the current derived value
   */
  get(): number {
    return this._value;
  }

  /**
   * Subscribe to value changes
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
   */
  bindTo(target: UniformTarget, uniformName: string): () => void {
    this.bindings.set(target, uniformName);
    target.setUniform(uniformName, this._value);
    
    return () => {
      this.bindings.delete(target);
    };
  }

  /**
   * Create a further derived value
   */
  derive(transform: (value: number) => number): DerivedSceneValue {
    return this.source.derive((v) => transform(this.transform(v)));
  }

  /**
   * Create an interpolated value from this derived value
   */
  interpolate(options: InterpolateOptions): DerivedSceneValue {
    const { inputRange, outputRange, clamp = false, extrapolate = 'extend' } = options;
    const [inMin, inMax] = inputRange;
    const [outMin, outMax] = outputRange;
    
    return this.derive((value) => {
      let t = (value - inMin) / (inMax - inMin);
      
      if (t < 0 || t > 1) {
        if (extrapolate === 'clamp' || clamp) {
          t = Math.max(0, Math.min(1, t));
        } else if (extrapolate === 'identity') {
          return value;
        }
      }
      
      return outMin + t * (outMax - outMin);
    });
  }

  /**
   * Internal: Update derived value when source changes
   */
  _update(): void {
    const newValue = this.transform(this.source.get());
    
    if (newValue === this._value) return;
    
    this._value = newValue;

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(newValue);
      } catch (error) {
        console.error('Error in DerivedSceneValue listener:', error);
      }
    }

    // Update bound uniforms
    for (const [target, uniformName] of this.bindings) {
      try {
        target.setUniform(uniformName, newValue);
      } catch (error) {
        console.error('Error updating bound uniform:', error);
      }
    }
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.source._removeDerived(this);
    this.listeners.clear();
    this.bindings.clear();
  }
}

/**
 * MultiSourceDerivedSceneValue - A derived value from multiple SceneValue sources
 * 
 * Used internally for operations like mix() with dynamic ratio.
 */
export class MultiSourceDerivedSceneValue extends DerivedSceneValue {
  private sources: SceneValue[];
  private multiTransform: (values: number[]) => number;

  constructor(
    sources: SceneValue[],
    transform: (values: number[]) => number
  ) {
    // Call parent with first source and a placeholder transform
    super(sources[0], () => 0);
    
    this.sources = sources;
    this.multiTransform = transform;
    
    // Calculate initial value
    (this as any)._value = this.multiTransform(sources.map(s => s.get()));
  }

  /**
   * Override _update to use all sources
   */
  _update(): void {
    const values = this.sources.map(s => s.get());
    const newValue = this.multiTransform(values);
    
    if (newValue === (this as any)._value) return;
    
    (this as any)._value = newValue;

    // Notify listeners
    for (const listener of (this as any).listeners) {
      try {
        listener(newValue);
      } catch (error) {
        console.error('Error in MultiSourceDerivedSceneValue listener:', error);
      }
    }

    // Update bound uniforms
    for (const [target, uniformName] of (this as any).bindings) {
      try {
        target.setUniform(uniformName, newValue);
      } catch (error) {
        console.error('Error updating bound uniform:', error);
      }
    }
  }

  /**
   * Clean up - remove from all sources
   */
  destroy(): void {
    for (const source of this.sources) {
      source._removeDerived(this);
    }
    (this as any).listeners.clear();
    (this as any).bindings.clear();
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
