/**
 * TransitionEffect
 *
 * Manages transitions between two visual states.
 * Used for navigation transitions with dissolve, wipe, and other effects.
 */

/// <reference types="@webgpu/types" />

import type { WebGPUContext, ShaderLibrary } from '@scene/renderer';

export type TransitionType = 
  | 'dissolve' 
  | 'wipe' 
  | 'fade_to_black' 
  | 'zoom'
  | 'slide'
  | 'flip'
  | 'cube'
  | 'morph';

export type WipeDirection =
  | 'left-to-right'
  | 'right-to-left'
  | 'top-to-bottom'
  | 'bottom-to-top';

export type SlideDirection = 'left' | 'right' | 'up' | 'down';

export type FlipAxis = 'horizontal' | 'vertical';

export type CubeDirection = 'left' | 'right';

export interface TransitionConfig {
  type: TransitionType;
  duration?: number;
  /** For wipe: direction of the wipe */
  wipeDirection?: WipeDirection;
  /** For wipe: edge softness (0-1) */
  wipeSoftness?: number;
  /** For zoom: zoom amount multiplier */
  zoomAmount?: number;
  /** For slide: direction to slide from */
  slideDirection?: SlideDirection;
  /** For flip: axis to flip around */
  flipAxis?: FlipAxis;
  /** For cube: direction to rotate */
  cubeDirection?: CubeDirection;
  /** For cube: depth of the cube effect (default: 0.5) */
  cubeDepth?: number;
  /** For morph: displacement strength (default: 0.1) */
  morphStrength?: number;
}

const WIPE_DIRECTION_MAP: Record<WipeDirection, number> = {
  'left-to-right': 0,
  'right-to-left': 1,
  'top-to-bottom': 2,
  'bottom-to-top': 3,
};

const SLIDE_DIRECTION_MAP: Record<SlideDirection, number> = {
  'left': 0,
  'right': 1,
  'up': 2,
  'down': 3,
};

const FLIP_AXIS_MAP: Record<FlipAxis, number> = {
  'horizontal': 0,
  'vertical': 1,
};

const CUBE_DIRECTION_MAP: Record<CubeDirection, number> = {
  'left': 0,
  'right': 1,
};

export class TransitionEffect {
  private gpuContext: WebGPUContext;
  private shaderLibrary: ShaderLibrary;
  private config: Required<TransitionConfig>;

  private pipeline: GPURenderPipeline | null;
  private uniformBuffer: GPUBuffer | null;
  private sampler: GPUSampler | null;
  private bindGroupLayout: GPUBindGroupLayout | null;

  private progress: number;
  private initialized: boolean;

  constructor(
    gpuContext: WebGPUContext,
    shaderLibrary: ShaderLibrary,
    config: TransitionConfig
  ) {
    this.gpuContext = gpuContext;
    this.shaderLibrary = shaderLibrary;
    this.config = {
      type: config.type,
      duration: config.duration ?? 500,
      wipeDirection: config.wipeDirection ?? 'left-to-right',
      wipeSoftness: config.wipeSoftness ?? 0.1,
      zoomAmount: config.zoomAmount ?? 0.3,
      slideDirection: config.slideDirection ?? 'left',
      flipAxis: config.flipAxis ?? 'horizontal',
      cubeDirection: config.cubeDirection ?? 'left',
      cubeDepth: config.cubeDepth ?? 0.5,
      morphStrength: config.morphStrength ?? 0.1,
    };

    this.pipeline = null;
    this.uniformBuffer = null;
    this.sampler = null;
    this.bindGroupLayout = null;

    this.progress = 0;
    this.initialized = false;
  }

