/**
 * MeshRenderer - Efficient batch rendering for multiple meshes
 * 
 * Handles mesh sorting (for transparency), batching by material,
 * and provides instanced rendering support.
 */

/// <reference types="@webgpu/types" />

import type { Mesh } from './Mesh';
import type { Material } from './materials/Material';

/** Sort mode for mesh rendering */
export type SortMode = 
  | 'none'           // No sorting
  | 'front-to-back'  // Opaque optimization (minimize overdraw)
  | 'back-to-front'  // Required for transparency
  | 'by-material'    // Group by material (minimize state changes)
  | 'by-render-order'; // Sort by mesh.renderOrder

/** Camera data for sorting */
export interface CameraData {
  /** Camera position in world space */
  position: [number, number, number];
  /** View direction (normalized) */
  direction: [number, number, number];
}

/** Render statistics */
export interface RenderStats {
  /** Number of draw calls */
  drawCalls: number;
  /** Number of meshes rendered */
  meshesRendered: number;
  /** Number of triangles rendered */
  trianglesRendered: number;
  /** Time spent sorting (ms) */
  sortTime: number;
  /** Time spent rendering (ms) */
  renderTime: number;
}

/** MeshRenderer configuration */
export interface MeshRendererConfig {
  /** Default sort mode */
  sortMode?: SortMode;
  /** Enable render statistics tracking */
  trackStats?: boolean;
  /**
   * Global bind group to set before rendering (e.g., camera uniforms).
   * This bind group is shared across all meshes.
   */
  globalBindGroup?: GPUBindGroup;
  /**
   * Index for the global bind group (default: 0).
   * Set this if your global uniforms use a different bind group index.
   */
  globalBindGroupIndex?: number;
  /**
   * Index for material bind groups (default: 0, or globalBindGroupIndex + 1 if global is set).
   * Materials will have their bind group set at this index.
   */
  materialBindGroupIndex?: number;
}

/**
 * MeshRenderer - Manages rendering of multiple meshes
 * 
 * @example
 * ```typescript
 * const renderer = new MeshRenderer({ sortMode: 'back-to-front' });
 * 
 * // Add meshes
 * renderer.add(mesh1);
 * renderer.add(mesh2);
 * 
 * // Render all meshes
 * renderer.render(passEncoder, { position: [0, 0, 5], direction: [0, 0, -1] });
 * 
 * // Get stats
 * console.log(renderer.stats);
 * ```
 */
export class MeshRenderer {
  private meshes: Set<Mesh> = new Set();
  private sortedMeshes: Mesh[] = [];
  private needsSort = true;
  private sortMode: SortMode;
  private trackStats: boolean;
  private _stats: RenderStats = {
    drawCalls: 0,
    meshesRendered: 0,
    trianglesRendered: 0,
    sortTime: 0,
    renderTime: 0,
  };
  
  // Global bind group support
  private globalBindGroup: GPUBindGroup | null = null;
  private globalBindGroupIndex: number;
  private materialBindGroupIndex: number;

  constructor(config: MeshRendererConfig = {}) {
    this.sortMode = config.sortMode ?? 'by-render-order';
    this.trackStats = config.trackStats ?? false;
    
    // Global bind group configuration
    this.globalBindGroup = config.globalBindGroup ?? null;
    this.globalBindGroupIndex = config.globalBindGroupIndex ?? 0;
    
    // Material bind group index: if global is set, default to globalIndex + 1
    this.materialBindGroupIndex = config.materialBindGroupIndex ?? 
      (config.globalBindGroup ? this.globalBindGroupIndex + 1 : 0);
  }

  /**
   * Set the global bind group (can be changed after construction)
   */
  setGlobalBindGroup(bindGroup: GPUBindGroup | null, index?: number): void {
    this.globalBindGroup = bindGroup;
    if (index !== undefined) {
      this.globalBindGroupIndex = index;
    }
  }

  /**
   * Set the material bind group index
   */
  setMaterialBindGroupIndex(index: number): void {
    this.materialBindGroupIndex = index;
  }

  /**
   * Add a mesh to be rendered
   */
  add(mesh: Mesh): this {
    this.meshes.add(mesh);
    this.needsSort = true;
    return this;
  }

  /**
   * Add multiple meshes
   */
  addAll(...meshes: Mesh[]): this {
    for (const mesh of meshes) {
      this.meshes.add(mesh);
    }
    this.needsSort = true;
    return this;
  }

