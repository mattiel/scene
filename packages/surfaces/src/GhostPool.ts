/**
 * GhostPool - Pool manager for ghost surfaces and their textures
 * 
 * Efficiently manages temporary ghost surfaces used during transitions:
 * - Texture caching to avoid repeated captures
 * - Surface pooling for reuse
 * - Automatic cleanup of unused resources
 */

/// <reference types="@webgpu/types" />

import { Surface, type SurfaceRect } from './Surface';
import { createGhost, type GhostSurfaceOptions } from './GhostSurface';
import type { DecomposedTransform } from './TransformUtils';
import { IDENTITY_TRANSFORM } from './TransformUtils';

/** Cached texture entry */
interface TextureCacheEntry {
  texture: GPUTexture;
  width: number;
  height: number;
  lastUsed: number;
  refCount: number;
}

/** Pooled ghost surface entry */
interface PooledGhost {
  surface: Surface;
  inUse: boolean;
  lastUsed: number;
}

/** GhostPool configuration */
export interface GhostPoolConfig {
  /** Maximum number of cached textures (default: 50) */
  maxTextures?: number;
  /** Maximum number of pooled ghosts (default: 20) */
  maxGhosts?: number;
  /** Texture cache TTL in milliseconds (default: 30000) */
  textureTTL?: number;
  /** Ghost pool TTL in milliseconds (default: 10000) */
  ghostTTL?: number;
  /** Whether to auto-cleanup (default: true) */
  autoCleanup?: boolean;
  /** Cleanup interval in milliseconds (default: 5000) */
  cleanupInterval?: number;
}

/**
 * GhostPool - Manages ghost surfaces and texture caching
 * 
 * @example
 * ```typescript
 * const pool = new GhostPool(device);
 * 
 * // Acquire a ghost from the pool
 * const ghost = pool.acquire({
 *   id: 'transition-ghost',
 *   rect: { x: 0, y: 0, width: 300, height: 200 },
 * });
 * 
 * // Use the ghost for transition...
 * 
 * // Release back to pool when done
 * pool.release(ghost);
 * 
 * // Cache a texture for reuse
 * const texture = await pool.cacheTexture('card-1', element);
 * 
 * // Get cached texture
 * const cached = pool.getTexture('card-1');
 * ```
 */
export class GhostPool {
  private _device: GPUDevice | null = null;
  private textureCache: Map<string, TextureCacheEntry> = new Map();
  private ghostPool: PooledGhost[] = [];
  private config: Required<GhostPoolConfig>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private idCounter = 0;

  constructor(config: GhostPoolConfig = {}) {
    this.config = {
      maxTextures: config.maxTextures ?? 50,
      maxGhosts: config.maxGhosts ?? 20,
      textureTTL: config.textureTTL ?? 30000,
      ghostTTL: config.ghostTTL ?? 10000,
      autoCleanup: config.autoCleanup ?? true,
      cleanupInterval: config.cleanupInterval ?? 5000,
    };
  }

