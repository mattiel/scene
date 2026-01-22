/**
 * SurfaceEffect - Base interface for per-surface visual effects
 * 
 * Surface effects are applied to individual surfaces and can be
 * stacked/composed. They define how a surface is rendered differently
 * from its default appearance.
 */

/// <reference types="@webgpu/types" />

import type { Surface, SurfaceRect } from '../Surface';

/** Effect uniform value types */
export type EffectUniformValue = number | [number, number] | [number, number, number] | [number, number, number, number];

/** Effect uniform definition */
export interface EffectUniform {
  name: string;
  type: 'f32' | 'vec2f' | 'vec3f' | 'vec4f';
  value: EffectUniformValue;
}

/** Render context passed to effects */
export interface EffectRenderContext {
  /** GPU device */
  device: GPUDevice;
  /** Surface being rendered */
  surface: Surface;
  /** Current surface rect */
  rect: SurfaceRect;
  /** Input texture (surface content or previous effect output) */
  inputTexture: GPUTexture;
  /** Output texture to render to */
  outputTexture: GPUTexture;
  /** Time in seconds since effect was added */
  time: number;
  /** Delta time since last frame */
  deltaTime: number;
}

/**
 * SurfaceEffect - Interface for surface effects
 * 
 * Effects can modify how a surface is rendered. They receive
 * an input texture (the surface content or previous effect output)
 * and render to an output texture.
 * 
 * @example
 * ```typescript
 * class MyEffect implements SurfaceEffect {
 *   readonly id = 'my-effect';
 *   readonly name = 'My Custom Effect';
 *   
 *   apply(ctx: EffectRenderContext): void {
 *     // Render effect to ctx.outputTexture
 *   }
 * }
 * ```
 */
export interface SurfaceEffect {
  /** Unique identifier for this effect instance */
  readonly id: string;
  
  /** Human-readable name */
  readonly name: string;
  
  /** Whether the effect is currently enabled */
  enabled: boolean;
  
  /** Effect intensity/strength (0-1) */
  intensity: number;
  
  /**
   * Initialize GPU resources
   * Called once when effect is first used
   */
  init?(device: GPUDevice): Promise<void>;
  
  /**
   * Get shader code for this effect
   * Returns WGSL fragment shader code
   */
  getShaderCode?(): string;
  
  /**
   * Get uniforms for this effect
   */
  getUniforms(): EffectUniform[];
  
  /**
   * Update effect state (called each frame)
   */
  update?(time: number, deltaTime: number): void;
  
  /**
   * Apply the effect
   * Renders from inputTexture to outputTexture
   */
  apply(ctx: EffectRenderContext): void;
  
  /**
   * Clean up GPU resources
   */
  destroy?(): void;
}

/**
 * Base class for surface effects with common functionality
 */
export abstract class BaseSurfaceEffect implements SurfaceEffect {
  readonly id: string;
  readonly name: string;
  enabled = true;
  intensity = 1.0;
  
