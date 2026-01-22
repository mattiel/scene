/**
 * StandardMaterial - Pre-built material with common features
 * 
 * A batteries-included material for typical use cases:
 * - Color/tint
 * - Opacity
 * - Texture mapping
 * - Normal mapping (optional)
 * - Environment reflection (optional)
 */

/// <reference types="@webgpu/types" />

import { Material, type MaterialConfig } from './Material';
import { generateUniformStruct, type UniformSchema } from './uniforms';

/** StandardMaterial configuration */
export interface StandardMaterialConfig extends Omit<MaterialConfig, 'uniforms'> {
  /** Base color (default: white) */
  color?: [number, number, number, number];
  /** Opacity 0-1 (default: 1) */
  opacity?: number;
  /** Whether texture is used */
  useTexture?: boolean;
  /** Whether normal map is used */
  useNormalMap?: boolean;
  /** Environment map reflection intensity */
  envMapIntensity?: number;
  /** Roughness for environment reflections */
  roughness?: number;
  /** Metalness factor */
  metalness?: number;
  /** Emissive color */
  emissive?: [number, number, number];
  /** Emissive intensity */
  emissiveIntensity?: number;
}

/** Standard material uniform schema */
const STANDARD_UNIFORMS: UniformSchema = {
  color: { type: 'vec4f', default: [1, 1, 1, 1] },
  opacity: { type: 'f32', default: 1.0 },
  useTexture: { type: 'f32', default: 0.0 }, // Boolean as float for GPU
  useNormalMap: { type: 'f32', default: 0.0 },
  envMapIntensity: { type: 'f32', default: 0.0 },
  roughness: { type: 'f32', default: 0.5 },
  metalness: { type: 'f32', default: 0.0 },
  emissive: { type: 'vec3f', default: [0, 0, 0] },
  emissiveIntensity: { type: 'f32', default: 1.0 },
};

/** Standard vertex shader */
const VERTEX_SHADER = `
struct VertexInput {
  @location(0) position: vec3f,
  @location(1) texCoord: vec2f,
  @location(2) normal: vec3f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) texCoord: vec2f,
  @location(1) normal: vec3f,
  @location(2) worldPos: vec3f,
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.position, 1.0);
  output.texCoord = input.texCoord;
  output.normal = normalize(input.normal);
  output.worldPos = input.position;
  return output;
}
`;

/** Standard fragment shader */
const FRAGMENT_SHADER = `
@group(0) @binding(1) var texSampler: sampler;
@group(0) @binding(2) var baseTexture: texture_2d<f32>;

@fragment
fn fragmentMain(
  @location(0) texCoord: vec2f,
  @location(1) normal: vec3f,
  @location(2) worldPos: vec3f,
) -> @location(0) vec4f {
  // Base color
  var finalColor = uniforms.color;
  
  // Apply texture if enabled
  if (uniforms.useTexture > 0.5) {
    let texColor = textureSample(baseTexture, texSampler, texCoord);
    finalColor = finalColor * texColor;
  }
  
  // Simple lighting (hemisphere light)
  let lightDir = normalize(vec3f(0.5, 1.0, 0.3));
  let ndotl = dot(normal, lightDir) * 0.5 + 0.5;
  let ambient = vec3f(0.2, 0.2, 0.25);
  let diffuse = vec3f(0.8, 0.8, 0.75);
  let lighting = ambient + diffuse * ndotl;
  
  // Apply lighting
  finalColor = vec4f(finalColor.rgb * lighting, finalColor.a);
  
  // Add emissive
  finalColor = vec4f(
    finalColor.rgb + uniforms.emissive * uniforms.emissiveIntensity,
    finalColor.a
  );
  
  // Apply opacity
  return vec4f(finalColor.rgb, finalColor.a * uniforms.opacity);
}
`;

/**
 * StandardMaterial - Ready-to-use material with common features
 * 
 * @example
 * ```typescript
 * // Simple colored material
 * const red = new StandardMaterial({ color: [1, 0, 0, 1] });
 * 
 * // Textured material
 * const textured = new StandardMaterial({
 *   useTexture: true,
 *   opacity: 0.8,
 * });
 * textured.setTexture('base', myTexture);
 * 
 * // Emissive material
 * const glowing = new StandardMaterial({
 *   emissive: [1, 0.5, 0],
 *   emissiveIntensity: 2.0,
 * });
 * ```
 */
export class StandardMaterial extends Material {
  private shaderModule: GPUShaderModule | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private placeholderTexture: GPUTexture | null = null;

  constructor(config: StandardMaterialConfig = {}) {
    super({
      ...config,
      name: config.name ?? 'StandardMaterial',
      uniforms: STANDARD_UNIFORMS,
      uniformValues: {
        color: config.color ?? [1, 1, 1, 1],
        opacity: config.opacity ?? 1.0,
        useTexture: config.useTexture ? 1.0 : 0.0,
        useNormalMap: config.useNormalMap ? 1.0 : 0.0,
        envMapIntensity: config.envMapIntensity ?? 0.0,
        roughness: config.roughness ?? 0.5,
        metalness: config.metalness ?? 0.0,
        emissive: config.emissive ?? [0, 0, 0],
        emissiveIntensity: config.emissiveIntensity ?? 1.0,
      },
    });
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

    // Create placeholder texture (1x1 white)
    this.placeholderTexture = device.createTexture({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    device.queue.writeTexture(
      { texture: this.placeholderTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      [1, 1, 1]
    );

    // Create sampler
    const sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
    });
    this.samplers.set('default', sampler);

    // Generate shader code
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
      }
    }

