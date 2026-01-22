/**
 * RenderTargetPool
 *
 * Manages a pool of reusable GPU textures for effect rendering.
 * Reduces allocation overhead by recycling textures.
 */

/// <reference types="@webgpu/types" />

/** Pooled texture entry */
interface PooledTexture {
  texture: GPUTexture;
  width: number;
  height: number;
  format: GPUTextureFormat;
  inUse: boolean;
  lastUsed: number;
}

/** Pool configuration */
export interface RenderTargetPoolConfig {
  /** Maximum number of textures in pool (default: 10) */
  maxTextures?: number;
  /** Default texture format (default: 'rgba8unorm') */
  defaultFormat?: GPUTextureFormat;
  /** Whether to auto-cleanup unused textures (default: true) */
  autoCleanup?: boolean;
  /** Cleanup interval in ms (default: 5000) */
  cleanupInterval?: number;
  /** Time before unused texture is cleaned up (default: 10000) */
  unusedTTL?: number;
}

/**
 * RenderTargetPool - Efficient render target management
 * 
 * @example
 * ```typescript
 * const pool = new RenderTargetPool(device);
 * 
 * // Acquire a texture for rendering
 * const texture = pool.acquire(1920, 1080);
 * 
 * // Use texture for effect pass...
 * 
 * // Release back to pool when done
 * pool.release(texture);
 * ```
 */
export class RenderTargetPool {
  private device: GPUDevice;
  private pool: PooledTexture[] = [];
  private config: Required<RenderTargetPoolConfig>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(device: GPUDevice, config: RenderTargetPoolConfig = {}) {
    this.device = device;
    this.config = {
      maxTextures: config.maxTextures ?? 10,
      defaultFormat: config.defaultFormat ?? 'rgba8unorm',
      autoCleanup: config.autoCleanup ?? true,
      cleanupInterval: config.cleanupInterval ?? 5000,
      unusedTTL: config.unusedTTL ?? 10000,
    };

    if (this.config.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Acquire a render target texture
   */
  acquire(
    width: number,
    height: number,
    format?: GPUTextureFormat
  ): GPUTexture {
    const targetFormat = format ?? this.config.defaultFormat;
    const now = Date.now();

    // Try to find a matching unused texture
    for (const entry of this.pool) {
      if (
        !entry.inUse &&
        entry.width === width &&
        entry.height === height &&
        entry.format === targetFormat
      ) {
        entry.inUse = true;
        entry.lastUsed = now;
        return entry.texture;
      }
    }

    // Create new texture if pool isn't full
    if (this.pool.length < this.config.maxTextures) {
      const texture = this.createTexture(width, height, targetFormat);
      this.pool.push({
        texture,
        width,
        height,
        format: targetFormat,
        inUse: true,
        lastUsed: now,
      });
      return texture;
    }

    // Pool is full - evict oldest unused texture
    let oldest: PooledTexture | null = null;
    let oldestIndex = -1;

    for (let i = 0; i < this.pool.length; i++) {
      const entry = this.pool[i];
      if (!entry.inUse) {
        if (!oldest || entry.lastUsed < oldest.lastUsed) {
          oldest = entry;
          oldestIndex = i;
        }
      }
    }

    if (oldest && oldestIndex !== -1) {
      oldest.texture.destroy();
      const texture = this.createTexture(width, height, targetFormat);
      this.pool[oldestIndex] = {
        texture,
        width,
        height,
        format: targetFormat,
        inUse: true,
        lastUsed: now,
      };
      return texture;
    }

    // No available slots - create without pooling
    console.warn('RenderTargetPool: All textures in use, creating unpooled texture');
    return this.createTexture(width, height, targetFormat);
  }

  /**
   * Release a texture back to the pool
   */
  release(texture: GPUTexture): void {
    for (const entry of this.pool) {
      if (entry.texture === texture) {
        entry.inUse = false;
        entry.lastUsed = Date.now();
        return;
      }
    }
    // Texture not in pool - destroy it
    texture.destroy();
  }

  /**
   * Release all acquired textures
   */
  releaseAll(): void {
    for (const entry of this.pool) {
      entry.inUse = false;
      entry.lastUsed = Date.now();
    }
  }

  /**
   * Create a new texture
   */
  private createTexture(
    width: number,
    height: number,
    format: GPUTextureFormat
  ): GPUTexture {
    return this.device.createTexture({
      label: `RenderTargetPool_${width}x${height}`,
      size: [width, height, 1],
      format,
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.COPY_DST,
    });
  }

  /**
   * Start automatic cleanup
   */
  private startAutoCleanup(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop automatic cleanup
   */
  private stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Clean up unused textures
   */
  cleanup(): void {
    const now = Date.now();
    const ttl = this.config.unusedTTL;

    this.pool = this.pool.filter((entry) => {
      if (!entry.inUse && now - entry.lastUsed > ttl) {
        entry.texture.destroy();
        return false;
      }
      return true;
    });
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    inUse: number;
    available: number;
  } {
    const inUse = this.pool.filter((e) => e.inUse).length;
    return {
      total: this.pool.length,
      inUse,
      available: this.pool.length - inUse,
    };
  }

  /**
   * Get number of textures in pool
   */
  get size(): number {
    return this.pool.length;
  }

  /**
   * Clear all textures from the pool
   */
  clear(): void {
    for (const entry of this.pool) {
      entry.texture.destroy();
    }
    this.pool = [];
  }

  /**
   * Destroy the pool and all textures
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.clear();
  }
}

/**
 * Create a render target pool
 */
export function createRenderTargetPool(
  device: GPUDevice,
  config?: RenderTargetPoolConfig
): RenderTargetPool {
  return new RenderTargetPool(device, config);
}
