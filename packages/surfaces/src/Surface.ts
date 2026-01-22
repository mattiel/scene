/**
 * Surface - Links a DOM element to its GPU representation
 * 
 * A Surface is the fundamental building block of Scene's rendering system.
 * It maintains the connection between a DOM element and its GPU quad,
 * tracking layout changes and providing APIs for visual effects.
 */

/// <reference types="@webgpu/types" />

import type { SurfaceEffect } from './effects/SurfaceEffect';
import { SurfaceEffectStack } from './effects/SurfaceEffectStack';
import { 
  decomposeTransform, 
  IDENTITY_TRANSFORM,
  type DecomposedTransform 
} from './TransformUtils';

export interface SurfaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SurfaceOptions {
  /** Whether to track visibility via IntersectionObserver */
  trackVisibility?: boolean;
  /** Whether to automatically capture the element's visual appearance */
  captureTexture?: boolean;
  /** Custom texture for the surface (if not capturing from DOM) */
  texture?: GPUTexture | null;
  /** Z-index for layering (default: parsed from CSS or 0) */
  zIndex?: number;
}

export type SurfaceMotionProperty = 
  | 'x' 
  | 'y' 
  | 'scale' 
  | 'rotation' 
  | 'opacity' 
  | 'distortion';

/**
 * Surface class
 * 
 * Represents a single tracked DOM element with GPU augmentation.
 * Surfaces can be:
 * - Regular: linked to a live DOM element
 * - Ghost: temporary GPU-only surface for transitions (no DOM element)
 */
export class Surface {
  readonly id: string;
  
  private _element: HTMLElement | null;
  private _rect: SurfaceRect;
  private _transform: DecomposedTransform;
  private _isVisible: boolean = true;
  private _isGhost: boolean = false;
  private _zIndex: number = 0;
  private _texture: GPUTexture | null = null;
  
  // Motion properties (can be bound to motion values or set statically)
  private _motionValues: Map<SurfaceMotionProperty, number> = new Map();
  
  // Effect stack for per-surface effects
  private _effectStack: SurfaceEffectStack | null = null;
  
  // Callbacks (supports multiple subscribers)
  private _onLayoutChangeCallbacks: Set<(rect: SurfaceRect) => void> = new Set();
  private _onVisibilityChangeCallbacks: Set<(visible: boolean) => void> = new Set();
  private _onZIndexChangeCallbacks: Set<(zIndex: number) => void> = new Set();
  private _onTransformChangeCallbacks: Set<(transform: DecomposedTransform) => void> = new Set();
  
  constructor(
    id: string, 
    element: HTMLElement | null,
    options: SurfaceOptions = {}
  ) {
    this.id = id;
    this._element = element;
    this._isGhost = element === null;
    
    // Initialize rect and transform
    if (element) {
      const rect = element.getBoundingClientRect();
      this._rect = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };
      
      // Decompose CSS transform
      this._transform = decomposeTransform(element);
      
      // Parse z-index from computed style if not provided
      if (options.zIndex === undefined) {
        const computedStyle = window.getComputedStyle(element);
        const zIndex = parseInt(computedStyle.zIndex, 10);
        this._zIndex = isNaN(zIndex) ? 0 : zIndex;
      } else {
        this._zIndex = options.zIndex;
      }
    } else {
      // Ghost surface - requires manual rect setting
      this._rect = { x: 0, y: 0, width: 0, height: 0 };
      this._transform = { ...IDENTITY_TRANSFORM };
      this._zIndex = options.zIndex ?? 0;
    }
    
    if (options.texture) {
      this._texture = options.texture;
    }
    
