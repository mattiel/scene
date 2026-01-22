/**
 * Picking
 *
 * CPU-based hit testing for surfaces.
 * Uses rect intersection (no GPU ray-plane intersection needed for 2D surfaces).
 */

import type { NormalizedPointer } from './PointerManager';

/**
 * Surface-like interface for picking
 * (Avoids direct dependency on @scene/surfaces)
 */
export interface PickableSurface {
  id: string;
  rect: { x: number; y: number; width: number; height: number };
  zIndex: number;
  isVisible: boolean;
}

/**
 * Registry-like interface for picking
 * (Avoids direct dependency on @scene/surfaces)
 */
export interface PickableRegistry {
  all(): PickableSurface[];
}

/**
 * Pick result
 */
export interface PickResult {
  /** The picked surface */
  surface: PickableSurface;
  /** Local X coordinate within the surface */
  localX: number;
  /** Local Y coordinate within the surface */
  localY: number;
  /** Normalized X coordinate (0-1) */
  normalizedX: number;
  /** Normalized Y coordinate (0-1) */
  normalizedY: number;
}

/**
 * Picking event payload
 */
export interface PickEvent {
  /** All surfaces at the pointer location (sorted by z-index descending) */
  hits: PickResult[];
  /** The topmost surface (first hit) */
  topHit: PickResult | null;
  /** The pointer that triggered the pick */
  pointer: NormalizedPointer;
}

/**
 * Picking callbacks
 */
export interface PickingCallbacks {
  /** Called when pointer enters a surface */
  onEnter?: (surface: PickableSurface, event: PickEvent) => void;
  /** Called when pointer leaves a surface */
  onLeave?: (surface: PickableSurface, event: PickEvent) => void;
  /** Called on pick (pointer move with hits) */
  onPick?: (event: PickEvent) => void;
  /** Called on pointer down with pick result */
  onPickDown?: (event: PickEvent) => void;
  /** Called on pointer up with pick result */
  onPickUp?: (event: PickEvent) => void;
}

/**
 * Picking configuration options
 */
export interface PickingOptions {
  /** Whether to track hover state (generates enter/leave events) */
  trackHover?: boolean;
  /** Whether to pick invisible surfaces (default: false) */
  pickInvisible?: boolean;
}

const DEFAULT_OPTIONS: Required<PickingOptions> = {
  trackHover: true,
  pickInvisible: false,
};

/**
 * Picking - Surface hit testing
 */
export class Picking {
  private registry: PickableRegistry | null = null;
  private options: Required<PickingOptions>;
  private callbacks: PickingCallbacks;
  
  // Hover tracking - stores both ID and surface reference for O(1) leave lookup
  private hoveredSurfaces: Map<string, PickableSurface> = new Map();

