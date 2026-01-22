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

/** Texture slot definition for automatic bind group entries */
export interface TextureSlot {
  /** Name of the texture (used with setTexture) */
  name: string;
  /** Binding index within the material's bind group */
  binding: number;
  /** Shader stage visibility (default: FRAGMENT) */
  visibility?: GPUShaderStageFlags;
  /** Whether to include a sampler at binding-1 (default: true for first slot) */
  includeSampler?: boolean;
}

/** Bind group entry definition for raw mode */
export interface BindGroupEntry {
  /** Binding index */
  binding: number;
  /** Entry type */
  type: 'uniform' | 'sampler' | 'texture';
  /** Shader stage visibility (default: VERTEX | FRAGMENT for uniform, FRAGMENT for others) */
  visibility?: GPUShaderStageFlags;
  /** Resource name for texture/sampler lookups (defaults to 'default') */
  name?: string;
}

/** ShaderMaterial configuration */
export interface ShaderMaterialConfig extends MaterialConfig {
  // === Generated mode (traditional) ===
  /** Vertex shader WGSL code (for generated mode) */
  vertexShader?: string;
  /** Fragment shader WGSL code (for generated mode) */
  fragmentShader?: string;
  /** Shader preamble (structs, constants) inserted before uniforms */
  shaderPreamble?: string;
  /** Deformations to apply to vertices (generated mode only) */
  deformations?: Deformation[];
  /**
   * Texture slots for automatic bind group entry creation.
   * If not specified, uses default single texture at binding 2.
   */
  textureSlots?: TextureSlot[];
  
  // === Raw mode (complete shader) ===
  /** 
   * Complete WGSL shader code (for raw mode).
   * When provided, vertexShader/fragmentShader are ignored.
   * The shader must include all @group/@binding declarations.
   */
  shaderCode?: string;
  /**
   * Declarative bind group layout (for raw mode).
   * Specifies the entries in this material's bind group.
   */
  bindGroupEntries?: BindGroupEntry[];
  
  // === Common options ===
  /** Render target color format (default: bgra8unorm) */
  colorFormat?: GPUTextureFormat;
  /** Vertex attribute layout */
  vertexAttributes?: VertexAttribute[];
  /** Vertex buffer stride in bytes */
  vertexStride?: number;
  /** 
   * External bind group layouts (e.g., global uniforms at group 0).
   * These are included in the pipeline layout but not managed by this material.
   */
  externalBindGroupLayouts?: GPUBindGroupLayout[];
  /**
   * Which bind group index this material owns (default: 0).
   * When externalBindGroupLayouts is set, this should typically be 
   * externalBindGroupLayouts.length (e.g., 1 if globals are at group 0).
   */
  ownBindGroupIndex?: number;
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
  // Shader sources (generated mode)
  private vertexShader: string;
  private fragmentShader: string;
  private shaderPreamble: string;
  private deformations: Deformation[];
  private textureSlots: TextureSlot[];
  
  // Raw mode
  private shaderCode: string | null;
  private bindGroupEntries: BindGroupEntry[];
  private rawMode: boolean;
  
  // Common
  private colorFormat: GPUTextureFormat;
  private vertexAttributes: VertexAttribute[];
  private vertexStride: number;
  private shaderModule: GPUShaderModule | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  
  // External bind group support
  private externalBindGroupLayouts: GPUBindGroupLayout[];
  private ownBindGroupIndex: number;

  constructor(config: ShaderMaterialConfig) {
    // Determine mode: raw if shaderCode provided, generated otherwise
    const rawMode = !!config.shaderCode;
    
    // Merge deformation uniforms into main schema (generated mode only)
    const mergedUniforms = { ...config.uniforms };
    if (!rawMode) {
      for (const deformation of config.deformations ?? []) {
        Object.assign(mergedUniforms, deformation.uniforms);
      }
    }

    super({
      ...config,
      uniforms: mergedUniforms,
    });

    this.rawMode = rawMode;
    this.shaderCode = config.shaderCode ?? null;
    this.vertexShader = config.vertexShader ?? '';
    this.fragmentShader = config.fragmentShader ?? '';
    this.shaderPreamble = config.shaderPreamble ?? '';
    this.colorFormat = config.colorFormat ?? 'bgra8unorm';
    this.vertexAttributes = config.vertexAttributes ?? DEFAULT_ATTRIBUTES;
    this.vertexStride = config.vertexStride ?? DEFAULT_STRIDE;
    this.deformations = config.deformations ?? [];
    
    // Bind group configuration
    this.bindGroupEntries = config.bindGroupEntries ?? [];
    this.textureSlots = config.textureSlots ?? [
      { name: 'default', binding: 2, includeSampler: true }
    ];
    
    // External bind group configuration
    this.externalBindGroupLayouts = config.externalBindGroupLayouts ?? [];
    this.ownBindGroupIndex = config.ownBindGroupIndex ?? 0;
  }

  /**
   * Set external bind group layouts (must be called before init if not set in constructor)
   */
  setExternalBindGroupLayouts(layouts: GPUBindGroupLayout[]): void {
    this.externalBindGroupLayouts = layouts;
    this.ownBindGroupIndex = layouts.length;
  }

  /**
   * Set render target color format (must be called before init)
   */
  setColorFormat(format: GPUTextureFormat): void {
    this.colorFormat = format;
  }

  /**
   * Get the bind group index this material uses
   */
  getBindGroupIndex(): number {
    return this.ownBindGroupIndex;
  }

