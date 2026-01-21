/**
 * ShaderMaterial - Custom shader material with composable deformations
 * 
 * Allows creating materials with custom vertex/fragment shaders
 * and composable vertex deformations.
 */

/// <reference types="@webgpu/types" />

import { Material, type MaterialConfig } from './Material';
import { generateUniformStruct, type UniformSchema } from './uniforms';

/** Deformation that can be applied to vertices */
export interface Deformation {
  /** Unique identifier */
  readonly id: string;
  /** Uniform schema for this deformation */
  readonly uniforms: UniformSchema;
  /** WGSL code to include in vertex shader */
  getShaderCode(): string;
  /** Name of the deformation function */
  getFunctionName(): string;
}

/** Vertex attribute definition */
export interface VertexAttribute {
  name: string;
  format: GPUVertexFormat;
  offset: number;
}

/** ShaderMaterial configuration */
export interface ShaderMaterialConfig extends MaterialConfig {
  /** Vertex shader WGSL code */
  vertexShader: string;
  /** Fragment shader WGSL code */
  fragmentShader: string;
  /** Vertex attribute layout */
  vertexAttributes?: VertexAttribute[];
  /** Vertex buffer stride in bytes */
  vertexStride?: number;
  /** Deformations to apply to vertices */
  deformations?: Deformation[];
}

/** Default vertex attributes (position + texCoord) */
const DEFAULT_ATTRIBUTES: VertexAttribute[] = [
  { name: 'position', format: 'float32x3', offset: 0 },
  { name: 'texCoord', format: 'float32x2', offset: 12 },
];

const DEFAULT_STRIDE = 20; // 3 floats position + 2 floats texCoord

/**
 * ShaderMaterial - Create materials with custom shaders
 * 
 * @example
 * ```typescript
 * const material = new ShaderMaterial({
 *   vertexShader: `...`,
 *   fragmentShader: `...`,
 *   uniforms: {
 *     opacity: { type: 'f32', default: 1.0 },
 *     tint: { type: 'vec4f', default: [1, 1, 1, 1] },
 *   },
 *   deformations: [new BendDeformation()],
 * });
 * ```
 */
export class ShaderMaterial extends Material {
  private vertexShader: string;
  private fragmentShader: string;
  private vertexAttributes: VertexAttribute[];
  private vertexStride: number;
  private deformations: Deformation[];
  private shaderModule: GPUShaderModule | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;

  constructor(config: ShaderMaterialConfig) {
    // Merge deformation uniforms into main schema
    const mergedUniforms = { ...config.uniforms };
    for (const deformation of config.deformations ?? []) {
      Object.assign(mergedUniforms, deformation.uniforms);
    }

    super({
      ...config,
      uniforms: mergedUniforms,
    });

    this.vertexShader = config.vertexShader;
    this.fragmentShader = config.fragmentShader;
    this.vertexAttributes = config.vertexAttributes ?? DEFAULT_ATTRIBUTES;
    this.vertexStride = config.vertexStride ?? DEFAULT_STRIDE;
    this.deformations = config.deformations ?? [];
  }

