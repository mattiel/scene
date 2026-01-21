/**
 * Material - Base class for all Scene materials
 * 
 * Materials define how geometry is rendered. They manage:
 * - Uniforms (shader parameters)
 * - Textures
 * - Render state (blending, depth, etc.)
 */

/// <reference types="@webgpu/types" />

import { 
  UniformBuffer, 
  type UniformSchema, 
  type UniformValue 
} from './uniforms';

/** Blend mode presets */
export type BlendMode = 'opaque' | 'alpha' | 'additive' | 'multiply';

/** Material configuration */
export interface MaterialConfig {
  /** Material name for debugging */
  name?: string;
  /** Uniform schema defining available uniforms */
  uniforms?: UniformSchema;
  /** Initial uniform values */
  uniformValues?: Record<string, UniformValue>;
  /** Blend mode */
  blendMode?: BlendMode;
  /** Write to depth buffer */
  depthWrite?: boolean;
  /** Enable depth testing */
  depthTest?: boolean;
  /** Face culling mode */
  cullMode?: GPUCullMode;
  /** Render order (lower = earlier) */
  renderOrder?: number;
}

/**
 * Get GPUBlendState for a blend mode
 */
function getBlendState(mode: BlendMode): GPUBlendState {
  switch (mode) {
    case 'opaque':
      return {
        color: { srcFactor: 'one', dstFactor: 'zero', operation: 'add' },
        alpha: { srcFactor: 'one', dstFactor: 'zero', operation: 'add' },
      };
    case 'alpha':
      return {
        color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      };
    case 'additive':
      return {
        color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
        alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
      };
    case 'multiply':
      return {
        color: { srcFactor: 'dst', dstFactor: 'zero', operation: 'add' },
        alpha: { srcFactor: 'dst-alpha', dstFactor: 'zero', operation: 'add' },
      };
  }
}

/**
 * Material base class
 * 
 * Extend this to create custom materials with specific shader behavior.
 */
export abstract class Material {
  readonly name: string;
  readonly blendMode: BlendMode;
  readonly depthWrite: boolean;
  readonly depthTest: boolean;
  readonly cullMode: GPUCullMode;
  readonly renderOrder: number;

  protected uniformBuffer: UniformBuffer | null = null;
  protected uniformSchema: UniformSchema;
  protected textures: Map<string, GPUTexture> = new Map();
  protected samplers: Map<string, GPUSampler> = new Map();
  protected device: GPUDevice | null = null;
  protected pipeline: GPURenderPipeline | null = null;
  protected bindGroup: GPUBindGroup | null = null;
  protected needsBindGroupUpdate = false;

  constructor(config: MaterialConfig = {}) {
    this.name = config.name ?? 'Material';
    this.uniformSchema = config.uniforms ?? {};
    this.blendMode = config.blendMode ?? 'alpha';
    this.depthWrite = config.depthWrite ?? true;
    this.depthTest = config.depthTest ?? true;
    this.cullMode = config.cullMode ?? 'none';
    this.renderOrder = config.renderOrder ?? 0;

    // Create uniform buffer if schema provided
    if (Object.keys(this.uniformSchema).length > 0) {
      this.uniformBuffer = new UniformBuffer(this.uniformSchema);
      
      // Set initial values
      if (config.uniformValues) {
        for (const [name, value] of Object.entries(config.uniformValues)) {
          this.uniformBuffer.set(name, value);
        }
      }
    }
  }

  /**
   * Initialize GPU resources
   * Called by the renderer when the material is first used.
   */
  abstract init(device: GPUDevice): Promise<void>;

  /**
   * Get the render pipeline for this material
   */
  abstract getPipeline(): GPURenderPipeline | null;

  /**
   * Get the bind group for this material
   */
  abstract getBindGroup(): GPUBindGroup | null;

  /**
   * Set a uniform value
   */
  setUniform(name: string, value: UniformValue): void {
    if (!this.uniformBuffer) {
      console.warn(`Material ${this.name} has no uniforms`);
      return;
    }
    this.uniformBuffer.set(name, value);
  }

  /**
   * Get a uniform value
   */
  getUniform(name: string): number | Float32Array | null {
    return this.uniformBuffer?.get(name) ?? null;
  }

  /**
   * Set a texture
   */
  setTexture(name: string, texture: GPUTexture): void {
    this.textures.set(name, texture);
    this.needsBindGroupUpdate = true;
  }

  /**
   * Set a sampler
   */
  setSampler(name: string, sampler: GPUSampler): void {
    this.samplers.set(name, sampler);
    this.needsBindGroupUpdate = true;
  }

  /**
   * Prepare material for rendering
   * Called each frame before draw calls.
   */
  prepare(): void {
    // Upload dirty uniforms
    this.uniformBuffer?.upload();
  }

  /**
   * Get blend state for pipeline creation
   */
  getBlendState(): GPUBlendState {
    return getBlendState(this.blendMode);
  }

  /**
   * Get depth-stencil state for pipeline creation
   */
  getDepthStencilState(): GPUDepthStencilState | undefined {
    if (!this.depthTest && !this.depthWrite) {
      return undefined;
    }
    
    return {
      format: 'depth24plus',
      depthWriteEnabled: this.depthWrite,
      depthCompare: this.depthTest ? 'less' : 'always',
    };
  }

  /**
   * Check if material is initialized
   */
  get isInitialized(): boolean {
    return this.device !== null;
  }

  /**
   * Clean up GPU resources
   */
  destroy(): void {
    this.uniformBuffer?.destroy();
    this.pipeline = null;
    this.bindGroup = null;
    this.device = null;
  }
}

/**
 * Type helper for creating typed material configs
 */
export type TypedMaterialConfig<T extends UniformSchema> = MaterialConfig & {
  uniforms: T;
  uniformValues?: Partial<{ [K in keyof T]: UniformValue }>;
};
