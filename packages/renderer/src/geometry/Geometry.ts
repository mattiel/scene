/**
 * Geometry - Base class for renderable geometry
 * 
 * Manages vertex attributes and index buffers for GPU rendering.
 */

/// <reference types="@webgpu/types" />

import { BufferAttribute } from './BufferAttribute';

/** Geometry bounding box */
export interface BoundingBox {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

/**
 * Geometry - Holds vertex attributes and indices
 * 
 * @example
 * ```typescript
 * const geometry = new Geometry();
 * geometry.setAttribute('position', new BufferAttribute(positions, 3));
 * geometry.setAttribute('texCoord', new BufferAttribute(uvs, 2));
 * geometry.setIndex(new BufferAttribute(indices, 1));
 * ```
 */
export class Geometry {
  /** Vertex attributes by name */
  readonly attributes: Map<string, BufferAttribute> = new Map();
  /** Index buffer (optional) */
  index: BufferAttribute | null = null;
  /** Computed bounding box */
  boundingBox: BoundingBox | null = null;

  private device: GPUDevice | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private indexBuffer: GPUBuffer | null = null;
  private needsUpload = true;

  /**
   * Set a vertex attribute
   */
  setAttribute(name: string, attribute: BufferAttribute): this {
    this.attributes.set(name, attribute);
    this.needsUpload = true;
    return this;
  }

  /**
   * Get a vertex attribute
   */
  getAttribute(name: string): BufferAttribute | undefined {
    return this.attributes.get(name);
  }

  /**
   * Check if attribute exists
   */
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  /**
   * Delete an attribute
   */
  deleteAttribute(name: string): boolean {
    const deleted = this.attributes.delete(name);
    if (deleted) this.needsUpload = true;
    return deleted;
  }

  /**
   * Set index buffer
   */
  setIndex(index: BufferAttribute | null): this {
    this.index = index;
    this.needsUpload = true;
    return this;
  }

  /**
   * Get vertex count
   */
  get vertexCount(): number {
    const position = this.attributes.get('position');
    return position?.count ?? 0;
  }

  /**
   * Get index count (or vertex count if no indices)
   */
  get drawCount(): number {
    return this.index?.count ?? this.vertexCount;
  }

  /**
   * Compute bounding box from position attribute
   */
  computeBoundingBox(): BoundingBox {
    const position = this.attributes.get('position');
    if (!position) {
      this.boundingBox = {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
      };
      return this.boundingBox;
    }

    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i) ?? 0;

      min.x = Math.min(min.x, x);
      min.y = Math.min(min.y, y);
      min.z = Math.min(min.z, z);
      max.x = Math.max(max.x, x);
      max.y = Math.max(max.y, y);
      max.z = Math.max(max.z, z);
    }

    this.boundingBox = { min, max };
    return this.boundingBox;
  }

  /**
   * Initialize GPU buffers
   */
  init(device: GPUDevice): void {
    this.device = device;
    this.upload();
  }

  /**
   * Upload geometry to GPU
   */
  upload(): void {
    if (!this.device || !this.needsUpload) return;

    // Calculate interleaved vertex buffer size
    const vertexCount = this.vertexCount;
    if (vertexCount === 0) return;

    // Calculate stride from attributes
    let stride = 0;
    const attributeOffsets = new Map<string, number>();
    
    for (const [name, attr] of this.attributes) {
      attributeOffsets.set(name, stride);
      stride += attr.itemSize * 4; // 4 bytes per float
    }

    // Create interleaved vertex data
    const vertexData = new Float32Array(vertexCount * (stride / 4));
    
    for (let v = 0; v < vertexCount; v++) {
      let offset = v * (stride / 4);
      for (const [, attr] of this.attributes) {
        for (let c = 0; c < attr.itemSize; c++) {
          vertexData[offset++] = attr.array[v * attr.itemSize + c];
        }
      }
    }

    // Destroy old buffer
    this.vertexBuffer?.destroy();

    // Create vertex buffer
    this.vertexBuffer = this.device.createBuffer({
      label: 'GeometryVertexBuffer',
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.vertexBuffer, 0, vertexData);

    // Create index buffer if needed
    if (this.index) {
      this.indexBuffer?.destroy();
      
      this.indexBuffer = this.device.createBuffer({
        label: 'GeometryIndexBuffer',
        size: this.index.array.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      // Cast to satisfy WebGPU types (our TypedArray is always from ArrayBuffer, not SharedArrayBuffer)
      this.device.queue.writeBuffer(
        this.indexBuffer, 
        0, 
        this.index.array.buffer as ArrayBuffer,
        this.index.array.byteOffset,
        this.index.array.byteLength
      );
    }

    this.needsUpload = false;
  }

  /**
   * Get GPU vertex buffer
   */
  getVertexBuffer(): GPUBuffer | null {
    return this.vertexBuffer;
  }

  /**
   * Get GPU index buffer
   */
  getIndexBuffer(): GPUBuffer | null {
    return this.indexBuffer;
  }

  /**
   * Get vertex stride in bytes
   */
  getStride(): number {
    let stride = 0;
    for (const [, attr] of this.attributes) {
      stride += attr.itemSize * 4;
    }
    return stride;
  }

  /**
   * Mark for re-upload
   */
  markDirty(): void {
    this.needsUpload = true;
  }

  /**
   * Clone this geometry
   */
  clone(): Geometry {
    const geometry = new Geometry();
    
    for (const [name, attr] of this.attributes) {
      geometry.setAttribute(name, attr.clone());
    }
    
    if (this.index) {
      geometry.setIndex(this.index.clone());
    }
    
    return geometry;
  }

  /**
   * Clean up GPU resources
   */
  destroy(): void {
    this.vertexBuffer?.destroy();
    this.indexBuffer?.destroy();
    this.vertexBuffer = null;
    this.indexBuffer = null;
    this.device = null;
  }
}
