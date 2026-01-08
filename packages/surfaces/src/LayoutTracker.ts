import type { Surface, SurfaceRect } from './Surface';
import type { SurfaceRegistry } from './SurfaceRegistry';

/**
 * LayoutTracker - Efficiently tracks DOM element layout changes
 * 
 * Uses browser observers to detect changes:
 * - ResizeObserver: tracks size and position changes
 * - IntersectionObserver: tracks visibility for culling
 * 
 * All updates are batched and processed once per animation frame
 * to minimize performance impact.
 */

interface LayoutUpdate {
  surface: Surface;
  rect: SurfaceRect;
}

interface VisibilityUpdate {
  surface: Surface;
  visible: boolean;
}

export interface LayoutTrackerOptions {
  /** Threshold for IntersectionObserver (0-1) */
  visibilityThreshold?: number;
  /** Root margin for IntersectionObserver */
  rootMargin?: string;
  /** Whether to track visibility at all */
  trackVisibility?: boolean;
}

/**
 * LayoutTracker
 * 
 * Automatically tracks layout changes for all registered surfaces.
 * Updates are batched per frame via RAF for optimal performance.
 */
export class LayoutTracker {
  private _registry: SurfaceRegistry;
  private _resizeObserver: ResizeObserver | null = null;
  private _intersectionObserver: IntersectionObserver | null = null;
  
  // Batched updates (processed once per frame)
  // Using Map keyed by surface ID to properly coalesce multiple updates per surface
  private _pendingLayoutUpdates: Map<string, LayoutUpdate> = new Map();
  private _pendingVisibilityUpdates: Map<string, VisibilityUpdate> = new Map();
  private _rafHandle: number | null = null;
  
  // Tracked elements
  private _trackedElements: Map<HTMLElement, Surface> = new Map();
  
  // Options
  private _options: Required<LayoutTrackerOptions>;
  
  // Unsubscribe functions for registry events
  private _unsubscribeAdd: (() => void) | null = null;
  private _unsubscribeRemove: (() => void) | null = null;
  
  constructor(registry: SurfaceRegistry, options: LayoutTrackerOptions = {}) {
    this._registry = registry;
    this._options = {
      visibilityThreshold: options.visibilityThreshold ?? 0,
      rootMargin: options.rootMargin ?? '0px',
      trackVisibility: options.trackVisibility ?? true,
    };
    
    // Listen for surface additions/removals (store unsubscribe functions)
    this._unsubscribeAdd = this._registry.onAdd(surface => this.trackSurface(surface));
    this._unsubscribeRemove = this._registry.onRemove(surface => this.untrackSurface(surface));
  }

  /**
   * Start tracking all surfaces in the registry
   */
  start(): void {
    // Prevent duplicate observers if already tracking
    if (this._resizeObserver) {
      return;
    }

    // Create ResizeObserver
    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const surface = this._trackedElements.get(entry.target as HTMLElement);
        if (!surface) continue;
        
        const rect = entry.target.getBoundingClientRect();
        this._pendingLayoutUpdates.set(surface.id, {
          surface,
          rect: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          },
        });
      }
      
      this.scheduleUpdate();
    });
    
    // Create IntersectionObserver if visibility tracking is enabled
    if (this._options.trackVisibility) {
      this._intersectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const surface = this._trackedElements.get(entry.target as HTMLElement);
            if (!surface) continue;
            
            this._pendingVisibilityUpdates.set(surface.id, {
              surface,
              visible: entry.isIntersecting,
            });
          }
          
          this.scheduleUpdate();
        },
        {
          threshold: this._options.visibilityThreshold,
          rootMargin: this._options.rootMargin,
        }
      );
    }
    
    // Track all existing surfaces
    this._registry.forEach(surface => this.trackSurface(surface));
  }

  /**
   * Stop tracking all surfaces
   */
  stop(): void {
    // Disconnect observers
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    
    if (this._intersectionObserver) {
      this._intersectionObserver.disconnect();
      this._intersectionObserver = null;
    }
    
    // Cancel pending updates
    if (this._rafHandle !== null) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
    
    // Clear tracked elements
    this._trackedElements.clear();
    this._pendingLayoutUpdates.clear();
    this._pendingVisibilityUpdates.clear();
  }

  /**
   * Track a surface (called automatically when surfaces are added)
   */
  private trackSurface(surface: Surface): void {
    // Only track surfaces with DOM elements (not ghosts)
    if (!surface.element) return;
    
    const element = surface.element;
    
    // Add to tracked elements map
    this._trackedElements.set(element, surface);
    
    // Observe with ResizeObserver
    if (this._resizeObserver) {
      this._resizeObserver.observe(element);
    }
    
    // Observe with IntersectionObserver
    if (this._intersectionObserver) {
      this._intersectionObserver.observe(element);
    }
  }

  /**
   * Untrack a surface (called automatically when surfaces are removed)
   */
  private untrackSurface(surface: Surface): void {
    if (!surface.element) return;
    
    const element = surface.element;
    
    // Remove from tracked elements map
    this._trackedElements.delete(element);
    
    // Unobserve
    if (this._resizeObserver) {
      this._resizeObserver.unobserve(element);
    }
    
    if (this._intersectionObserver) {
      this._intersectionObserver.unobserve(element);
    }
  }

  /**
   * Schedule a batched update on the next animation frame
   */
  private scheduleUpdate(): void {
    if (this._rafHandle !== null) {
      return; // Already scheduled
    }
    
    this._rafHandle = requestAnimationFrame(() => {
      this.flushUpdates();
      this._rafHandle = null;
    });
  }

  /**
   * Process all pending updates
   */
  private flushUpdates(): void {
    // Process layout updates
    for (const update of this._pendingLayoutUpdates.values()) {
      update.surface._updateRect(update.rect);
    }
    this._pendingLayoutUpdates.clear();
    
    // Process visibility updates
    for (const update of this._pendingVisibilityUpdates.values()) {
      update.surface._updateVisibility(update.visible);
    }
    this._pendingVisibilityUpdates.clear();
  }

  /**
   * Force an immediate update of all tracked surfaces
   * Useful for manual synchronization
   */
  forceUpdate(): void {
    this._trackedElements.forEach((surface, element) => {
      const rect = element.getBoundingClientRect();
      surface._updateRect({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      });
    });
  }

  /**
   * Get the number of tracked elements
   */
  get trackedCount(): number {
    return this._trackedElements.size;
  }

  /**
   * Check if tracking is active
   */
  get isTracking(): boolean {
    return this._resizeObserver !== null;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop();
    
    // Unsubscribe from registry events to prevent callbacks after destruction
    if (this._unsubscribeAdd) {
      this._unsubscribeAdd();
      this._unsubscribeAdd = null;
    }
    if (this._unsubscribeRemove) {
      this._unsubscribeRemove();
      this._unsubscribeRemove = null;
    }
  }
}