  /**
   * Remove a mesh
   */
  remove(mesh: Mesh): boolean {
    const removed = this.meshes.delete(mesh);
    if (removed) this.needsSort = true;
    return removed;
  }

  /**
   * Clear all meshes
   */
  clear(): void {
    this.meshes.clear();
    this.sortedMeshes = [];
    this.needsSort = false;
  }

  /**
   * Get mesh count
   */
  get count(): number {
    return this.meshes.size;
  }

  /**
   * Get current render statistics
   */
  get stats(): Readonly<RenderStats> {
    return this._stats;
  }

  /**
   * Set sort mode
   */
  setSortMode(mode: SortMode): this {
    if (this.sortMode !== mode) {
      this.sortMode = mode;
      this.needsSort = true;
    }
    return this;
  }

  /**
   * Force re-sort on next render
   */
  invalidateSort(): void {
    this.needsSort = true;
  }

  /**
   * Sort meshes based on current mode and camera
   */
  private sort(camera?: CameraData): void {
    const startTime = this.trackStats ? performance.now() : 0;

    // Build array from set
    this.sortedMeshes = Array.from(this.meshes).filter(m => m.visible);

    switch (this.sortMode) {
      case 'none':
        // No sorting
        break;

      case 'front-to-back':
        if (camera) {
          this.sortByDistance(camera, false);
        }
        break;

      case 'back-to-front':
        if (camera) {
          this.sortByDistance(camera, true);
        }
        break;

      case 'by-material':
        this.sortByMaterial();
        break;

      case 'by-render-order':
        this.sortByRenderOrder();
        break;
    }

    this.needsSort = false;

    if (this.trackStats) {
      this._stats.sortTime = performance.now() - startTime;
    }
  }

  /**
   * Sort by distance from camera
   */
  private sortByDistance(camera: CameraData, backToFront: boolean): void {
    const [cx, cy, cz] = camera.position;

    // Calculate distances
    const distances = new Map<Mesh, number>();
    for (const mesh of this.sortedMeshes) {
      const [mx, my, mz] = mesh.position;
      const dx = mx - cx;
      const dy = my - cy;
      const dz = mz - cz;
      distances.set(mesh, dx * dx + dy * dy + dz * dz);
    }

    // Sort by distance
    this.sortedMeshes.sort((a, b) => {
      const da = distances.get(a) ?? 0;
      const db = distances.get(b) ?? 0;
      return backToFront ? db - da : da - db;
    });
  }

  /**
   * Sort by material to minimize state changes
   */
  private sortByMaterial(): void {
    // Group by material, then by render order within groups
    const materialMap = new Map<Material, Mesh[]>();
    
    for (const mesh of this.sortedMeshes) {
      const group = materialMap.get(mesh.material);
      if (group) {
        group.push(mesh);
      } else {
        materialMap.set(mesh.material, [mesh]);
      }
    }

    // Sort each group by render order
    for (const group of materialMap.values()) {
      group.sort((a, b) => a.getEffectiveRenderOrder() - b.getEffectiveRenderOrder());
    }

    // Flatten groups (sorted by first mesh's render order)
    const groups = Array.from(materialMap.values());
    groups.sort((a, b) => a[0].getEffectiveRenderOrder() - b[0].getEffectiveRenderOrder());
    
    this.sortedMeshes = groups.flat();
  }

  /**
   * Sort by render order
   */
  private sortByRenderOrder(): void {
    this.sortedMeshes.sort((a, b) => 
      a.getEffectiveRenderOrder() - b.getEffectiveRenderOrder()
    );
  }

