/**
 * QuadRenderer
 * 
 * Renders textured quads for DOM surfaces with GPU effects.
 * Supports instanced rendering for multiple surfaces.
 */

/// <reference types="@webgpu/types" />

import type { WebGPUContext } from './WebGPUContext';
import type { ShaderLibrary } from './ShaderLibrary';

export interface QuadVertex {
  position: [number, number];
  texCoord: [number, number];
}

export interface QuadInstance {
  transform: Float32Array; // 4x4 matrix
  rect: [number, number, number, number]; // x, y, width, height
  opacity: number;
  texture?: GPUTexture;
}

export interface QuadRenderOptions {
  clearColor?: [number, number, number, number];
  renderTarget?: GPUTexture;
}

export class QuadRenderer {
  private gpuContext: WebGPUContext;
  private shaderLibrary: ShaderLibrary;
  private pipeline: GPURenderPipeline | null;
  private vertexBuffer: GPUBuffer | null;
  private indexBuffer: GPUBuffer | null;
  private sampler: GPUSampler | null;
  private initialized: boolean;

  constructor(gpuContext: WebGPUContext, shaderLibrary: ShaderLibrary) {
    this.gpuContext = gpuContext;
    this.shaderLibrary = shaderLibrary;
    this.pipeline = null;
    this.vertexBuffer = null;
    this.indexBuffer = null;
    this.sampler = null;
    this.initialized = false;
  }

  /**
   * Initialize the quad renderer
   */
  initialize(): boolean {
    if (!this.gpuContext.isAvailable || !this.gpuContext.device) {
      console.warn('QuadRenderer: WebGPU not available, skipping initialization');
      return false;
    }

    try {
      this.createBuffers();
      this.createSampler();
      this.createPipeline();
      this.initialized = true;
      return true;
    } catch (error: unknown) {
      console.error('QuadRenderer initialization failed:', error);
      return false;
    }
  }

  /**
   * Create vertex and index buffers for a quad
   */
  private createBuffers(): void {
    const device: GPUDevice = this.gpuContext.device!;

    // Quad vertices (position + texCoord)
    // Triangle strip: top-left, top-right, bottom-left, bottom-right
    const vertices: Float32Array = new Float32Array([
      // position (x, y), texCoord (u, v)
      -1.0,  1.0,  0.0, 0.0, // top-left
       1.0,  1.0,  1.0, 0.0, // top-right
      -1.0, -1.0,  0.0, 1.0, // bottom-left
       1.0, -1.0,  1.0, 1.0, // bottom-right
    ]);

    this.vertexBuffer = device.createBuffer({
      label: 'Quad Vertex Buffer',
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });

    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
    this.vertexBuffer.unmap();

    // Quad indices for two triangles
    const indices: Uint16Array = new Uint16Array([
      0, 1, 2, // first triangle
      2, 1, 3  // second triangle
    ]);

    this.indexBuffer = device.createBuffer({
      label: 'Quad Index Buffer',
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });

    new Uint16Array(this.indexBuffer.getMappedRange()).set(indices);
    this.indexBuffer.unmap();
  }

  /**
   * Create texture sampler
   */
  private createSampler(): void {
    const device: GPUDevice = this.gpuContext.device!;

    this.sampler = device.createSampler({
      label: 'Quad Texture Sampler',
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge'
    });
  }

  /**
   * Create render pipeline
   */
  private createPipeline(): void {
    const device: GPUDevice = this.gpuContext.device!;
    const format: GPUTextureFormat = this.gpuContext.format!;

    // Get shaders from library
    const vertexShader: ReturnType<ShaderLibrary['get']> = this.shaderLibrary.get('passthrough_vertex');
    const fragmentShader: ReturnType<ShaderLibrary['get']> = this.shaderLibrary.get('textured_quad');

    if (!vertexShader || !fragmentShader) {
      throw new Error('Required shaders not found in library');
    }

    // Vertex buffer layout
    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 4 * 4, // 4 floats per vertex (2 position + 2 texCoord)
      attributes: [
        {
          // position
          shaderLocation: 0,
          offset: 0,
          format: 'float32x2'
        },
        {
          // texCoord
          shaderLocation: 1,
          offset: 2 * 4,
          format: 'float32x2'
        }
      ]
    };

    this.pipeline = device.createRenderPipeline({
      label: 'Quad Render Pipeline',
      layout: 'auto',
      vertex: {
        module: vertexShader.module,
        entryPoint: vertexShader.entryPoints.vertex,
        buffers: [vertexBufferLayout]
      },
      fragment: {
        module: fragmentShader.module,
        entryPoint: fragmentShader.entryPoints.fragment,
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              }
            }
          }
        ]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none'
      },
      depthStencil: undefined
    });
  }

  /**
   * Create a bind group for a texture
   */
  createBindGroup(texture: GPUTexture): GPUBindGroup {
    const device: GPUDevice = this.gpuContext.device!;

    return device.createBindGroup({
      label: 'Quad Texture Bind Group',
      layout: this.pipeline!.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: this.sampler!
        },
        {
          binding: 1,
          resource: texture.createView()
        }
      ]
    });
  }

  /**
   * Render a single quad
   */
  renderQuad(
    commandEncoder: GPUCommandEncoder,
    bindGroup: GPUBindGroup,
    options: QuadRenderOptions = {}
  ): void {
    if (!this.initialized || !this.pipeline) {
      return;
    }

    const context: GPUCanvasContext = this.gpuContext.context!;
    const currentTexture: GPUTexture = options.renderTarget || context.getCurrentTexture();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: currentTexture.createView(),
          clearValue: options.clearColor || [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store'
        }
      ]
    };

    const passEncoder: GPURenderPassEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.setIndexBuffer(this.indexBuffer!, 'uint16');
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.drawIndexed(6, 1, 0, 0, 0);
    passEncoder.end();
  }

  /**
   * Begin a render pass for multiple quads
   */
  beginRenderPass(
    commandEncoder: GPUCommandEncoder,
    options: QuadRenderOptions = {}
  ): GPURenderPassEncoder | null {
    if (!this.initialized || !this.pipeline) {
      return null;
    }

    const context: GPUCanvasContext = this.gpuContext.context!;
    const currentTexture: GPUTexture = options.renderTarget || context.getCurrentTexture();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: currentTexture.createView(),
          clearValue: options.clearColor || [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store'
        }
      ]
    };

    const passEncoder: GPURenderPassEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.setIndexBuffer(this.indexBuffer!, 'uint16');

    return passEncoder;
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
    this.vertexBuffer?.destroy();
    this.indexBuffer?.destroy();
    
    this.pipeline = null;
    this.vertexBuffer = null;
    this.indexBuffer = null;
    this.sampler = null;
    this.initialized = false;
  }
}
