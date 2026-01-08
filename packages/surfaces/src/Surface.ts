/**
 * Surface - Links a DOM element to its GPU representation
 * 
 * A Surface is the fundamental building block of Scene's rendering system.
 * It maintains the connection between a DOM element and its GPU quad,
 * tracking layout changes and providing APIs for visual effects.
 */

/// <reference types="@webgpu/types" />

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
  private _isVisible: boolean = true;
  private _isGhost: boolean = false;
  private _zIndex: number = 0;
  private _texture: GPUTexture | null = null;
  
  // Motion properties (can be bound to motion values or set statically)
  private _motionValues: Map<SurfaceMotionProperty, number> = new Map();
  
  // Callbacks
  private _onLayoutChange?: (rect: SurfaceRect) => void;
  private _onVisibilityChange?: (visible: boolean) => void;
  private _onZIndexChange?: (zIndex: number) => void;
  
  constructor(
    id: string, 
    element: HTMLElement | null,
    options: SurfaceOptions = {}
  ) {
    this.id = id;
    this._element = element;
    this._isGhost = element === null;
    
    // Initialize rect
    if (element) {
      const rect = element.getBoundingClientRect();
      this._rect = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };
      
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
      if (this._onZIndexChange) {
        this._onZIndexChange(value);
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
    if (this._onLayoutChange) {
      this._onLayoutChange(rect);
    }
  }

  /**
   * Update visibility state
   * @internal Called by LayoutTracker
   */
  _updateVisibility(visible: boolean): void {
    if (this._isVisible !== visible) {
      this._isVisible = visible;
      if (this._onVisibilityChange) {
        this._onVisibilityChange(visible);
      }
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
   */
  onLayoutChange(callback: (rect: SurfaceRect) => void): () => void {
    this._onLayoutChange = callback;
    return () => {
      this._onLayoutChange = undefined;
    };
  }

  /**
   * Subscribe to visibility changes
   */
  onVisibilityChange(callback: (visible: boolean) => void): () => void {
    this._onVisibilityChange = callback;
    return () => {
      this._onVisibilityChange = undefined;
    };
  }

  /**
   * Subscribe to z-index changes
   */
  onZIndexChange(callback: (zIndex: number) => void): () => void {
    this._onZIndexChange = callback;
    return () => {
      this._onZIndexChange = undefined;
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
   * Update the rect from the current DOM element position
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
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Clear callbacks
    this._onLayoutChange = undefined;
    this._onVisibilityChange = undefined;
    this._onZIndexChange = undefined;
    
    // Don't destroy the texture here - that's managed by the renderer
    // Just clear the reference
    this._texture = null;
    
    // Clear motion values
    this._motionValues.clear();
    
    // Clear element reference
    this._element = null;
  }
}
