/**
 * ScreenPass
 * 
 * Manages fullscreen post-processing passes.
 * Used for screen effects like blur, vignette, chromatic aberration, etc.
 */

/// <reference types="@webgpu/types" />

import type { WebGPUContext } from './WebGPUContext';
import type { ShaderLibrary } from './ShaderLibrary';

export interface ScreenPassOptions {
  shaderName: string;
  uniformData?: Float32Array;
}

export interface ScreenPassEffect {
  name: string;
  pipeline: GPURenderPipeline;
  uniformBuffer?: GPUBuffer;
  bindGroup?: GPUBindGroup;
}

export class ScreenPass {
  private gpuContext: WebGPUContext;
  private shaderLibrary: ShaderLibrary;
  private sampler: GPUSampler | null;
  private effects: Map<string, ScreenPassEffect>;
  private initialized: boolean;
  private effectCounter: number;

  constructor(gpuContext: WebGPUContext, shaderLibrary: ShaderLibrary) {
    this.gpuContext = gpuContext;
    this.shaderLibrary = shaderLibrary;
    this.sampler = null;
    this.effects = new Map();
    this.initialized = false;
    this.effectCounter = 0;
  }

  /**
   * Initialize the screen pass system
   */
  initialize(): boolean {
    if (!this.gpuContext.isAvailable || !this.gpuContext.device) {
      console.warn('ScreenPass: WebGPU not available, skipping initialization');
      return false;
    }

    try {
      this.createSampler();
      this.initialized = true;
      return true;
    } catch (error: unknown) {
      console.error('ScreenPass initialization failed:', error);
      return false;
    }
  }

  /**
   * Create texture sampler for screen passes
   */
  private createSampler(): void {
    const device: GPUDevice = this.gpuContext.device!;

    this.sampler = device.createSampler({
      label: 'Screen Pass Sampler',
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge'
    });
  }

  /**
   * Create a screen pass effect
   */
  createEffect(options: ScreenPassOptions): string {
    if (!this.initialized) {
      throw new Error('ScreenPass not initialized');
    }

    const device: GPUDevice = this.gpuContext.device!;
    const format: GPUTextureFormat = this.gpuContext.format!;

    // Get shaders from library
    const vertexShader: ReturnType<ShaderLibrary['get']> = this.shaderLibrary.get('fullscreen_vertex');
    const fragmentShader: ReturnType<ShaderLibrary['get']> = this.shaderLibrary.get(options.shaderName);

    if (!vertexShader || !fragmentShader) {
      throw new Error(`Shader not found: ${options.shaderName}`);
    }

    // Create uniform buffer if data provided
    let uniformBuffer: GPUBuffer | undefined;
    if (options.uniformData) {
      uniformBuffer = device.createBuffer({
        label: `${options.shaderName} Uniform Buffer`,
        size: options.uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });

      device.queue.writeBuffer(uniformBuffer, 0, options.uniformData.buffer, options.uniformData.byteOffset, options.uniformData.byteLength);
    }

    // Create pipeline - wrap in try-catch to cleanup buffer on failure
    let pipeline: GPURenderPipeline;
    try {
      pipeline = device.createRenderPipeline({
        label: `${options.shaderName} Pipeline`,
        layout: 'auto',
        vertex: {
          module: vertexShader.module,
          entryPoint: vertexShader.entryPoints.vertex,
          buffers: [] // Fullscreen quad generated in vertex shader
        },
        fragment: {
          module: fragmentShader.module,
          entryPoint: fragmentShader.entryPoints.fragment,
          targets: [
            {
              format,
              blend: {
                color: {
                  srcFactor: 'one',
                  dstFactor: 'zero',
                  operation: 'add'
                },
                alpha: {
                  srcFactor: 'one',
                  dstFactor: 'zero',
                  operation: 'add'
                }
              }
            }
          ]
        },
        primitive: {
          topology: 'triangle-strip',
          stripIndexFormat: undefined
        }
      });
    } catch (error: unknown) {
      // Cleanup uniform buffer if pipeline creation failed
      uniformBuffer?.destroy();
      throw error;
    }

    const effectName: string = `${options.shaderName}_${++this.effectCounter}`;
    
    this.effects.set(effectName, {
      name: options.shaderName,
      pipeline,
      uniformBuffer,
      bindGroup: undefined // Created during render
    });

    return effectName;
  }

  /**
   * Update uniform data for an effect
   */
  updateUniform(effectName: string, data: Float32Array): void {
    if (!this.initialized || !this.gpuContext.device) {
      console.warn('ScreenPass: Cannot update uniform - not initialized or device unavailable');
      return;
    }

    const effect: ScreenPassEffect | undefined = this.effects.get(effectName);
    if (!effect || !effect.uniformBuffer) {
      console.warn(`Effect ${effectName} not found or has no uniform buffer`);
      return;
    }

    const device: GPUDevice = this.gpuContext.device;
    device.queue.writeBuffer(effect.uniformBuffer, 0, data.buffer, data.byteOffset, data.byteLength);
  }

