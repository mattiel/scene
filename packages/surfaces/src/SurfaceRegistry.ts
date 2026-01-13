import type { Surface } from './Surface';

/**
 * SurfaceRegistry - Manages all surfaces in the scene
 * 
 * The registry is the central store for all surfaces, providing:
 * - Fast lookup by ID
 * - Iteration in z-index order
 * - Lifecycle management
 */
export class SurfaceRegistry {
  private _surfaces: Map<string, Surface> = new Map();
  private _sortedSurfaces: Surface[] = [];
  private _needsSort: boolean = false;
  // Track unsubscribe functions for z-index listeners so we can clean them up
  private _zIndexUnsubscribes: Map<string, () => void> = new Map();
  
  // Callbacks for lifecycle events (supports multiple subscribers)
  private _onAddCallbacks: Set<(surface: Surface) => void> = new Set();
  private _onRemoveCallbacks: Set<(surface: Surface) => void> = new Set();

  /**
   * Add a surface to the registry
   * @param surface - The surface to add
   * @throws Error if a surface with the same ID already exists
   */
  add(surface: Surface): void {
    if (this._surfaces.has(surface.id)) {
      throw new Error(`Surface with id "${surface.id}" already exists`);
    }
    
    this._surfaces.set(surface.id, surface);
    this._sortedSurfaces.push(surface);
    this._needsSort = true;

    // Subscribe to z-index changes so sorted() stays accurate
    const unsubscribe = surface.onZIndexChange(() => {
      this.markDirty();
    });
    this._zIndexUnsubscribes.set(surface.id, unsubscribe);
    
    // Notify all subscribers
    for (const callback of this._onAddCallbacks) {
      callback(surface);
    }
  }

  /**
   * Remove a surface from the registry
   * @param id - The ID of the surface to remove
   * @returns The removed surface, or undefined if not found
   */
  remove(id: string): Surface | undefined {
    const surface = this._surfaces.get(id);
    if (!surface) {
      return undefined;
    }

    // Clean up z-index subscription
    const unsubscribe = this._zIndexUnsubscribes.get(id);
    if (unsubscribe) {
      unsubscribe();
      this._zIndexUnsubscribes.delete(id);
    }
    
    this._surfaces.delete(id);
    
    const index = this._sortedSurfaces.indexOf(surface);
    if (index !== -1) {
      this._sortedSurfaces.splice(index, 1);
    }
    
    // Notify all subscribers
    for (const callback of this._onRemoveCallbacks) {
      callback(surface);
    }
    
    return surface;
  }

  /**
   * Get a surface by ID
   * @param id - The surface ID
   * @returns The surface, or undefined if not found
   */
  get(id: string): Surface | undefined {
    return this._surfaces.get(id);
  }

  /**
   * Check if a surface exists
   * @param id - The surface ID
   */
  has(id: string): boolean {
    return this._surfaces.has(id);
  }

  /**
   * Get all surfaces as an array
   * @returns Array of surfaces (not sorted)
   */
  all(): Surface[] {
    return Array.from(this._surfaces.values());
  }

  /**
   * Get all surfaces sorted by z-index (ascending)
   * This is useful for rendering in the correct order
   * @returns Array of surfaces sorted by z-index (copy, safe to modify)
   */
  sorted(): Surface[] {
    if (this._needsSort) {
      this._sortedSurfaces.sort((a, b) => a.zIndex - b.zIndex);
      this._needsSort = false;
    }
    return [...this._sortedSurfaces];
  }

  /**
   * Mark that surfaces need re-sorting
   * Call this when a surface's z-index changes
   */
  markDirty(): void {
    this._needsSort = true;
  }

  /**
   * Get all visible surfaces
   * @returns Array of visible surfaces
   */
  visible(): Surface[] {
    return this.all().filter(s => s.isVisible);
  }

  /**
   * Get all ghost surfaces
   * @returns Array of ghost surfaces
   */
  ghosts(): Surface[] {
    return this.all().filter(s => s.isGhost);
  }

  /**
   * Get all regular (non-ghost) surfaces
   * @returns Array of regular surfaces
   */
  regular(): Surface[] {
    return this.all().filter(s => !s.isGhost);
  }

  /**
   * Get the number of surfaces
   */
  get size(): number {
    return this._surfaces.size;
  }

  /**
   * Iterate over all surfaces
   */
  forEach(callback: (surface: Surface) => void): void {
    this._surfaces.forEach(callback);
  }

  /**
   * Find a surface by predicate
   * @param predicate - Function that returns true for the desired surface
   */
  find(predicate: (surface: Surface) => boolean): Surface | undefined {
    for (const surface of this._surfaces.values()) {
      if (predicate(surface)) {
        return surface;
      }
    }
    return undefined;
  }

  /**
   * Filter surfaces by predicate
   * @param predicate - Function that returns true for surfaces to include
   */
  filter(predicate: (surface: Surface) => boolean): Surface[] {
    return this.all().filter(predicate);
  }

  /**
   * Subscribe to surface additions
   * @param callback - Called when a surface is added
   * @returns Unsubscribe function
   */
  onAdd(callback: (surface: Surface) => void): () => void {
    this._onAddCallbacks.add(callback);
    return () => {
      this._onAddCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to surface removals
   * @param callback - Called when a surface is removed
   * @returns Unsubscribe function
   */
  onRemove(callback: (surface: Surface) => void): () => void {
    this._onRemoveCallbacks.add(callback);
    return () => {
      this._onRemoveCallbacks.delete(callback);
    };
  }

  /**
   * Clear all surfaces and destroy them
   * 
   * Note: This preserves onAdd/onRemove callbacks. Subscribers (like LayoutTracker)
   * remain active and will be notified of surfaces added after clear().
   * Use the unsubscribe functions returned by onAdd()/onRemove() to remove callbacks.
   */
  clear(): void {
    // Notify all removal callbacks before destroying (allows cleanup like untracking)
    for (const callback of this._onRemoveCallbacks) {
      this._surfaces.forEach(surface => callback(surface));
    }
    
    // Destroy all surfaces
    this._surfaces.forEach(surface => surface.destroy());

    // Clean up z-index subscriptions
    this._zIndexUnsubscribes.forEach(unsub => unsub());
    this._zIndexUnsubscribes.clear();
    
    // Clear collections
    this._surfaces.clear();
    this._sortedSurfaces = [];
    this._needsSort = false;
    
    // Note: We intentionally do NOT clear callbacks here.
    // Subscribers (e.g., LayoutTracker) expect their callbacks to remain active
    // after clear(). They should call their unsubscribe functions when done.
  }

  /**
   * Find surfaces that intersect with a point
   * Useful for hit testing in Canvas-Interactive mode
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns Array of surfaces at that point, sorted by z-index (descending)
   */
  at(x: number, y: number): Surface[] {
    const hits = this.all().filter(surface => {
      const rect = surface.rect;
      return (
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height
      );
    });
    
    // Sort by z-index descending (highest z-index first)
    return hits.sort((a, b) => b.zIndex - a.zIndex);
  }

  /**
   * Find the topmost surface at a point
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns The topmost surface at that point, or undefined
   */
  topAt(x: number, y: number): Surface | undefined {
    const hits = this.at(x, y);
    return hits.length > 0 ? hits[0] : undefined;
  }
}