  /**
   * Initialize GPU resources
   */
  async init(device: GPUDevice): Promise<void> {
    this.device = device;

    // Initialize uniform buffer
    if (this.uniformBuffer) {
      this.uniformBuffer.init(device);
    }

    // Create default sampler for textures
    const defaultSampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });
    this.samplers.set('default', defaultSampler);

    // Generate combined shader code
    const shaderCode = this.generateShaderCode();

    // Create shader module
    this.shaderModule = device.createShaderModule({
      label: `${this.name}_shader`,
      code: shaderCode,
    });

    // Check for compilation errors
    const info = await this.shaderModule.getCompilationInfo();
    for (const message of info.messages) {
      if (message.type === 'error') {
        console.error(`Shader error in ${this.name}:`, message.message);
        throw new Error(`Shader compilation failed: ${message.message}`);
      } else if (message.type === 'warning') {
        console.warn(`Shader warning in ${this.name}:`, message.message);
      }
    }

    // Create bind group layout
    this.bindGroupLayout = this.createBindGroupLayout(device);

    // Create pipeline
    await this.createPipeline(device);
  }

  /**
   * Generate combined WGSL shader code
   */
  private generateShaderCode(): string {
    const parts: string[] = [];

    // Generate uniform struct if we have uniforms
    if (this.uniformBuffer && Object.keys(this.uniformSchema).length > 0) {
      parts.push(generateUniformStruct('Uniforms', this.uniformSchema));
      parts.push('@group(0) @binding(0) var<uniform> uniforms: Uniforms;');
    }

    // Add deformation code
    for (const deformation of this.deformations) {
      parts.push(deformation.getShaderCode());
    }

    // Add vertex shader
    parts.push('// === Vertex Shader ===');
    parts.push(this.vertexShader);

    // Add fragment shader
    parts.push('// === Fragment Shader ===');
    parts.push(this.fragmentShader);

    return parts.join('\n\n');
  }

  /**
   * Create bind group layout
   */
  private createBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
    const entries: GPUBindGroupLayoutEntry[] = [];

    // Uniform buffer binding
    if (this.uniformBuffer) {
      entries.push({
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      });
    }

    // Sampler binding
    entries.push({
      binding: 1,
      visibility: GPUShaderStage.FRAGMENT,
      sampler: { type: 'filtering' },
    });

    // Texture binding
    entries.push({
      binding: 2,
      visibility: GPUShaderStage.FRAGMENT,
      texture: { sampleType: 'float' },
    });

    return device.createBindGroupLayout({
      label: `${this.name}_bindGroupLayout`,
      entries,
    });
  }

  /**
   * Create render pipeline
   */
  private async createPipeline(device: GPUDevice): Promise<void> {
    if (!this.shaderModule || !this.bindGroupLayout) {
      throw new Error('Shader module or bind group layout not created');
    }

    const pipelineLayout = device.createPipelineLayout({
      label: `${this.name}_pipelineLayout`,
      bindGroupLayouts: [this.bindGroupLayout],
    });

    // Build vertex buffer layout
    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: this.vertexStride,
      attributes: this.vertexAttributes.map((attr, index) => ({
        shaderLocation: index,
        offset: attr.offset,
        format: attr.format,
      })),
    };

    this.pipeline = device.createRenderPipeline({
      label: `${this.name}_pipeline`,
      layout: pipelineLayout,
      vertex: {
        module: this.shaderModule,
        entryPoint: 'vertexMain',
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: this.shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: 'bgra8unorm', // TODO: Get from context
          blend: this.getBlendState(),
        }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: this.cullMode,
      },
      depthStencil: this.getDepthStencilState(),
    });
  }

  /**
   * Update bind group with current textures
   */
  updateBindGroup(): void {
    if (!this.device || !this.bindGroupLayout) return;

    const entries: GPUBindGroupEntry[] = [];

    // Uniform buffer
    if (this.uniformBuffer) {
      const buffer = this.uniformBuffer.getBuffer();
      if (buffer) {
        entries.push({ binding: 0, resource: { buffer } });
      }
    }

    // Sampler
    const sampler = this.samplers.get('default');
    if (sampler) {
      entries.push({ binding: 1, resource: sampler });
    }

    // Texture (use first texture or create placeholder)
    const texture = this.textures.values().next().value;
    if (texture) {
      entries.push({
        binding: 2,
        resource: texture.createView(),
      });
    }

    if (entries.length > 0) {
      this.bindGroup = this.device.createBindGroup({
        label: `${this.name}_bindGroup`,
        layout: this.bindGroupLayout,
        entries,
      });
    }

    this.needsBindGroupUpdate = false;
  }

  /**
   * Get render pipeline
   */
  getPipeline(): GPURenderPipeline | null {
    return this.pipeline;
  }

  /**
   * Get bind group
   */
  getBindGroup(): GPUBindGroup | null {
    if (this.needsBindGroupUpdate) {
      this.updateBindGroup();
    }
    return this.bindGroup;
  }

  /**
   * Apply a deformation to a vertex position
   * Used when building the combined vertex shader.
   */
  getDeformationCalls(): string {
    if (this.deformations.length === 0) return '';
    
    return this.deformations
      .map(d => `  position = ${d.getFunctionName()}(position, texCoord);`)
      .join('\n');
  }

  /**
   * Clean up resources
   */
  override destroy(): void {
    this.shaderModule = null;
    this.bindGroupLayout = null;
    super.destroy();
  }
}

/**
 * Create a basic textured material
 */
export function createBasicMaterial(
  name: string,
  options: {
    uniforms?: UniformSchema;
    blendMode?: MaterialConfig['blendMode'];
  } = {}
): ShaderMaterial {
  return new ShaderMaterial({
    name,
    uniforms: {
      opacity: { type: 'f32', default: 1.0 },
      ...options.uniforms,
    },
    blendMode: options.blendMode ?? 'alpha',
    vertexShader: `
      struct VertexInput {
        @location(0) position: vec3f,
        @location(1) texCoord: vec2f,
      }

      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) texCoord: vec2f,
      }

      @vertex
      fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = vec4f(input.position, 1.0);
        output.texCoord = input.texCoord;
        return output;
      }
    `,
    fragmentShader: `
      @group(0) @binding(1) var texSampler: sampler;
      @group(0) @binding(2) var texData: texture_2d<f32>;

      @fragment
      fn fragmentMain(@location(0) texCoord: vec2f) -> @location(0) vec4f {
        let color = textureSample(texData, texSampler, texCoord);
        return vec4f(color.rgb, color.a * uniforms.opacity);
      }
    `,
  });
}
