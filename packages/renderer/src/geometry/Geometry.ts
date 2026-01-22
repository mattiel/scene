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
   * Compute vertex normals from face normals (smooth shading)
   * 
   * Requires position attribute and index buffer.
   * Creates or updates 'normal' attribute.
   */
  computeNormals(): this {
    const position = this.attributes.get('position');
    if (!position) {
      console.warn('Cannot compute normals: no position attribute');
      return this;
    }

    const normals = new Float32Array(position.count * 3);
    
    // Accumulate face normals per vertex
    if (this.index) {
      const indices = this.index.array;
      
      for (let i = 0; i < indices.length; i += 3) {
        const ia = indices[i];
        const ib = indices[i + 1];
        const ic = indices[i + 2];

        // Get triangle vertices
        const ax = position.getX(ia), ay = position.getY(ia), az = position.getZ(ia) ?? 0;
        const bx = position.getX(ib), by = position.getY(ib), bz = position.getZ(ib) ?? 0;
        const cx = position.getX(ic), cy = position.getY(ic), cz = position.getZ(ic) ?? 0;

        // Compute edge vectors
        const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
        const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;

        // Cross product for face normal
        const nx = e1y * e2z - e1z * e2y;
        const ny = e1z * e2x - e1x * e2z;
        const nz = e1x * e2y - e1y * e2x;

        // Accumulate to each vertex
        normals[ia * 3] += nx;
        normals[ia * 3 + 1] += ny;
        normals[ia * 3 + 2] += nz;
        
        normals[ib * 3] += nx;
        normals[ib * 3 + 1] += ny;
        normals[ib * 3 + 2] += nz;
        
        normals[ic * 3] += nx;
        normals[ic * 3 + 1] += ny;
        normals[ic * 3 + 2] += nz;
      }
    } else {
      // Non-indexed: process triangles sequentially
      for (let i = 0; i < position.count; i += 3) {
        const ax = position.getX(i), ay = position.getY(i), az = position.getZ(i) ?? 0;
        const bx = position.getX(i + 1), by = position.getY(i + 1), bz = position.getZ(i + 1) ?? 0;
        const cx = position.getX(i + 2), cy = position.getY(i + 2), cz = position.getZ(i + 2) ?? 0;

        const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
        const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;

        const nx = e1y * e2z - e1z * e2y;
        const ny = e1z * e2x - e1x * e2z;
        const nz = e1x * e2y - e1y * e2x;

        // Same normal for all 3 vertices of flat-shaded triangle
        normals[i * 3] = nx;
        normals[i * 3 + 1] = ny;
        normals[i * 3 + 2] = nz;
        
        normals[(i + 1) * 3] = nx;
        normals[(i + 1) * 3 + 1] = ny;
        normals[(i + 1) * 3 + 2] = nz;
        
        normals[(i + 2) * 3] = nx;
        normals[(i + 2) * 3 + 1] = ny;
        normals[(i + 2) * 3 + 2] = nz;
      }
    }

    // Normalize all normals
    for (let i = 0; i < normals.length; i += 3) {
      const x = normals[i];
      const y = normals[i + 1];
      const z = normals[i + 2];
      const len = Math.sqrt(x * x + y * y + z * z);
      
      if (len > 0) {
        normals[i] /= len;
        normals[i + 1] /= len;
        normals[i + 2] /= len;
      }
    }

    this.setAttribute('normal', new BufferAttribute(normals, 3));
    return this;
  }

  /**
   * Compute tangent vectors for normal mapping
   * 
   * Requires position, texCoord, and normal attributes plus index buffer.
   * Creates or updates 'tangent' attribute (vec4 with handedness in w).
   */
  computeTangents(): this {
    const position = this.attributes.get('position');
    const texCoord = this.attributes.get('texCoord');
    const normal = this.attributes.get('normal');

    if (!position || !texCoord || !normal) {
      console.warn('Cannot compute tangents: missing position, texCoord, or normal');
      return this;
    }

    const vertexCount = position.count;
    const tan1 = new Float32Array(vertexCount * 3);
    const tan2 = new Float32Array(vertexCount * 3);

    // Process triangles
    const processTriangle = (i0: number, i1: number, i2: number) => {
      const p0x = position.getX(i0), p0y = position.getY(i0), p0z = position.getZ(i0) ?? 0;
      const p1x = position.getX(i1), p1y = position.getY(i1), p1z = position.getZ(i1) ?? 0;
      const p2x = position.getX(i2), p2y = position.getY(i2), p2z = position.getZ(i2) ?? 0;

      const uv0x = texCoord.getX(i0), uv0y = texCoord.getY(i0);
      const uv1x = texCoord.getX(i1), uv1y = texCoord.getY(i1);
      const uv2x = texCoord.getX(i2), uv2y = texCoord.getY(i2);

      const e1x = p1x - p0x, e1y = p1y - p0y, e1z = p1z - p0z;
      const e2x = p2x - p0x, e2y = p2y - p0y, e2z = p2z - p0z;

      const du1 = uv1x - uv0x, dv1 = uv1y - uv0y;
      const du2 = uv2x - uv0x, dv2 = uv2y - uv0y;

      const det = du1 * dv2 - du2 * dv1;
      if (Math.abs(det) < 1e-8) return;

      const r = 1.0 / det;

      // Tangent
      const tx = (dv2 * e1x - dv1 * e2x) * r;
      const ty = (dv2 * e1y - dv1 * e2y) * r;
      const tz = (dv2 * e1z - dv1 * e2z) * r;

      // Bitangent
      const bx = (du1 * e2x - du2 * e1x) * r;
      const by = (du1 * e2y - du2 * e1y) * r;
      const bz = (du1 * e2z - du2 * e1z) * r;

      // Accumulate
      for (const idx of [i0, i1, i2]) {
        tan1[idx * 3] += tx;
        tan1[idx * 3 + 1] += ty;
        tan1[idx * 3 + 2] += tz;

        tan2[idx * 3] += bx;
        tan2[idx * 3 + 1] += by;
        tan2[idx * 3 + 2] += bz;
      }
    };

    if (this.index) {
      const indices = this.index.array;
      for (let i = 0; i < indices.length; i += 3) {
        processTriangle(indices[i], indices[i + 1], indices[i + 2]);
      }
    } else {
      for (let i = 0; i < position.count; i += 3) {
        processTriangle(i, i + 1, i + 2);
      }
    }

    // Orthogonalize and store tangents (vec4 with handedness)
    const tangents = new Float32Array(vertexCount * 4);

    for (let i = 0; i < vertexCount; i++) {
      const nx = normal.getX(i), ny = normal.getY(i), nz = normal.getZ(i) ?? 0;
      const tx = tan1[i * 3], ty = tan1[i * 3 + 1], tz = tan1[i * 3 + 2];

      // Gram-Schmidt orthogonalize: t' = normalize(t - n * dot(n, t))
      const dot = nx * tx + ny * ty + nz * tz;
      let ox = tx - nx * dot;
      let oy = ty - ny * dot;
      let oz = tz - nz * dot;

      // Normalize
      const len = Math.sqrt(ox * ox + oy * oy + oz * oz);
      if (len > 0) {
        ox /= len;
        oy /= len;
        oz /= len;
      }

      // Handedness: sign of dot(cross(n, t), tan2)
      const bx = tan2[i * 3], by = tan2[i * 3 + 1], bz = tan2[i * 3 + 2];
      const cx = ny * tz - nz * ty;
      const cy = nz * tx - nx * tz;
      const cz = nx * ty - ny * tx;
      const handedness = (cx * bx + cy * by + cz * bz) < 0 ? -1 : 1;

      tangents[i * 4] = ox;
      tangents[i * 4 + 1] = oy;
      tangents[i * 4 + 2] = oz;
      tangents[i * 4 + 3] = handedness;
    }

    this.setAttribute('tangent', new BufferAttribute(tangents, 4));
    return this;
  }

  /**
   * Flip all face normals (reverse winding order)
   */
  flipNormals(): this {
    const normal = this.attributes.get('normal');
    if (normal) {
      for (let i = 0; i < normal.array.length; i++) {
        normal.array[i] = -normal.array[i];
      }
      normal.needsUpdate = true;
    }
    
    // Reverse index winding
    if (this.index) {
      const indices = this.index.array;
      for (let i = 0; i < indices.length; i += 3) {
        const tmp = indices[i + 1];
        indices[i + 1] = indices[i + 2];
        indices[i + 2] = tmp;
      }
      this.index.needsUpdate = true;
    }
    
    this.needsUpload = true;
    return this;
  }

  /**
   * Center the geometry at origin
   */
  center(): this {
    this.computeBoundingBox();
    if (!this.boundingBox) return this;

    const { min, max } = this.boundingBox;
    const cx = (min.x + max.x) / 2;
    const cy = (min.y + max.y) / 2;
    const cz = (min.z + max.z) / 2;

    return this.translate(-cx, -cy, -cz);
  }

  /**
   * Translate all vertices
   */
  translate(x: number, y: number, z: number): this {
    const position = this.attributes.get('position');
    if (!position) return this;

    for (let i = 0; i < position.count; i++) {
      position.setXYZ(
        i,
        position.getX(i) + x,
        position.getY(i) + y,
        (position.getZ(i) ?? 0) + z
      );
    }

    this.needsUpload = true;
    if (this.boundingBox) {
      this.boundingBox.min.x += x;
      this.boundingBox.min.y += y;
      this.boundingBox.min.z += z;
      this.boundingBox.max.x += x;
      this.boundingBox.max.y += y;
      this.boundingBox.max.z += z;
    }

    return this;
  }

  /**
   * Scale all vertices
   */
  scale(x: number, y: number, z: number): this {
    const position = this.attributes.get('position');
    if (!position) return this;

    for (let i = 0; i < position.count; i++) {
      position.setXYZ(
        i,
        position.getX(i) * x,
        position.getY(i) * y,
        (position.getZ(i) ?? 0) * z
      );
    }

    this.needsUpload = true;
    this.boundingBox = null; // Invalidate

    return this;
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