  /**
   * Render all meshes
   * 
   * @param passEncoder - GPU render pass encoder
   * @param camera - Optional camera data for distance-based sorting
   */
  render(passEncoder: GPURenderPassEncoder, camera?: CameraData): void {
    const startTime = this.trackStats ? performance.now() : 0;

    // Sort if needed
    if (this.needsSort || this.sortMode === 'front-to-back' || this.sortMode === 'back-to-front') {
      this.sort(camera);
    }

    // Reset stats
    if (this.trackStats) {
      this._stats.drawCalls = 0;
      this._stats.meshesRendered = 0;
      this._stats.trianglesRendered = 0;
    }

    // Set global bind group if configured (once at the start)
    if (this.globalBindGroup) {
      passEncoder.setBindGroup(this.globalBindGroupIndex, this.globalBindGroup);
    }

    // Track current pipeline/bindGroup for batching
    let currentPipeline: GPURenderPipeline | null = null;
    let currentBindGroup: GPUBindGroup | null = null;

    // Render each mesh
    for (const mesh of this.sortedMeshes) {
      if (!mesh.isReady) continue;

      // Prepare material
      mesh.prepare();

      const pipeline = mesh.material.getPipeline();
      const bindGroup = mesh.material.getBindGroup();
      const vertexBuffer = mesh.geometry.getVertexBuffer();
      const indexBuffer = mesh.geometry.getIndexBuffer();

      if (!pipeline || !vertexBuffer) continue;

      // Only set pipeline if changed
      if (pipeline !== currentPipeline) {
        passEncoder.setPipeline(pipeline);
        currentPipeline = pipeline;
      }

      // Only set material bind group if changed
      if (bindGroup && bindGroup !== currentBindGroup) {
        passEncoder.setBindGroup(this.materialBindGroupIndex, bindGroup);
        currentBindGroup = bindGroup;
      }

      passEncoder.setVertexBuffer(0, vertexBuffer);

      if (indexBuffer && mesh.geometry.index) {
        passEncoder.setIndexBuffer(
          indexBuffer,
          mesh.geometry.index.array instanceof Uint16Array ? 'uint16' : 'uint32'
        );
        passEncoder.drawIndexed(mesh.geometry.drawCount);
        
        if (this.trackStats) {
          this._stats.trianglesRendered += mesh.geometry.drawCount / 3;
        }
      } else {
        passEncoder.draw(mesh.geometry.drawCount);
        
        if (this.trackStats) {
          this._stats.trianglesRendered += mesh.geometry.drawCount / 3;
        }
      }

      if (this.trackStats) {
        this._stats.drawCalls++;
        this._stats.meshesRendered++;
      }
    }

    if (this.trackStats) {
      this._stats.renderTime = performance.now() - startTime - this._stats.sortTime;
    }
  }

  /**
   * Render a subset of meshes by predicate
   */
  renderFiltered(
    passEncoder: GPURenderPassEncoder,
    predicate: (mesh: Mesh) => boolean,
    camera?: CameraData
  ): void {
    // Temporarily filter meshes
    const original = this.sortedMeshes;
    this.sortedMeshes = this.sortedMeshes.filter(predicate);
    
    // Render filtered list
    const savedNeedsSort = this.needsSort;
    this.needsSort = false;
    this.render(passEncoder, camera);
    
    // Restore
    this.sortedMeshes = original;
    this.needsSort = savedNeedsSort;
  }

  /**
   * Render only opaque meshes (front-to-back)
   */
  renderOpaque(passEncoder: GPURenderPassEncoder, camera?: CameraData): void {
    const originalMode = this.sortMode;
    this.sortMode = 'front-to-back';
    
    this.renderFiltered(
      passEncoder,
      mesh => mesh.material.blendMode === 'opaque',
      camera
    );
    
    this.sortMode = originalMode;
  }

  /**
   * Render only transparent meshes (back-to-front)
   */
  renderTransparent(passEncoder: GPURenderPassEncoder, camera?: CameraData): void {
    const originalMode = this.sortMode;
    this.sortMode = 'back-to-front';
    
    this.renderFiltered(
      passEncoder,
      mesh => mesh.material.blendMode !== 'opaque',
      camera
    );
    
    this.sortMode = originalMode;
  }

  /**
   * Get all meshes as array
   */
  getMeshes(): Mesh[] {
    return Array.from(this.meshes);
  }

  /**
   * Iterate over meshes
   */
  forEach(callback: (mesh: Mesh) => void): void {
    for (const mesh of this.meshes) {
      callback(mesh);
    }
  }

  /**
   * Find mesh by name
   */
  findByName(name: string): Mesh | undefined {
    for (const mesh of this.meshes) {
      if (mesh.name === name) return mesh;
    }
    return undefined;
  }

  /**
   * Find all meshes matching predicate
   */
  findAll(predicate: (mesh: Mesh) => boolean): Mesh[] {
    return Array.from(this.meshes).filter(predicate);
  }
}

/**
 * Create a mesh renderer with default settings
 */
export function createMeshRenderer(config?: MeshRendererConfig): MeshRenderer {
  return new MeshRenderer(config);
}