  /**
   * Initialize GPU resources
   */
  async init(device: GPUDevice): Promise<void> {
    this.device = device;

    if (this.rawMode && this.bindGroupEntries.length === 0) {
      throw new Error(`ShaderMaterial ${this.name} raw mode requires bindGroupEntries`);
    }

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
    // Raw mode: return shader code as-is
    if (this.rawMode && this.shaderCode) {
      return this.shaderCode;
    }

    // Generated mode: assemble shader from parts
    const parts: string[] = [];

    // Add shader preamble (structs, constants, etc.)
    if (this.shaderPreamble) {
      parts.push(this.shaderPreamble);
    }

    // Generate uniform struct if we have uniforms
    if (this.uniformBuffer && Object.keys(this.uniformSchema).length > 0) {
      parts.push(generateUniformStruct('Uniforms', this.uniformSchema));
      parts.push(`@group(${this.ownBindGroupIndex}) @binding(0) var<uniform> uniforms: Uniforms;`);
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
   * Create bind group layout for this material's bind group
   */
  private createBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
    const entries: GPUBindGroupLayoutEntry[] = [];

    // Raw mode with declarative entries
    if (this.rawMode && this.bindGroupEntries.length > 0) {
      for (const entry of this.bindGroupEntries) {
        const defaultVisibility = entry.type === 'uniform' 
          ? GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT
          : GPUShaderStage.FRAGMENT;
        const visibility = entry.visibility ?? defaultVisibility;

        if (entry.type === 'uniform') {
          entries.push({ binding: entry.binding, visibility, buffer: { type: 'uniform' } });
        } else if (entry.type === 'sampler') {
          entries.push({ binding: entry.binding, visibility, sampler: { type: 'filtering' } });
        } else if (entry.type === 'texture') {
          entries.push({ binding: entry.binding, visibility, texture: { sampleType: 'float' } });
        }
      }
    } else {
      // Generated mode: use textureSlots pattern
      
      // Uniform buffer binding at 0
      if (this.uniformBuffer) {
        entries.push({
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        });
      }

      // Add texture slots
      for (let i = 0; i < this.textureSlots.length; i++) {
        const slot = this.textureSlots[i];
        const visibility = slot.visibility ?? GPUShaderStage.FRAGMENT;
        
        // Add sampler for first slot or if explicitly requested
        if (slot.includeSampler !== false && (i === 0 || slot.includeSampler)) {
          entries.push({
            binding: slot.binding - 1, // Sampler at binding-1
            visibility,
            sampler: { type: 'filtering' },
          });
        }

        // Add texture
        entries.push({
          binding: slot.binding,
          visibility,
          texture: { sampleType: 'float' },
        });
      }
    }

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

    // Build bind group layouts array:
    // [external layouts...] + [this material's layout at ownBindGroupIndex]
    const bindGroupLayouts: GPUBindGroupLayout[] = [...this.externalBindGroupLayouts];
    
    // Ensure we have enough slots
    while (bindGroupLayouts.length < this.ownBindGroupIndex) {
      throw new Error(
        `Gap in bind group layouts: expected ${this.ownBindGroupIndex} external layouts, got ${this.externalBindGroupLayouts.length}`
      );
    }
    
    // Add this material's bind group at the specified index
    bindGroupLayouts[this.ownBindGroupIndex] = this.bindGroupLayout;

    const pipelineLayout = device.createPipelineLayout({
      label: `${this.name}_pipelineLayout`,
      bindGroupLayouts,
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
          format: this.colorFormat,
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

    // Raw mode with declarative entries
    if (this.rawMode && this.bindGroupEntries.length > 0) {
      for (const entry of this.bindGroupEntries) {
        if (entry.type === 'uniform') {
          const buffer = this.uniformBuffer?.getBuffer();
          if (buffer) {
            entries.push({ binding: entry.binding, resource: { buffer } });
          }
        } else if (entry.type === 'sampler') {
          let sampler = entry.name ? this.samplers.get(entry.name) : this.samplers.get('default');
          if (!sampler && this.samplers.size === 1) {
            sampler = this.samplers.values().next().value;
          }
          if (sampler) {
            entries.push({ binding: entry.binding, resource: sampler });
          }
        } else if (entry.type === 'texture') {
          let texture = entry.name ? this.textures.get(entry.name) : this.textures.get('default');
          if (!texture && this.textures.size === 1) {
            texture = this.textures.values().next().value;
          }
          if (texture) {
            entries.push({ binding: entry.binding, resource: texture.createView() });
          }
        }
      }
    } else {
      // Generated mode: use textureSlots pattern
      
      // Uniform buffer at binding 0
      if (this.uniformBuffer) {
        const buffer = this.uniformBuffer.getBuffer();
        if (buffer) {
          entries.push({ binding: 0, resource: { buffer } });
        }
      }

      // Add texture slot entries
      for (let i = 0; i < this.textureSlots.length; i++) {
        const slot = this.textureSlots[i];
        
        // Add sampler for first slot or if explicitly requested
        if (slot.includeSampler !== false && (i === 0 || slot.includeSampler)) {
          const sampler = this.samplers.get(slot.name) ?? this.samplers.get('default');
          if (sampler) {
            entries.push({ binding: slot.binding - 1, resource: sampler });
          }
        }

        // Add texture
        const texture = this.textures.get(slot.name);
        if (texture) {
          entries.push({
            binding: slot.binding,
            resource: texture.createView(),
          });
        }
      }
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
