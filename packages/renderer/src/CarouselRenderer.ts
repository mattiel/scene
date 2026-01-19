/**
 * CarouselRenderer
 *
 * Renders a set of textured cards in a 3D arc using WebGPU.
 * Designed for the Phase 8 carousel demo.
 */

/// <reference types="@webgpu/types" />

import type { WebGPUContext } from './WebGPUContext';
import type { ShaderLibrary } from './ShaderLibrary';

export interface CarouselCardTexture {
  id: string;
  width: number;
  height: number;
  source: CanvasImageSource;
}

export interface CarouselCardState {
  id: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  width: number;
  height: number;
  bend: number;
  opacity?: number;
}

export interface CarouselRendererOptions {
  cameraZ?: number;
  near?: number;
  far?: number;
}

interface CardResources {
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  texture: GPUTexture;
  textureSize: { width: number; height: number };
}

interface GlobalResources {
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
}

const DEFAULT_OPTIONS: Required<CarouselRendererOptions> = {
  cameraZ: 1200,
  near: 0.1,
  far: 4000,
};

export class CarouselRenderer {
  private gpuContext: WebGPUContext;
  private shaderLibrary: ShaderLibrary;
  private options: Required<CarouselRendererOptions>;

  private pipeline: GPURenderPipeline | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private indexBuffer: GPUBuffer | null = null;
  private sampler: GPUSampler | null = null;
  private globals: GlobalResources | null = null;

  private cards: Map<string, CardResources> = new Map();
  private cardOrder: string[] = [];

  private viewport = { width: 0, height: 0 };
  private initialized = false;