    // Create bind group layout
    this.bindGroupLayout = this.createBindGroupLayout(device);

    // Create pipeline
    await this.createPipeline(device);
  }

  /**
   * Generate shader code
   */
  private generateShaderCode(): string {
    const parts: string[] = [];

    // Uniform struct
    parts.push(generateUniformStruct('Uniforms', STANDARD_UNIFORMS));
    parts.push('@group(0) @binding(0) var<uniform> uniforms: Uniforms;');

    // Vertex shader
    parts.push('// === Vertex Shader ===');
    parts.push(VERTEX_SHADER);

    // Fragment shader
    parts.push('// === Fragment Shader ===');
    parts.push(FRAGMENT_SHADER);

    return parts.join('\n\n');
  }

  /**
   * Create bind group layout
   */
  private createBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
    return device.createBindGroupLayout({
      label: `${this.name}_bindGroupLayout`,
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' },
        },
      ],
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

    // Vertex layout with position, texCoord, normal
    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 32, // 3 + 2 + 3 floats = 8 floats = 32 bytes
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
        { shaderLocation: 1, offset: 12, format: 'float32x2' }, // texCoord
        { shaderLocation: 2, offset: 20, format: 'float32x3' }, // normal
      ],
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
          format: 'bgra8unorm',
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
   * Update bind group
   */
  private updateBindGroup(): void {
    if (!this.device || !this.bindGroupLayout) return;

    const buffer = this.uniformBuffer?.getBuffer();
    if (!buffer) return;

    const sampler = this.samplers.get('default');
    if (!sampler) return;

    // Use set texture or placeholder
    const texture = this.textures.get('base') ?? this.placeholderTexture;
    if (!texture) return;

    this.bindGroup = this.device.createBindGroup({
      label: `${this.name}_bindGroup`,
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer } },
        { binding: 1, resource: sampler },
        { binding: 2, resource: texture.createView() },
      ],
    });

    this.needsBindGroupUpdate = false;
  }

  // =========================================
  // Convenience setters
  // =========================================

  /**
   * Set base color
   */
  setColor(r: number, g: number, b: number, a = 1): this {
    this.setUniform('color', [r, g, b, a]);
    return this;
  }

  /**
   * Set opacity
   */
  setOpacity(opacity: number): this {
    this.setUniform('opacity', opacity);
    return this;
  }

  /**
   * Set emissive color and intensity
   */
  setEmissive(r: number, g: number, b: number, intensity = 1): this {
    this.setUniform('emissive', [r, g, b]);
    this.setUniform('emissiveIntensity', intensity);
    return this;
  }

  /**
   * Set roughness
   */
  setRoughness(roughness: number): this {
    this.setUniform('roughness', roughness);
    return this;
  }

  /**
   * Set metalness
   */
  setMetalness(metalness: number): this {
    this.setUniform('metalness', metalness);
    return this;
  }

  /**
   * Enable/disable texture
   */
  enableTexture(enabled: boolean): this {
    this.setUniform('useTexture', enabled ? 1.0 : 0.0);
    return this;
  }

  /**
   * Set the base texture
   */
  setBaseTexture(texture: GPUTexture): this {
    this.setTexture('base', texture);
    this.enableTexture(true);
    return this;
  }

  // =========================================
  // Material interface
  // =========================================

  getPipeline(): GPURenderPipeline | null {
    return this.pipeline;
  }

  getBindGroup(): GPUBindGroup | null {
    if (this.needsBindGroupUpdate) {
      this.updateBindGroup();
    }
    return this.bindGroup;
  }

  override destroy(): void {
    this.placeholderTexture?.destroy();
    this.shaderModule = null;
    this.bindGroupLayout = null;
    super.destroy();
  }
}

/**
 * Create a simple colored material
 */
export function createColorMaterial(
  r: number,
  g: number,
  b: number,
  a = 1,
  options: Partial<StandardMaterialConfig> = {}
): StandardMaterial {
  return new StandardMaterial({
    ...options,
    color: [r, g, b, a],
  });
}

/**
 * Create a simple textured material
 */
export function createTexturedMaterial(
  options: Partial<StandardMaterialConfig> = {}
): StandardMaterial {
  return new StandardMaterial({
    ...options,
    useTexture: true,
  });
}

/**
 * Create an emissive/glowing material
 */
export function createEmissiveMaterial(
  r: number,
  g: number,
  b: number,
  intensity = 1,
  options: Partial<StandardMaterialConfig> = {}
): StandardMaterial {
  return new StandardMaterial({
    ...options,
    emissive: [r, g, b],
    emissiveIntensity: intensity,
  });
}