    // Initialize motion values with defaults
    this._motionValues.set('x', 0);
    this._motionValues.set('y', 0);
    this._motionValues.set('scale', 1);
    this._motionValues.set('rotation', 0);
    this._motionValues.set('opacity', 1);
    this._motionValues.set('distortion', 0);
  }

  /**
   * Get the DOM element (null for ghost surfaces)
   */
  get element(): HTMLElement | null {
    return this._element;
  }

  /**
   * Get the current layout rect
   */
  get rect(): Readonly<SurfaceRect> {
    return this._rect;
  }

  /**
   * Get whether the surface is visible
   */
  get isVisible(): boolean {
    return this._isVisible;
  }

  /**
   * Get whether this is a ghost surface (no DOM element)
   */
  get isGhost(): boolean {
    return this._isGhost;
  }

  /**
   * Get the decomposed CSS transform
   */
  get transform(): Readonly<DecomposedTransform> {
    return this._transform;
  }

  /**
   * Get the z-index for layering
   */
  get zIndex(): number {
    return this._zIndex;
  }

  /**
   * Set the z-index
   */
  set zIndex(value: number) {
    if (this._zIndex !== value) {
      this._zIndex = value;
      for (const callback of this._onZIndexChangeCallbacks) {
        callback(value);
      }
    }
  }

  /**
   * Get the GPU texture (may be null if not yet captured)
   */
  get texture(): GPUTexture | null {
    return this._texture;
  }

  /**
   * Set a custom GPU texture
   */
  set texture(texture: GPUTexture | null) {
    this._texture = texture;
  }

  /**
   * Update the layout rect
   * @internal Called by LayoutTracker
   */
  _updateRect(rect: SurfaceRect): void {
    this._rect = rect;
    for (const callback of this._onLayoutChangeCallbacks) {
      callback(rect);
    }
  }

  /**
   * Update visibility state
   * @internal Called by LayoutTracker
   */
  _updateVisibility(visible: boolean): void {
    if (this._isVisible !== visible) {
      this._isVisible = visible;
      for (const callback of this._onVisibilityChangeCallbacks) {
        callback(visible);
      }
    }
  }

  /**
   * Update the transform
   * @internal Called by LayoutTracker
   */
  _updateTransform(transform: DecomposedTransform): void {
    this._transform = transform;
    for (const callback of this._onTransformChangeCallbacks) {
      callback(transform);
    }
  }

  /**
   * Set a motion property value statically
   * @param property - The property to set
   * @param value - The static value
   */
  set(property: SurfaceMotionProperty, value: number): void {
    this._motionValues.set(property, value);
  }

  /**
   * Get a motion property value
   * @param property - The property to get
   */
  get(property: SurfaceMotionProperty): number {
    return this._motionValues.get(property) ?? 0;
  }

  /**
   * Bind a motion property to a reactive value
   * TODO: This will be fully implemented when motion system is added
   * For now, this is just a placeholder for the API
   */
  bind(property: SurfaceMotionProperty, value: number | (() => number)): void {
    if (typeof value === 'function') {
      // In the future, this would set up a reactive binding
      // For now, just set the value
      this._motionValues.set(property, value());
    } else {
      this._motionValues.set(property, value);
    }
  }

  /**
   * Subscribe to layout changes
   * Supports multiple subscribers - callbacks are not overwritten
   * @returns Unsubscribe function
   */
  onLayoutChange(callback: (rect: SurfaceRect) => void): () => void {
    this._onLayoutChangeCallbacks.add(callback);
    return () => {
      this._onLayoutChangeCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to visibility changes
   * Supports multiple subscribers - callbacks are not overwritten
   * @returns Unsubscribe function
   */
  onVisibilityChange(callback: (visible: boolean) => void): () => void {
    this._onVisibilityChangeCallbacks.add(callback);
    return () => {
      this._onVisibilityChangeCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to z-index changes
   * Supports multiple subscribers - callbacks are not overwritten
   * @returns Unsubscribe function
   */
  onZIndexChange(callback: (zIndex: number) => void): () => void {
    this._onZIndexChangeCallbacks.add(callback);
    return () => {
      this._onZIndexChangeCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to transform changes
   * Supports multiple subscribers - callbacks are not overwritten
   * @returns Unsubscribe function
   */
  onTransformChange(callback: (transform: DecomposedTransform) => void): () => void {
    this._onTransformChangeCallbacks.add(callback);
    return () => {
      this._onTransformChangeCallbacks.delete(callback);
    };
  }

  /**
   * Capture the element's visual appearance to a texture
   * TODO: This will be implemented when renderer integration is added
   */
  async captureTexture(): Promise<void> {
    if (!this._element) {
      throw new Error('Cannot capture texture from ghost surface');
    }
    
    // This will be implemented in a future phase
    // For now, this is a placeholder
    console.warn('Surface.captureTexture() not yet implemented');
  }

  /**
   * Update the rect and transform from the current DOM element
   * Useful for manual updates outside of LayoutTracker
   */
  updateFromDOM(): void {
    if (!this._element) {
      throw new Error('Cannot update from DOM on ghost surface');
    }
    
    const rect = this._element.getBoundingClientRect();
    this._updateRect({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    });
    
    // Update transform
    const transform = decomposeTransform(this._element);
    this._updateTransform(transform);
  }

  // ============================================
  // Effect System
  // ============================================

  /**
   * Get the effect stack for this surface
   * Creates it lazily on first access
   */
  get effects(): SurfaceEffectStack {
    if (!this._effectStack) {
      this._effectStack = new SurfaceEffectStack(this);
    }
    return this._effectStack;
  }

  /**
   * Check if this surface has any effects
   */
  get hasEffects(): boolean {
    return this._effectStack !== null && this._effectStack.count > 0;
  }

  /**
   * Add an effect to this surface
   * 
   * @param effect - The effect to add
   * @param index - Optional index to insert at
   * @returns Promise that resolves when effect is ready
   * 
   * @example
   * ```typescript
   * surface.addEffect(new BlurEffect({ radius: 10 }));
   * surface.addEffect(new GlowEffect({ intensity: 2 }), 0); // Insert at start
   * ```
   */
  async addEffect(effect: SurfaceEffect, index?: number): Promise<this> {
    await this.effects.add(effect, index);
    return this;
  }

  /**
   * Remove an effect by ID
   * 
   * @param effectId - The ID of the effect to remove
   * @returns True if effect was removed
   */
  removeEffect(effectId: string): boolean {
    if (!this._effectStack) return false;
    return this._effectStack.remove(effectId);
  }

  /**
   * Get an effect by ID
   */
  getEffect(effectId: string): SurfaceEffect | undefined {
    return this._effectStack?.get(effectId);
  }

  /**
   * Check if surface has a specific effect
   */
  hasEffect(effectId: string): boolean {
    return this._effectStack?.has(effectId) ?? false;
  }

  /**
   * Enable or disable an effect
   */
  setEffectEnabled(effectId: string, enabled: boolean): boolean {
    return this._effectStack?.setEnabled(effectId, enabled) ?? false;
  }

  /**
   * Set effect intensity (0-1)
   */
  setEffectIntensity(effectId: string, intensity: number): boolean {
    return this._effectStack?.setIntensity(effectId, intensity) ?? false;
  }

  /**
   * Clear all effects from this surface
   */
  clearEffects(): void {
    this._effectStack?.clear();
  }

  /**
   * Initialize the effect stack with a GPU device
   * Called by renderer when surface is first used
   */
  async initEffects(device: GPUDevice): Promise<void> {
    if (this._effectStack) {
      await this._effectStack.init(device);
    }
  }

  /**
   * Render effects for this surface
   * Called by renderer during surface rendering
   */
  renderEffects(
    inputTexture: GPUTexture,
    outputTexture: GPUTexture
  ): void {
    if (this._effectStack && this._effectStack.hasEnabledEffects) {
      this._effectStack.render(inputTexture, outputTexture, this._rect);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Clear callbacks
    this._onLayoutChangeCallbacks.clear();
    this._onVisibilityChangeCallbacks.clear();
    this._onZIndexChangeCallbacks.clear();
    this._onTransformChangeCallbacks.clear();
    
    // Clean up effect stack
    if (this._effectStack) {
      this._effectStack.destroy();
      this._effectStack = null;
    }
    
    // Don't destroy the texture here - that's managed by the renderer
    // Just clear the reference
    this._texture = null;
    
    // Clear motion values
    this._motionValues.clear();
    
    // Clear element reference
    this._element = null;
  }
}