  protected device: GPUDevice | null = null;
  protected pipeline: GPURenderPipeline | null = null;
  protected bindGroupLayout: GPUBindGroupLayout | null = null;
  protected sampler: GPUSampler | null = null;
  protected uniformBuffer: GPUBuffer | null = null;
  protected initialized = false;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  async init(device: GPUDevice): Promise<void> {
    if (this.initialized) return;
    
    this.device = device;
    
    // Create sampler
    this.sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    });
    
    // Create uniform buffer
    const uniforms = this.getUniforms();
    const bufferSize = this.calculateUniformBufferSize(uniforms);
    if (bufferSize > 0) {
      this.uniformBuffer = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }
    
    // Create bind group layout
    this.bindGroupLayout = this.createBindGroupLayout(device);
    
    // Create pipeline
    await this.createPipeline(device);
    
    this.initialized = true;
  }

  protected calculateUniformBufferSize(uniforms: EffectUniform[]): number {
    let size = 0;
    for (const u of uniforms) {
      switch (u.type) {
        case 'f32': size += 4; break;
        case 'vec2f': size += 8; break;
        case 'vec3f': size += 12; break;
        case 'vec4f': size += 16; break;
      }
    }
    // Align to 16 bytes
    return Math.ceil(size / 16) * 16;
  }

  protected createBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
    return device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });
  }

  protected async createPipeline(device: GPUDevice): Promise<void> {
    if (!this.bindGroupLayout) return;

    const shaderCode = this.getFullShaderCode();
    const shaderModule = device.createShaderModule({ code: shaderCode });

    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout],
    });

    this.pipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{ format: 'rgba8unorm' }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  protected getFullShaderCode(): string {
    return `
      struct Uniforms {
        intensity: f32,
        time: f32,
        resolution: vec2f,
        ${this.getUniformStructFields()}
      }

      @group(0) @binding(0) var texSampler: sampler;
      @group(0) @binding(1) var inputTex: texture_2d<f32>;
      @group(0) @binding(2) var<uniform> uniforms: Uniforms;

      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) texCoord: vec2f,
      }

      @vertex
      fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
        var pos = array<vec2f, 3>(
          vec2f(-1.0, -1.0),
          vec2f(3.0, -1.0),
          vec2f(-1.0, 3.0)
        );
        var uv = array<vec2f, 3>(
          vec2f(0.0, 1.0),
          vec2f(2.0, 1.0),
          vec2f(0.0, -1.0)
        );
        var output: VertexOutput;
        output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
        output.texCoord = uv[vertexIndex];
        return output;
      }

      ${this.getEffectShaderCode()}
    `;
  }

  protected getUniformStructFields(): string {
    const uniforms = this.getUniforms();
    return uniforms
      .filter(u => u.name !== 'intensity' && u.name !== 'time' && u.name !== 'resolution')
      .map(u => `${u.name}: ${u.type},`)
      .join('\n        ');
  }

  protected getDefaultFragmentShader(): string {
    return `
      @fragment
      fn fragmentMain(@location(0) texCoord: vec2f) -> @location(0) vec4f {
        return textureSample(inputTex, texSampler, texCoord);
      }
    `;
  }

  /**
   * Get the effect-specific shader code
   * Override in subclasses to provide custom fragment shader
   */
  protected getEffectShaderCode(): string {
    return this.getDefaultFragmentShader();
  }

  abstract getUniforms(): EffectUniform[];

  apply(ctx: EffectRenderContext): void {
    if (!this.device || !this.pipeline || !this.sampler || !this.bindGroupLayout) return;
    if (!this.enabled || this.intensity === 0) return;

    // Update uniforms
    this.updateUniforms(ctx);

    // Create bind group
    const bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: ctx.inputTexture.createView() },
        { binding: 2, resource: { buffer: this.uniformBuffer! } },
      ],
    });

    // Create render pass
    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: ctx.outputTexture.createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
      }],
    });

    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(3);
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  protected updateUniforms(ctx: EffectRenderContext): void {
    if (!this.device || !this.uniformBuffer) return;

    const uniforms = this.getUniforms();
    const data = new Float32Array(this.calculateUniformBufferSize(uniforms) / 4);
    
    // Standard uniforms
    data[0] = this.intensity;
    data[1] = ctx.time;
    data[2] = ctx.rect.width;
    data[3] = ctx.rect.height;
    
    // Custom uniforms starting at offset 4
    let offset = 4;
    for (const u of uniforms) {
      if (u.name === 'intensity' || u.name === 'time' || u.name === 'resolution') continue;
      
      if (typeof u.value === 'number') {
        data[offset++] = u.value;
      } else {
        for (const v of u.value) {
          data[offset++] = v;
        }
      }
    }

    this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
  }

  destroy(): void {
    this.uniformBuffer?.destroy();
    this.pipeline = null;
    this.bindGroupLayout = null;
    this.sampler = null;
    this.device = null;
    this.initialized = false;
  }
}