  constructor(
    gpuContext: WebGPUContext,
    shaderLibrary: ShaderLibrary,
    options: CarouselRendererOptions = {}
  ) {
    this.gpuContext = gpuContext;
    this.shaderLibrary = shaderLibrary;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  initialize(): boolean {
    if (!this.gpuContext.isAvailable || !this.gpuContext.device) {
      return false;
    }

    if (this.initialized) {
      return true;
    }

    this.registerShaders();
    this.createPipeline();
    this.createGeometry();
    this.createSampler();
    this.createGlobals();
    this.initialized = true;
    return true;
  }

  setViewport(width: number, height: number): void {
    if (!this.globals || !this.gpuContext.device) return;
    if (width <= 0 || height <= 0) return;
    this.viewport.width = width;
    this.viewport.height = height;

    const viewProj = this.computeViewProjection(width, height);
    this.gpuContext.device.queue.writeBuffer(
      this.globals.uniformBuffer,
      0,
      viewProj.buffer as ArrayBuffer,
      viewProj.byteOffset,
      viewProj.byteLength
    );
  }

  setCards(textures: CarouselCardTexture[]): void {
    if (!this.initialized || !this.gpuContext.device) return;

    this.clearCards();

    for (const card of textures) {
      const texture = this.createTexture(card);
      const uniformBuffer = this.gpuContext.device.createBuffer({
        label: `Carousel Card Uniform (${card.id})`,
        size: 96, // 16 * f32 (model) + 4 * f32 (bend/opacity/pad)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const bindGroup = this.gpuContext.device.createBindGroup({
        label: `Carousel Card Bind Group (${card.id})`,
        layout: this.pipeline!.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: this.sampler! },
          { binding: 2, resource: texture.createView() },
        ],
      });

      this.cards.set(card.id, {
        uniformBuffer,
        bindGroup,
        texture,
        textureSize: { width: card.width, height: card.height },
      });
    }
  }

  updateCards(states: CarouselCardState[]): void {
    if (!this.initialized || !this.gpuContext.device) return;

    this.cardOrder = [];

    for (const state of states) {
      const resources = this.cards.get(state.id);
      if (!resources) continue;

      const model = this.composeModelMatrix(state);
      const bend = state.bend;
      const opacity = state.opacity ?? 1;

      const data = new Float32Array(20);
      data.set(model, 0);
      data[16] = bend;
      data[17] = opacity;

      this.gpuContext.device.queue.writeBuffer(
        resources.uniformBuffer,
        0,
        data.buffer as ArrayBuffer,
        data.byteOffset,
        data.byteLength
      );

      this.cardOrder.push(state.id);
    }
  }

  render(clearColor: GPUColor = [0, 0, 0, 0]): void {
    if (!this.initialized || !this.pipeline || !this.gpuContext.device) return;
    if (!this.gpuContext.context) return;
    if (!this.globals || !this.vertexBuffer || !this.indexBuffer) return;

    const encoder = this.gpuContext.device.createCommandEncoder();
    const textureView = this.gpuContext.context.getCurrentTexture().createView();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: clearColor,
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    pass.setPipeline(this.pipeline);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setIndexBuffer(this.indexBuffer, 'uint16');
    pass.setBindGroup(0, this.globals.bindGroup);

    for (const cardId of this.cardOrder) {
      const resources = this.cards.get(cardId);
      if (!resources) continue;
      pass.setBindGroup(1, resources.bindGroup);
      pass.drawIndexed(this.vertexCount);
    }

    pass.end();
    this.gpuContext.device.queue.submit([encoder.finish()]);
  }

  destroy(): void {
    this.clearCards();
    this.vertexBuffer?.destroy();
    this.vertexBuffer = null;
    this.indexBuffer?.destroy();
    this.indexBuffer = null;
    this.pipeline = null;
    this.sampler = null;
    if (this.globals) {
      this.globals.uniformBuffer.destroy();
      this.globals = null;
    }
    this.initialized = false;
  }

  private clearCards(): void {
    for (const card of this.cards.values()) {
      card.uniformBuffer.destroy();
      card.texture.destroy();
    }
    this.cards.clear();
    this.cardOrder = [];
  }

  private createTexture(card: CarouselCardTexture): GPUTexture {
    const device = this.gpuContext.device!;
    const texture = device.createTexture({
      label: `Carousel Card Texture (${card.id})`,
      size: [card.width, card.height],
      format: this.gpuContext.format!,
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    device.queue.copyExternalImageToTexture(
      { source: card.source as GPUCopyExternalImageSource },
      { texture },
      [card.width, card.height]
    );

    return texture;
  }

  private registerShaders(): void {
    if (this.shaderLibrary.has('carousel_vertex')) return;

    this.shaderLibrary.register('carousel_vertex', {
      code: `
        struct Globals {
          viewProj: mat4x4<f32>,
        };

        struct CardUniforms {
          model: mat4x4<f32>,
          bend: f32,
          opacity: f32,
          _pad0: f32,
          _pad1: f32,
        };

        @group(0) @binding(0) var<uniform> globals: Globals;
        @group(1) @binding(0) var<uniform> card: CardUniforms;

        struct VertexInput {
          @location(0) position: vec2f,
          @location(1) uv: vec2f,
        };

        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) uv: vec2f,
          @location(1) bendFactor: f32,
        };

        const PI: f32 = 3.14159265;

        @vertex
        fn main(input: VertexInput) -> VertexOutput {
          var output: VertexOutput;
          
          // Input x is -0.5 to 0.5
          let x = input.position.x;
          
          // Bend amount - range typically -1 to 1
          let b = card.bend;
          let absB = abs(b);
          let signB = sign(b);
          
          // Directional curl: leading edge lifts based on scroll direction
          // Soft quadratic falloff from leading to trailing edge
          let leadingT = clamp((-x * signB + 0.5), 0.0, 1.0); // 1 at leading edge, 0 at trailing
          
          // Curl the leading edge forward with smooth falloff
          let curlAmount = leadingT * leadingT * absB;
          let curlZ = curlAmount * 120.0 * signB; // Forward lift
          
          // Y lift for paper curl feel
          let liftY = curlAmount * 0.03;
          
          var local = vec3f(
            x,
            input.position.y + liftY,
            curlZ
          );
          
          let world = card.model * vec4f(local, 1.0);
          output.position = globals.viewProj * world;
          output.uv = input.uv;
          output.bendFactor = absB * leadingT;
          
          return output;
        }
      `,
      entryPoints: { vertex: 'main' },
    });

    this.shaderLibrary.register('carousel_fragment', {
      code: `
        struct CardUniforms {
          model: mat4x4<f32>,
          bend: f32,
          opacity: f32,
          _pad0: f32,
          _pad1: f32,
        };

        @group(1) @binding(0) var<uniform> card: CardUniforms;
        @group(1) @binding(1) var cardSampler: sampler;
        @group(1) @binding(2) var cardTexture: texture_2d<f32>;

        @fragment
        fn main(@location(0) uv: vec2f, @location(1) bendFactor: f32) -> @location(0) vec4f {
          let tex = textureSample(cardTexture, cardSampler, uv);
          
          // Shading: highlight on lifted edge, shadow on trailing
          let shading = 1.0 + bendFactor * 0.2 - (1.0 - bendFactor) * abs(card.bend) * 0.1;
          
          return vec4f(tex.rgb * shading, tex.a * card.opacity);
        }
      `,
      entryPoints: { fragment: 'main' },
    });
  }

  private createPipeline(): void {
    const device = this.gpuContext.device!;
    const format = this.gpuContext.format!;
    const vertexShader = this.shaderLibrary.get('carousel_vertex');
    const fragmentShader = this.shaderLibrary.get('carousel_fragment');
    if (!vertexShader || !fragmentShader) {
      throw new Error('Carousel shaders not available');
    }

    const bindGroupLayouts = [
      device.createBindGroupLayout({
        label: 'Carousel Globals Layout',
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: 'uniform' },
          },
        ],
      }),
      device.createBindGroupLayout({
        label: 'Carousel Card Layout',
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
      }),
    ];

    this.pipeline = device.createRenderPipeline({
      label: 'Carousel Pipeline',
      layout: device.createPipelineLayout({
        bindGroupLayouts,
      }),
      vertex: {
        module: vertexShader.module,
        entryPoint: vertexShader.entryPoints.vertex,
        buffers: [
          {
            arrayStride: 16,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x2' },
            ],
          },
        ],
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
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  private vertexCount = 0;

  private createGeometry(): void {
    const device = this.gpuContext.device!;
    
    // Subdivide the quad into a grid for proper bend deformation
    const segmentsX = 32;
    const segmentsY = 16;
    const vertices: number[] = [];
    const indices: number[] = [];
    
    // Generate vertices
    for (let iy = 0; iy <= segmentsY; iy++) {
      for (let ix = 0; ix <= segmentsX; ix++) {
        const u = ix / segmentsX;
        const v = iy / segmentsY;
        const x = u - 0.5;
        const y = 0.5 - v;
        vertices.push(x, y, u, v);
      }
    }
    
    // Generate indices for triangles
    for (let iy = 0; iy < segmentsY; iy++) {
      for (let ix = 0; ix < segmentsX; ix++) {
        const a = iy * (segmentsX + 1) + ix;
        const b = a + 1;
        const c = a + (segmentsX + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    
    this.vertexCount = indices.length;
    
    const vertexData = new Float32Array(vertices);
    this.vertexBuffer = device.createBuffer({
      label: 'Carousel Quad Vertex Buffer',
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertexData);
    this.vertexBuffer.unmap();
    
    const indexData = new Uint16Array(indices);
    this.indexBuffer = device.createBuffer({
      label: 'Carousel Quad Index Buffer',
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint16Array(this.indexBuffer.getMappedRange()).set(indexData);
    this.indexBuffer.unmap();
  }

  private createSampler(): void {
    const device = this.gpuContext.device!;
    this.sampler = device.createSampler({
      label: 'Carousel Sampler',
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });
  }

  private createGlobals(): void {
    const device = this.gpuContext.device!;
    const uniformBuffer = device.createBuffer({
      label: 'Carousel Globals Uniform Buffer',
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
      label: 'Carousel Globals Bind Group',
      layout: this.pipeline!.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    this.globals = { uniformBuffer, bindGroup };
  }

  private computeViewProjection(width: number, height: number): Float32Array {
    const cameraZ = this.options.cameraZ;
    const fov = 2 * Math.atan((height * 0.5) / cameraZ);
    const aspect = width / height;
    const projection = this.perspective(fov, aspect, this.options.near, this.options.far);
    const view = this.lookAt(
      [0, 0, cameraZ],
      [0, 0, 0],
      [0, 1, 0]
    );
    return this.multiply(projection, view);
  }

  private composeModelMatrix(state: CarouselCardState): Float32Array {
    const translation = this.translate(state.x, state.y, state.z);
    const rotation = this.rotateY(state.rotationY);
    const scale = this.scale(state.width, state.height, 1);
    return this.multiply(translation, this.multiply(rotation, scale));
  }

  private perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
    const f = 1 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, (2 * far * near) * nf, 0,
    ]);
  }

  private lookAt(eye: number[], center: number[], up: number[]): Float32Array {
    const [ex, ey, ez] = eye;
    const [cx, cy, cz] = center;
    const [ux, uy, uz] = up;

    let zx = ex - cx;
    let zy = ey - cy;
    let zz = ez - cz;
    let len = Math.hypot(zx, zy, zz);
    zx /= len;
    zy /= len;
    zz /= len;

    let xx = uy * zz - uz * zy;
    let xy = uz * zx - ux * zz;
    let xz = ux * zy - uy * zx;
    len = Math.hypot(xx, xy, xz);
    xx /= len;
    xy /= len;
    xz /= len;

    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    return new Float32Array([
      xx, yx, zx, 0,
      xy, yy, zy, 0,
      xz, yz, zz, 0,
      -(xx * ex + xy * ey + xz * ez),
      -(yx * ex + yy * ey + yz * ez),
      -(zx * ex + zy * ey + zz * ez),
      1,
    ]);
  }

  private translate(x: number, y: number, z: number): Float32Array {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      x, y, z, 1,
    ]);
  }

  private rotateY(angle: number): Float32Array {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([
      c, 0, s, 0,
      0, 1, 0, 0,
      -s, 0, c, 0,
      0, 0, 0, 1,
    ]);
  }

  private scale(x: number, y: number, z: number): Float32Array {
    return new Float32Array([
      x, 0, 0, 0,
      0, y, 0, 0,
      0, 0, z, 0,
      0, 0, 0, 1,
    ]);
  }

  private multiply(a: Float32Array, b: Float32Array): Float32Array {
    const out = new Float32Array(16);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    const b00 = b[0], b01 = b[1], b02 = b[2], b03 = b[3];
    const b10 = b[4], b11 = b[5], b12 = b[6], b13 = b[7];
    const b20 = b[8], b21 = b[9], b22 = b[10], b23 = b[11];
    const b30 = b[12], b31 = b[13], b32 = b[14], b33 = b[15];

    out[0] = a00 * b00 + a10 * b01 + a20 * b02 + a30 * b03;
    out[1] = a01 * b00 + a11 * b01 + a21 * b02 + a31 * b03;
    out[2] = a02 * b00 + a12 * b01 + a22 * b02 + a32 * b03;
    out[3] = a03 * b00 + a13 * b01 + a23 * b02 + a33 * b03;

    out[4] = a00 * b10 + a10 * b11 + a20 * b12 + a30 * b13;
    out[5] = a01 * b10 + a11 * b11 + a21 * b12 + a31 * b13;
    out[6] = a02 * b10 + a12 * b11 + a22 * b12 + a32 * b13;
    out[7] = a03 * b10 + a13 * b11 + a23 * b12 + a33 * b13;

    out[8] = a00 * b20 + a10 * b21 + a20 * b22 + a30 * b23;
    out[9] = a01 * b20 + a11 * b21 + a21 * b22 + a31 * b23;
    out[10] = a02 * b20 + a12 * b21 + a22 * b22 + a32 * b23;
    out[11] = a03 * b20 + a13 * b21 + a23 * b22 + a33 * b23;

    out[12] = a00 * b30 + a10 * b31 + a20 * b32 + a30 * b33;
    out[13] = a01 * b30 + a11 * b31 + a21 * b32 + a31 * b33;
    out[14] = a02 * b30 + a12 * b31 + a22 * b32 + a32 * b33;
    out[15] = a03 * b30 + a13 * b31 + a23 * b32 + a33 * b33;

    return out;
  }
}
