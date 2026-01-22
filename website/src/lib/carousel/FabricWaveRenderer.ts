/**
 * FabricWaveRenderer - Multi-card renderer with fabric wave effects
 * 
 * Renders multiple textured cards with shared global uniforms
 * and per-card materials for the fabric wave effect.
 */

/// <reference types="@webgpu/types" />

import {
  type WebGPUContext,
  Camera,
  PlaneGeometry,
  GlobalUniformManager,
  multiply,
  translate,
  rotateY,
  scale,
} from '@scene/renderer';
import { FabricWaveMaterial, GLOBAL_UNIFORM_SCHEMA } from './FabricWaveMaterial';

// ============================================
// Types
// ============================================

export interface FabricCardTexture {
  id: string;
  width: number;
  height: number;
  source: CanvasImageSource;
}

export interface FabricCardState {
  id: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  width: number;
  height: number;
  opacity?: number;
  rippleOrigin?: { x: number; y: number };
  rippleProgress?: number;
  collapseProgress?: number;
}

export interface FabricGlobalState {
  globalBend?: number;
  wavePhaseOffset?: number;
  scrollRipplePhase?: number;
  scrollRippleIntensity?: number;
  scrollRippleDirection?: number;
}

export interface FabricWaveRendererConfig {
  cameraZ?: number;
  near?: number;
  far?: number;
  segments?: number;
}

// ============================================
// Renderer
// ============================================

export class FabricWaveRenderer {
  private gpuContext: WebGPUContext;
  private camera: Camera;
  private viewport = { width: 0, height: 0 };
  private config: Required<FabricWaveRendererConfig>;
  
  // Uses library GlobalUniformManager
  private globalUniforms: GlobalUniformManager | null = null;
  private geometry: PlaneGeometry | null = null;
  
  // Per-card resources
  private cards = new Map<string, { texture: GPUTexture; material: FabricWaveMaterial }>();
  private cardOrder: string[] = [];
  private initialized = false;

  constructor(gpuContext: WebGPUContext, config: FabricWaveRendererConfig = {}) {
    this.gpuContext = gpuContext;
    this.config = {
      cameraZ: config.cameraZ ?? 1200,
      near: config.near ?? 0.1,
      far: config.far ?? 4000,
      segments: config.segments ?? 32,
    };
    this.camera = new Camera({
      position: [0, 0, this.config.cameraZ],
      near: this.config.near,
      far: this.config.far,
    });
  }

  async initialize(): Promise<boolean> {
    if (!this.gpuContext.isAvailable || !this.gpuContext.device) return false;
    if (this.initialized) return true;

    // Create global uniforms using library infrastructure
    this.globalUniforms = new GlobalUniformManager(
      this.gpuContext.device,
      GLOBAL_UNIFORM_SCHEMA,
      'FabricWave_Globals'
    );

    this.initialized = true;
    return true;
  }

  setViewport(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.viewport = { width, height };
    this.camera.fov = 2 * Math.atan(height / 2 / this.config.cameraZ);
    this.updateGlobalUniforms();
  }

  setGlobalState(state: FabricGlobalState): void {
    if (!this.globalUniforms) return;
    if (state.globalBend !== undefined) this.globalUniforms.set('globalBend', state.globalBend);
    if (state.wavePhaseOffset !== undefined) this.globalUniforms.set('wavePhaseOffset', state.wavePhaseOffset);
    if (state.scrollRipplePhase !== undefined) this.globalUniforms.set('scrollRipplePhase', state.scrollRipplePhase);
    if (state.scrollRippleIntensity !== undefined) this.globalUniforms.set('scrollRippleIntensity', state.scrollRippleIntensity);
    if (state.scrollRippleDirection !== undefined) this.globalUniforms.set('scrollRippleDirection', state.scrollRippleDirection);
    this.globalUniforms.upload();
  }