  /**
   * Create bind group for texture input
   */
  private createBindGroup(
    effect: ScreenPassEffect,
    texture: GPUTexture
  ): GPUBindGroup {
    const device: GPUDevice = this.gpuContext.device!;

    const entries: GPUBindGroupEntry[] = [
      {
        binding: 0,
        resource: this.sampler!
      },
      {
        binding: 1,
        resource: texture.createView()
      }
    ];

    // Add uniform buffer if present
    if (effect.uniformBuffer) {
      entries.push({
        binding: 2,
        resource: {
          buffer: effect.uniformBuffer
        }
      });
    }

    return device.createBindGroup({
      label: `${effect.name} Bind Group`,
      layout: effect.pipeline.getBindGroupLayout(0),
      entries
    });
  }

  /**
   * Execute a screen pass effect
   * @returns true if the effect was executed, false if skipped (not initialized or effect not found)
   */
  execute(
    commandEncoder: GPUCommandEncoder,
    effectName: string,
    sourceTexture: GPUTexture,
    targetTexture?: GPUTexture
  ): boolean {
    if (!this.initialized) {
      return false;
    }

    const effect: ScreenPassEffect | undefined = this.effects.get(effectName);
    if (!effect) {
      console.warn(`Effect ${effectName} not found`);
      return false;
    }

    const context: GPUCanvasContext = this.gpuContext.context!;
    const renderTarget: GPUTexture = targetTexture || context.getCurrentTexture();

    // Create bind group for this render
    const bindGroup: GPUBindGroup = this.createBindGroup(effect, sourceTexture);

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: renderTarget.createView(),
          clearValue: [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store'
        }
      ]
    };

    const passEncoder: GPURenderPassEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(effect.pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(4, 1, 0, 0); // Draw fullscreen quad
    passEncoder.end();

    return true;
  }

  /**
   * Execute multiple effects in sequence
   */
  executeStack(
    commandEncoder: GPUCommandEncoder,
    effectNames: string[],
    sourceTexture: GPUTexture,
    intermediateTextures: GPUTexture[],
    finalTarget?: GPUTexture
  ): void {
    if (!this.initialized || !this.gpuContext.context) {
      return;
    }

    if (effectNames.length === 0) {
      return;
    }

    // Single effect - render directly to final target
    if (effectNames.length === 1) {
      this.execute(commandEncoder, effectNames[0], sourceTexture, finalTarget);
      return;
    }

    // Validate intermediate textures for multi-effect stacks
    // For 2 effects: need 1 intermediate (effect 0 → intermediate, effect 1 → finalTarget)
    // For 3+ effects: need 2 intermediates for ping-pong (effect 0 → int[0], effect 1 → int[1], effect 2 → finalTarget)
    const requiredIntermediates: number = effectNames.length === 2 ? 1 : 2;
    if (effectNames.length > 1 && intermediateTextures.length < requiredIntermediates) {
      console.warn(`executeStack requires at least ${requiredIntermediates} intermediate texture(s) for ${effectNames.length} effects`);
      // Fallback: execute only the first effect
      this.execute(commandEncoder, effectNames[0], sourceTexture, finalTarget);
      return;
    }

    // Multiple effects - ping-pong between intermediate textures
    let currentSource: GPUTexture = sourceTexture;
    
    for (let i: number = 0; i < effectNames.length; i++) {
      const isLastEffect: boolean = i === effectNames.length - 1;
      const target: GPUTexture = isLastEffect 
        ? (finalTarget || this.gpuContext.context!.getCurrentTexture())
        : intermediateTextures[i % intermediateTextures.length];

      const executed: boolean = this.execute(commandEncoder, effectNames[i], currentSource, target);
      // Only update currentSource if the effect actually rendered to the target
      // This prevents subsequent effects from reading uninitialized texture data
      if (executed) {
        currentSource = target;
      }
    }
  }

  /**
   * Create an intermediate render texture
   */
  createIntermediateTexture(width: number, height: number): GPUTexture {
    if (!this.initialized) {
      throw new Error('ScreenPass not initialized');
    }

    const device: GPUDevice = this.gpuContext.device!;
    const format: GPUTextureFormat = this.gpuContext.format!;

    return device.createTexture({
      label: 'Intermediate Render Texture',
      size: { width, height },
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
  }

  /**
   * Remove an effect
   */
  removeEffect(effectName: string): void {
    const effect: ScreenPassEffect | undefined = this.effects.get(effectName);
    if (effect) {
      effect.uniformBuffer?.destroy();
      this.effects.delete(effectName);
    }
  }

  /**
   * Check if renderer is initialized
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    for (const effect of this.effects.values()) {
      effect.uniformBuffer?.destroy();
    }

    this.effects.clear();
    this.sampler = null;
    this.initialized = false;
  }
}