  constructor(callbacks: PickingCallbacks = {}, options: PickingOptions = {}) {
    this.callbacks = callbacks;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Set the surface registry to pick from
   */
  setRegistry(registry: PickableRegistry): void {
    this.registry = registry;
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: Partial<PickingCallbacks>): void {
    Object.assign(this.callbacks, callbacks);
  }

  /**
   * Update options
   */
  setOptions(options: Partial<PickingOptions>): void {
    Object.assign(this.options, options);
  }

  /**
   * Test if a point is inside a surface rect
   * Uses half-open interval [left, right) x [top, bottom) - standard convention
   * that prevents adjacent surfaces from both matching edge points.
   */
  private hitTest(surface: PickableSurface, x: number, y: number): boolean {
    const rect = surface.rect;
    return (
      x >= rect.x &&
      x < rect.x + rect.width &&
      y >= rect.y &&
      y < rect.y + rect.height
    );
  }

  /**
   * Create a pick result for a surface
   */
  private createPickResult(surface: PickableSurface, x: number, y: number): PickResult {
    const rect = surface.rect;
    const localX = x - rect.x;
    const localY = y - rect.y;
    
    return {
      surface,
      localX,
      localY,
      normalizedX: rect.width > 0 ? localX / rect.width : 0,
      normalizedY: rect.height > 0 ? localY / rect.height : 0,
    };
  }

  /**
   * Pick surfaces at a point
   * @param x - X coordinate (element-relative)
   * @param y - Y coordinate (element-relative)
   * @returns Array of pick results, sorted by z-index descending
   */
  pick(x: number, y: number): PickResult[] {
    if (!this.registry) {
      return [];
    }
    
    const surfaces = this.registry.all();
    const hits: PickResult[] = [];
    
    for (const surface of surfaces) {
      // Skip invisible surfaces unless configured to pick them
      if (!this.options.pickInvisible && !surface.isVisible) {
        continue;
      }
      
      if (this.hitTest(surface, x, y)) {
        hits.push(this.createPickResult(surface, x, y));
      }
    }
    
    // Sort by z-index descending (highest first)
    hits.sort((a, b) => b.surface.zIndex - a.surface.zIndex);
    
    return hits;
  }

  /**
   * Pick the topmost surface at a point
   */
  pickTop(x: number, y: number): PickResult | null {
    const hits = this.pick(x, y);
    return hits.length > 0 ? hits[0] : null;
  }

  /**
   * Handle pointer move (for hover tracking and onPick)
   */
  handlePointerMove(pointer: NormalizedPointer): PickEvent {
    // Use clientX/clientY (viewport coords) to match surface rects from getBoundingClientRect
    const hits = this.pick(pointer.clientX, pointer.clientY);
    const event: PickEvent = {
      hits,
      topHit: hits.length > 0 ? hits[0] : null,
      pointer,
    };
    
    // Track hover state
    if (this.options.trackHover) {
      const currentHoveredIds = new Set(hits.map(h => h.surface.id));
      
      // Find surfaces we left (O(1) lookup using cached surface reference)
      for (const [id, surface] of this.hoveredSurfaces) {
        if (!currentHoveredIds.has(id)) {
          this.callbacks.onLeave?.(surface, event);
        }
      }
      
      // Find surfaces we entered and build new hover map
      const newHovered = new Map<string, PickableSurface>();
      for (const hit of hits) {
        newHovered.set(hit.surface.id, hit.surface);
        if (!this.hoveredSurfaces.has(hit.surface.id)) {
          this.callbacks.onEnter?.(hit.surface, event);
        }
      }
      
      this.hoveredSurfaces = newHovered;
    }
    
    this.callbacks.onPick?.(event);
    
    return event;
  }

  /**
   * Handle pointer down
   */
  handlePointerDown(pointer: NormalizedPointer): PickEvent {
    // Use clientX/clientY (viewport coords) to match surface rects from getBoundingClientRect
    const hits = this.pick(pointer.clientX, pointer.clientY);
    const event: PickEvent = {
      hits,
      topHit: hits.length > 0 ? hits[0] : null,
      pointer,
    };
    
    this.callbacks.onPickDown?.(event);
    
    return event;
  }

  /**
   * Handle pointer up
   */
  handlePointerUp(pointer: NormalizedPointer): PickEvent {
    // Use clientX/clientY (viewport coords) to match surface rects from getBoundingClientRect
    const hits = this.pick(pointer.clientX, pointer.clientY);
    const event: PickEvent = {
      hits,
      topHit: hits.length > 0 ? hits[0] : null,
      pointer,
    };
    
    this.callbacks.onPickUp?.(event);
    
    return event;
  }

  /**
   * Clear hover state (call when pointer leaves target area)
   * @param emitLeave - Whether to emit onLeave callbacks for hovered surfaces (default: true)
   */
  clearHover(emitLeave: boolean = true): void {
    if (emitLeave && this.callbacks.onLeave && this.hoveredSurfaces.size > 0) {
      // Create a synthetic event for leave callbacks
      const syntheticPointer: NormalizedPointer = {
        id: -1,
        x: -1,
        y: -1,
        clientX: -1,
        clientY: -1,
        deltaX: 0,
        deltaY: 0,
        type: 'mouse',
        pressure: 0,
        isPrimary: true,
        timestamp: performance.now(),
        tiltX: 0,
        tiltY: 0,
        twist: 0,
        width: 0,
        height: 0,
      };
      const event: PickEvent = {
        hits: [],
        topHit: null,
        pointer: syntheticPointer,
      };
      
      for (const surface of this.hoveredSurfaces.values()) {
        this.callbacks.onLeave(surface, event);
      }
    }
    
    this.hoveredSurfaces.clear();
  }

  /**
   * Get currently hovered surface IDs
   */
  getHovered(): string[] {
    return Array.from(this.hoveredSurfaces.keys());
  }

  /**
   * Check if a surface is currently hovered
   */
  isHovered(id: string): boolean {
    return this.hoveredSurfaces.has(id);
  }

  /**
   * Destroy the Picking instance
   */
  destroy(): void {
    this.registry = null;
    this.hoveredSurfaces.clear();
  }
}