  /**
   * Initialize the transition effect
   */
  initialize(): boolean {
    if (!this.gpuContext.isAvailable || !this.gpuContext.device) {
      console.warn('TransitionEffect: WebGPU not available');
      return false;
    }

    try {
      // initialize() can be called multiple times (e.g. renderer re-creation).
      // Ensure we tear down previously-created GPU resources to avoid using
      // stale pipelines/buffers from a destroyed device.
      if (this.initialized || this.uniformBuffer || this.sampler || this.bindGroupLayout) {
        this.cleanup();
      }

      const device: GPUDevice = this.gpuContext.device;

      // Create sampler
      this.sampler = device.createSampler({
        label: 'Transition Sampler',
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });

      // Create uniform buffer
      this.uniformBuffer = device.createBuffer({
        label: 'Transition Uniform Buffer',
        size: 16, // 4x f32
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Create bind group layout
      this.bindGroupLayout = device.createBindGroupLayout({
        label: 'Transition Bind Group Layout',
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: 'filtering' },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: 'float' },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: 'float' },
          },
          {
            binding: 3,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' },
          },
        ],
      });

      // Create pipeline
      this.createPipeline();

      // Initialize uniform buffer with default configuration values
      this.updateUniforms();

      this.initialized = true;
      return true;
    } catch (error: unknown) {
      console.error('TransitionEffect initialization failed:', error);
      this.cleanup();
      return false;
    }
  }

  /**
   * Create the render pipeline for the current transition type
   */
  private createPipeline(): void {
    if (!this.gpuContext.device || !this.gpuContext.format) {
      return;
    }

    const device: GPUDevice = this.gpuContext.device;
    const format: GPUTextureFormat = this.gpuContext.format;

    // Get shaders
    const vertexShader = this.shaderLibrary.get('fullscreen_vertex');
    const fragmentShader = this.shaderLibrary.get(
      `transition_${this.config.type}`
    );

    if (!vertexShader || !fragmentShader) {
      throw new Error(`Transition shader not found: transition_${this.config.type}`);
    }

    const pipelineLayout: GPUPipelineLayout = device.createPipelineLayout({
      label: 'Transition Pipeline Layout',
      bindGroupLayouts: [this.bindGroupLayout!],
    });

    this.pipeline = device.createRenderPipeline({
      label: `Transition Pipeline (${this.config.type})`,
      layout: pipelineLayout,
      vertex: {
        module: vertexShader.module,
        entryPoint: vertexShader.entryPoints.vertex,
        buffers: [],
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
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'zero',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-strip',
      },
    });
  }

  /**
   * Set transition progress (0-1)
   */
  setProgress(progress: number): void {
    this.progress = Math.max(0, Math.min(1, progress));
    this.updateUniforms();
  }

  /**
   * Get current progress
   */
  getProgress(): number {
    return this.progress;
  }

  /**
   * Update uniform buffer with current state
   */
  private updateUniforms(): void {
    if (!this.uniformBuffer || !this.gpuContext.device) {
      return;
    }

    const data = new Float32Array(4);
    data[0] = this.progress;

    // Type-specific uniforms
    switch (this.config.type) {
      case 'wipe':
        data[1] = this.config.wipeSoftness;
        data[2] = WIPE_DIRECTION_MAP[this.config.wipeDirection];
        break;
      case 'zoom':
        data[1] = this.config.zoomAmount;
        break;
      case 'slide':
        data[1] = SLIDE_DIRECTION_MAP[this.config.slideDirection];
        break;
      case 'flip':
        data[1] = FLIP_AXIS_MAP[this.config.flipAxis];
        break;
      case 'cube':
        data[1] = CUBE_DIRECTION_MAP[this.config.cubeDirection];
        data[2] = this.config.cubeDepth;
        break;
      case 'morph':
        data[1] = this.config.morphStrength;
        break;
    }

    this.gpuContext.device.queue.writeBuffer(this.uniformBuffer, 0, data);
  }

  /**
   * Execute the transition
   */
  execute(
    commandEncoder: GPUCommandEncoder,
    textureFrom: GPUTexture,
    textureTo: GPUTexture,
    targetTexture?: GPUTexture
  ): boolean {
    if (!this.initialized || !this.pipeline || !this.gpuContext.context || !this.gpuContext.device) {
      return false;
    }

    const device: GPUDevice = this.gpuContext.device;

    // Create bind group
    const bindGroup: GPUBindGroup = device.createBindGroup({
      label: 'Transition Bind Group',
      layout: this.bindGroupLayout!,
      entries: [
        { binding: 0, resource: this.sampler! },
        { binding: 1, resource: textureFrom.createView() },
        { binding: 2, resource: textureTo.createView() },
        { binding: 3, resource: { buffer: this.uniformBuffer! } },
      ],
    });

    const target: GPUTexture =
      targetTexture || this.gpuContext.context.getCurrentTexture();

    const renderPass: GPURenderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: target.createView(),
          clearValue: [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(4, 1, 0, 0);
    renderPass.end();

    return true;
  }

  /**
   * Change transition type
   */
  setType(type: TransitionType): void {
    if (this.config.type === type) {
      return;
    }

    this.config.type = type;

    if (this.initialized) {
      this.createPipeline();
      this.updateUniforms();
    }
  }

  /**
   * Update transition configuration
   */
  configure(config: Partial<TransitionConfig>): void {
    const typeChanged = config.type && config.type !== this.config.type;

    Object.assign(this.config, config);

    if (typeChanged && this.initialized) {
      this.createPipeline();
    }

    this.updateUniforms();
  }

  /**
   * Get transition duration in milliseconds
   */
  get duration(): number {
    return this.config.duration;
  }

  /**
   * Check if initialized
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.uniformBuffer?.destroy();
    this.uniformBuffer = null;
    this.sampler = null;
    this.pipeline = null;
    this.bindGroupLayout = null;
    this.initialized = false;
  }

  /**
   * Destroy the transition effect
   */
  destroy(): void {
    this.cleanup();
  }
}