  /**
   * Initialize the pool with a GPU device
   */
  init(device: GPUDevice): void {
    this._device = device;
    
    if (this.config.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startAutoCleanup(): void {
    if (this.cleanupTimer) return;
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop automatic cleanup timer
   */
  private stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // ============================================
  // Ghost Surface Pooling
  // ============================================

  /**
   * Acquire a ghost surface from the pool
   * 
   * @param options - Ghost surface configuration
   * @returns A ghost surface (reused or new)
   */
  acquire(options: GhostSurfaceOptions & { id?: string }): Surface {
    const now = Date.now();
    
    // Try to find an available ghost in the pool
    for (const entry of this.ghostPool) {
      if (!entry.inUse) {
        entry.inUse = true;
        entry.lastUsed = now;
        
        // Reset the ghost surface
        this.resetGhost(entry.surface, options);
        
        return entry.surface;
      }
    }
    
    // Create a new ghost if pool isn't full
    const id = options.id ?? `ghost-${++this.idCounter}`;
    const ghost = createGhost(id, options);
    
    // Add to pool if not full
    if (this.ghostPool.length < this.config.maxGhosts) {
      this.ghostPool.push({
        surface: ghost,
        inUse: true,
        lastUsed: now,
      });
    }
    
    return ghost;
  }

  /**
   * Release a ghost surface back to the pool
   */
  release(ghost: Surface): void {
    const entry = this.ghostPool.find(e => e.surface === ghost);
    if (entry) {
      entry.inUse = false;
      entry.lastUsed = Date.now();
    }
    // If not in pool, just let it be garbage collected
  }

  /**
   * Reset a ghost surface with new options
   */
  private resetGhost(ghost: Surface, options: GhostSurfaceOptions): void {
    ghost._updateRect(options.rect);
    
    if (options.texture !== undefined) {
      ghost.texture = options.texture;
    }
    
    if (options.zIndex !== undefined) {
      ghost.zIndex = options.zIndex;
    }
    
    // Reset motion properties
    ghost.set('x', 0);
    ghost.set('y', 0);
    ghost.set('scale', 1);
    ghost.set('rotation', 0);
    ghost.set('opacity', 1);
    ghost.set('distortion', 0);
  }

  /**
   * Get number of ghosts in pool
   */
  get ghostCount(): number {
    return this.ghostPool.length;
  }

  /**
   * Get number of ghosts currently in use
   */
  get activeGhostCount(): number {
    return this.ghostPool.filter(e => e.inUse).length;
  }

  // ============================================
  // Texture Caching
  // ============================================

  /**
   * Cache a texture by key
   * 
   * @param key - Unique cache key
   * @param texture - The texture to cache
   * @returns True if cached successfully
   */
  cacheTexture(key: string, texture: GPUTexture): boolean {
    if (this.textureCache.size >= this.config.maxTextures) {
      this.evictOldestTexture();
    }
    
    const existing = this.textureCache.get(key);
    if (existing) {
      existing.refCount++;
      existing.lastUsed = Date.now();
      return true;
    }
    
    this.textureCache.set(key, {
      texture,
      width: texture.width,
      height: texture.height,
      lastUsed: Date.now(),
      refCount: 1,
    });
    
    return true;
  }

  /**
   * Get a cached texture by key
   * 
   * @param key - Cache key
   * @returns The cached texture or undefined
   */
  getTexture(key: string): GPUTexture | undefined {
    const entry = this.textureCache.get(key);
    if (entry) {
      entry.lastUsed = Date.now();
      return entry.texture;
    }
    return undefined;
  }

  /**
   * Check if a texture is cached
   */
  hasTexture(key: string): boolean {
    return this.textureCache.has(key);
  }

  /**
   * Release a texture reference (decrements ref count)
   */
  releaseTexture(key: string): void {
    const entry = this.textureCache.get(key);
    if (entry) {
      entry.refCount = Math.max(0, entry.refCount - 1);
    }
  }

  /**
   * Remove a specific texture from cache
   */
  removeTexture(key: string): boolean {
    const entry = this.textureCache.get(key);
    if (entry) {
      entry.texture.destroy();
      this.textureCache.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Evict the oldest unused texture
   */
  private evictOldestTexture(): void {
    let oldest: [string, TextureCacheEntry] | null = null;
    
    for (const [key, entry] of this.textureCache) {
      // Only evict textures with no references
      if (entry.refCount === 0) {
        if (!oldest || entry.lastUsed < oldest[1].lastUsed) {
          oldest = [key, entry];
        }
      }
    }
    
    if (oldest) {
      oldest[1].texture.destroy();
      this.textureCache.delete(oldest[0]);
    }
  }

  /**
   * Get number of cached textures
   */
  get textureCount(): number {
    return this.textureCache.size;
  }

  /**
   * Get total memory used by cached textures (approximate)
   */
  get textureCacheMemory(): number {
    let total = 0;
    for (const entry of this.textureCache.values()) {
      // Approximate: 4 bytes per pixel (RGBA)
      total += entry.width * entry.height * 4;
    }
    return total;
  }

  /**
   * Check if pool is initialized
   */
  get isInitialized(): boolean {
    return this._device !== null;
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    
    // Clean up expired textures
    for (const [key, entry] of this.textureCache) {
      if (entry.refCount === 0 && now - entry.lastUsed > this.config.textureTTL) {
        entry.texture.destroy();
        this.textureCache.delete(key);
      }
    }
    
    // Clean up expired ghosts
    this.ghostPool = this.ghostPool.filter(entry => {
      if (!entry.inUse && now - entry.lastUsed > this.config.ghostTTL) {
        entry.surface.destroy();
        return false;
      }
      return true;
    });
  }

  /**
   * Clear all cached resources
   */
  clear(): void {
    // Destroy all textures
    for (const entry of this.textureCache.values()) {
      entry.texture.destroy();
    }
    this.textureCache.clear();
    
    // Destroy all ghosts
    for (const entry of this.ghostPool) {
      entry.surface.destroy();
    }
    this.ghostPool = [];
  }

  /**
   * Destroy the pool and all resources
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.clear();
    this._device = null;
  }

  // ============================================
  // Ghost Morphing
  // ============================================

  /**
   * Create a morphing ghost that interpolates between two states
   * 
   * @param fromRect - Starting rect
   * @param toRect - Ending rect
   * @param fromTransform - Starting transform (optional)
   * @param toTransform - Ending transform (optional)
   * @returns Object with ghost and morph function
   */
  createMorphGhost(
    fromRect: SurfaceRect,
    toRect: SurfaceRect,
    fromTransform?: DecomposedTransform,
    toTransform?: DecomposedTransform
  ): {
    ghost: Surface;
    morph: (t: number) => void;
  } {
    const ghost = this.acquire({
      rect: fromRect,
    });
    
    const startTransform = fromTransform ?? { ...IDENTITY_TRANSFORM };
    const endTransform = toTransform ?? { ...IDENTITY_TRANSFORM };
    
    const morph = (t: number) => {
      // Clamp t
      t = Math.max(0, Math.min(1, t));
      
      // Interpolate rect
      const rect: SurfaceRect = {
        x: fromRect.x + (toRect.x - fromRect.x) * t,
        y: fromRect.y + (toRect.y - fromRect.y) * t,
        width: fromRect.width + (toRect.width - fromRect.width) * t,
        height: fromRect.height + (toRect.height - fromRect.height) * t,
      };
      ghost._updateRect(rect);
      
      // Interpolate transform
      const transform: DecomposedTransform = {
        translate: {
          x: startTransform.translate.x + (endTransform.translate.x - startTransform.translate.x) * t,
          y: startTransform.translate.y + (endTransform.translate.y - startTransform.translate.y) * t,
          z: startTransform.translate.z + (endTransform.translate.z - startTransform.translate.z) * t,
        },
        rotate: {
          x: startTransform.rotate.x + (endTransform.rotate.x - startTransform.rotate.x) * t,
          y: startTransform.rotate.y + (endTransform.rotate.y - startTransform.rotate.y) * t,
          z: startTransform.rotate.z + (endTransform.rotate.z - startTransform.rotate.z) * t,
        },
        scale: {
          x: startTransform.scale.x + (endTransform.scale.x - startTransform.scale.x) * t,
          y: startTransform.scale.y + (endTransform.scale.y - startTransform.scale.y) * t,
          z: startTransform.scale.z + (endTransform.scale.z - startTransform.scale.z) * t,
        },
        skew: {
          x: startTransform.skew.x + (endTransform.skew.x - startTransform.skew.x) * t,
          y: startTransform.skew.y + (endTransform.skew.y - startTransform.skew.y) * t,
        },
        origin: {
          x: startTransform.origin.x + (endTransform.origin.x - startTransform.origin.x) * t,
          y: startTransform.origin.y + (endTransform.origin.y - startTransform.origin.y) * t,
        },
        is3D: startTransform.is3D || endTransform.is3D,
      };
      ghost._updateTransform(transform);
    };
    
    return { ghost, morph };
  }
}

/**
 * Create a ghost pool instance
 */
export function createGhostPool(config?: GhostPoolConfig): GhostPool {
  return new GhostPool(config);
}
