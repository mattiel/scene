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
  
  // Callbacks for lifecycle events
  private _onAdd?: (surface: Surface) => void;
  private _onRemove?: (surface: Surface) => void;

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
    
    if (this._onAdd) {
      this._onAdd(surface);
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
    
    this._surfaces.delete(id);
    
    const index = this._sortedSurfaces.indexOf(surface);
    if (index !== -1) {
      this._sortedSurfaces.splice(index, 1);
    }
    
    if (this._onRemove) {
      this._onRemove(surface);
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
   * @returns Array of surfaces sorted by z-index
   */
  sorted(): Surface[] {
    if (this._needsSort) {
      this._sortedSurfaces.sort((a, b) => a.zIndex - b.zIndex);
      this._needsSort = false;
    }
    return this._sortedSurfaces;
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
    this._onAdd = callback;
    return () => {
      this._onAdd = undefined;
    };
  }

  /**
   * Subscribe to surface removals
   * @param callback - Called when a surface is removed
   * @returns Unsubscribe function
   */
  onRemove(callback: (surface: Surface) => void): () => void {
    this._onRemove = callback;
    return () => {
      this._onRemove = undefined;
    };
  }

  /**
   * Clear all surfaces and destroy them
   */
  clear(): void {
    // Destroy all surfaces
    this._surfaces.forEach(surface => surface.destroy());
    
    // Clear collections
    this._surfaces.clear();
    this._sortedSurfaces = [];
    this._needsSort = false;
    
    // Clear callbacks
    this._onAdd = undefined;
    this._onRemove = undefined;
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
