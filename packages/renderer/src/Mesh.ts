/**
 * Mesh - Geometry + Material combination
 * 
 * Combines geometry and material into a renderable unit.
 */

/// <reference types="@webgpu/types" />

import type { Geometry } from './geometry/Geometry';
import type { Material } from './materials/Material';

/** Mesh transform */
export interface MeshTransform {
  /** Position in world space */
  position: [number, number, number];
  /** Rotation in radians (euler angles) */
  rotation: [number, number, number];
  /** Scale */
  scale: [number, number, number];
}

/** Mesh configuration */
export interface MeshConfig {
  /** Optional name for debugging */
  name?: string;
  /** Initial visibility */
  visible?: boolean;
  /** Render order (lower = earlier) */
  renderOrder?: number;
}

/**
 * Mesh - A renderable object
 * 
 * @example
 * ```typescript
 * const geometry = new PlaneGeometry({ width: 300, height: 420 });
 * const material = new ShaderMaterial({ ... });
 * const mesh = new Mesh(geometry, material);
 * 
 * // Set position
 * mesh.position = [100, 0, 0];
 * 
 * // Animate via material uniforms
 * mesh.material.setUniform('opacity', 0.5);
 * ```
 */
export class Mesh {
  readonly geometry: Geometry;
  readonly material: Material;
  readonly name: string;

  /** Position in world space */
  position: [number, number, number] = [0, 0, 0];
  /** Rotation in radians */
  rotation: [number, number, number] = [0, 0, 0];
  /** Scale */
  scale: [number, number, number] = [1, 1, 1];

  /** Visibility flag */
  visible = true;
  /** Render order (combined with material.renderOrder) */
  renderOrder: number;

  private initialized = false;

  constructor(
    geometry: Geometry,
    material: Material,
    config: MeshConfig = {}
  ) {
    this.geometry = geometry;
    this.material = material;
    this.name = config.name ?? 'Mesh';
    this.visible = config.visible ?? true;
    this.renderOrder = config.renderOrder ?? 0;
  }

  /**
   * Initialize GPU resources
   */
  async init(device: GPUDevice): Promise<void> {
    if (this.initialized) return;

    // Initialize geometry
    this.geometry.init(device);

    // Initialize material
    if (!this.material.isInitialized) {
      await this.material.init(device);
    }

    this.initialized = true;
  }

  /**
   * Check if mesh is ready for rendering
   */
  get isReady(): boolean {
    return this.initialized && this.visible;
  }

  /**
   * Get effective render order (mesh + material)
   */
  getEffectiveRenderOrder(): number {
    return this.renderOrder + this.material.renderOrder;
  }

  /**
   * Set a material uniform
   */
  setUniform(name: string, value: number | number[] | Float32Array): void {
    this.material.setUniform(name, value);
  }

  /**
   * Get model matrix from transform
   * Returns a 4x4 matrix as Float32Array
   */
  getModelMatrix(): Float32Array {
    const [px, py, pz] = this.position;
    const [rx, ry, rz] = this.rotation;
    const [sx, sy, sz] = this.scale;

    // Build rotation matrices
    const cosX = Math.cos(rx), sinX = Math.sin(rx);
    const cosY = Math.cos(ry), sinY = Math.sin(ry);
    const cosZ = Math.cos(rz), sinZ = Math.sin(rz);

    // Combined rotation: Z * Y * X
    const m00 = cosY * cosZ * sx;
    const m01 = cosY * sinZ * sx;
    const m02 = -sinY * sx;

    const m10 = (sinX * sinY * cosZ - cosX * sinZ) * sy;
    const m11 = (sinX * sinY * sinZ + cosX * cosZ) * sy;
    const m12 = sinX * cosY * sy;

    const m20 = (cosX * sinY * cosZ + sinX * sinZ) * sz;
    const m21 = (cosX * sinY * sinZ - sinX * cosZ) * sz;
    const m22 = cosX * cosY * sz;

    // Column-major for WebGPU
    return new Float32Array([
      m00, m10, m20, 0,
      m01, m11, m21, 0,
      m02, m12, m22, 0,
      px, py, pz, 1,
    ]);
  }

  /**
   * Set position from x, y, z
   */
  setPosition(x: number, y: number, z = 0): this {
    this.position = [x, y, z];
    return this;
  }

  /**
   * Set rotation from x, y, z angles (radians)
   */
  setRotation(x: number, y: number, z: number): this {
    this.rotation = [x, y, z];
    return this;
  }

  /**
   * Set uniform scale
   */
  setScale(s: number): this {
    this.scale = [s, s, s];
    return this;
  }

  /**
   * Prepare mesh for rendering
   */
  prepare(): void {
    if (!this.isReady) return;
    this.material.prepare();
  }

  /**
   * Encode draw commands for this mesh
   */
  draw(passEncoder: GPURenderPassEncoder): void {
    if (!this.isReady) return;

    const pipeline = this.material.getPipeline();
    const bindGroup = this.material.getBindGroup();
    const vertexBuffer = this.geometry.getVertexBuffer();
    const indexBuffer = this.geometry.getIndexBuffer();

    if (!pipeline || !vertexBuffer) return;

    passEncoder.setPipeline(pipeline);
    
    if (bindGroup) {
      passEncoder.setBindGroup(0, bindGroup);
    }

    passEncoder.setVertexBuffer(0, vertexBuffer);

    if (indexBuffer && this.geometry.index) {
      passEncoder.setIndexBuffer(
        indexBuffer,
        this.geometry.index.array instanceof Uint16Array ? 'uint16' : 'uint32'
      );
      passEncoder.drawIndexed(this.geometry.drawCount);
    } else {
      passEncoder.draw(this.geometry.drawCount);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.geometry.destroy();
    this.material.destroy();
    this.initialized = false;
  }
}