  async setCards(textures: FabricCardTexture[]): Promise<void> {
    if (!this.initialized || !this.gpuContext.device || !this.globalUniforms) return;
    this.clearCards();

    const device = this.gpuContext.device;
    const format = this.gpuContext.format ?? 'bgra8unorm';

    for (const card of textures) {
      const texture = device.createTexture({
        label: `card_${card.id}`,
        size: [card.width, card.height],
        format,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      device.queue.copyExternalImageToTexture(
        { source: card.source as GPUCopyExternalImageSource },
        { texture },
        [card.width, card.height]
      );

      // Create material with ShaderMaterial's raw mode
      const material = new FabricWaveMaterial({ name: `card_${card.id}` });
      material.setColorFormat(format);
      // Set external bind group layouts BEFORE init (global uniforms at group 0)
      material.setExternalBindGroupLayouts([this.globalUniforms.getBindGroupLayout()]);
      await material.init(device);
      material.setCardTexture(texture);

      this.cards.set(card.id, { texture, material });
    }
  }

  updateCards(states: FabricCardState[]): void {
    this.cardOrder = [];
    for (const state of states) {
      const card = this.cards.get(state.id);
      if (!card) continue;

      const modelMatrix = multiply(
        translate(state.x, state.y, state.z),
        multiply(rotateY(state.rotationY), scale(state.width, state.height, 1))
      );

      card.material.updateCard(modelMatrix, {
        bend: 0,
        opacity: state.opacity ?? 1,
        rippleOriginX: state.rippleOrigin?.x ?? 0.5,
        rippleOriginY: state.rippleOrigin?.y ?? 0.5,
        rippleProgress: state.rippleProgress ?? 0,
        collapseProgress: state.collapseProgress ?? 0,
        worldX: state.x,
        cardWidth: state.width,
      });

      this.cardOrder.push(state.id);
    }
  }

  /**
   * Update a card's texture (for animated text during expansion)
   */
  updateCardTexture(cardId: string, source: CanvasImageSource): void {
    if (!this.gpuContext.device) return;
    
    const card = this.cards.get(cardId);
    if (!card) return;
    
    const canvas = source as HTMLCanvasElement;
    this.gpuContext.device.queue.copyExternalImageToTexture(
      { source: source as GPUCopyExternalImageSource },
      { texture: card.texture },
      [canvas.width, canvas.height]
    );
  }

  render(clearColor: GPUColor = [0, 0, 0, 0]): void {
    if (!this.initialized || !this.gpuContext.device || !this.gpuContext.context || !this.globalUniforms) return;
    if (this.cardOrder.length === 0) return;

    if (!this.geometry) {
      this.geometry = PlaneGeometry.card(1, 1, this.config.segments);
      this.geometry.init(this.gpuContext.device);
    }

    const device = this.gpuContext.device;
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.gpuContext.context.getCurrentTexture().createView(),
        clearValue: clearColor,
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    let currentPipeline: GPURenderPipeline | null = null;
    const vertexBuffer = this.geometry.getVertexBuffer();
    const indexBuffer = this.geometry.getIndexBuffer();
    if (!vertexBuffer) { pass.end(); return; }

    for (const cardId of this.cardOrder) {
      const card = this.cards.get(cardId);
      if (!card) continue;

      const pipeline = card.material.getPipeline();
      const bindGroup = card.material.getBindGroup();
      if (!pipeline || !bindGroup) continue;

      if (pipeline !== currentPipeline) {
        pass.setPipeline(pipeline);
        currentPipeline = pipeline;
      }

      pass.setBindGroup(0, this.globalUniforms.getBindGroup());
      pass.setBindGroup(1, bindGroup);
      pass.setVertexBuffer(0, vertexBuffer);

      if (indexBuffer && this.geometry.index) {
        pass.setIndexBuffer(indexBuffer, this.geometry.index.array instanceof Uint16Array ? 'uint16' : 'uint32');
        pass.drawIndexed(this.geometry.drawCount);
      } else {
        pass.draw(this.geometry.drawCount);
      }
    }

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  destroy(): void {
    this.clearCards();
    this.globalUniforms?.destroy();
    this.globalUniforms = null;
    this.geometry?.destroy();
    this.geometry = null;
    this.initialized = false;
  }

  private updateGlobalUniforms(): void {
    if (!this.globalUniforms || this.viewport.width <= 0) return;
    const aspect = this.viewport.width / this.viewport.height;
    this.globalUniforms.set('viewProj', this.camera.getViewProjectionMatrix(aspect));
    this.globalUniforms.upload();
  }

  private clearCards(): void {
    for (const card of this.cards.values()) {
      card.texture.destroy();
      card.material.destroy();
    }
    this.cards.clear();
    this.cardOrder = [];
  }
}

export function createFabricWaveRenderer(gpuContext: WebGPUContext, config?: FabricWaveRendererConfig): FabricWaveRenderer {
  return new FabricWaveRenderer(gpuContext, config);
}
