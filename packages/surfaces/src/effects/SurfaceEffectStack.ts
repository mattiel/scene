/**
 * SurfaceEffectStack - Manages a stack of effects for a single surface
 * 
 * Effects are applied in order, with each effect receiving the output
 * of the previous effect as input. Handles texture ping-ponging for
 * efficient multi-pass rendering.
 */

/// <reference types="@webgpu/types" />

import type { Surface, SurfaceRect } from '../Surface';
import type { SurfaceEffect, EffectRenderContext } from './SurfaceEffect';

/** Configuration for SurfaceEffectStack */
export interface SurfaceEffectStackConfig {
  /** Maximum number of effects (for buffer allocation) */
  maxEffects?: number;
}

/**
 * SurfaceEffectStack - Composable effect pipeline per surface
 * 
 * @example
 * ```typescript
 * const stack = new SurfaceEffectStack(surface);
 * 
 * // Add effects in order
 * stack.add(new BlurEffect({ radius: 10 }));
 * stack.add(new GlowEffect({ color: [1, 0.5, 0], intensity: 2 }));
 * 
 * // Render the effect chain
 * stack.render(device, inputTexture, outputTexture);
 * 
 * // Toggle effects
 * stack.setEnabled('blur', false);
 * 
 * // Remove effects
 * stack.remove('glow');
 * ```
 */
export class SurfaceEffectStack {
  readonly surface: Surface;
  
  private effects: SurfaceEffect[] = [];
  private effectsById: Map<string, SurfaceEffect> = new Map();
  private device: GPUDevice | null = null;
  private pingTexture: GPUTexture | null = null;
  private pongTexture: GPUTexture | null = null;
  private currentSize: { width: number; height: number } = { width: 0, height: 0 };
  private startTime: number = 0;
  private lastTime: number = 0;
  private initialized = false;

  constructor(surface: Surface, _config: SurfaceEffectStackConfig = {}) {
    this.surface = surface;
    this.startTime = performance.now() / 1000;
    this.lastTime = this.startTime;
  }

  /**
   * Initialize GPU resources
   */
  async init(device: GPUDevice): Promise<void> {
    if (this.initialized) return;
    
    this.device = device;
    
    // Initialize all effects
    for (const effect of this.effects) {
      if (effect.init) {
        await effect.init(device);
      }
    }
    
    this.initialized = true;
  }

  /**
   * Add an effect to the stack
   * @param effect - The effect to add
   * @param index - Optional index to insert at (default: end)
   */
  async add(effect: SurfaceEffect, index?: number): Promise<this> {
    // Check for duplicate ID
    if (this.effectsById.has(effect.id)) {
      console.warn(`Effect with id '${effect.id}' already exists, replacing`);
      this.remove(effect.id);
    }
    
    // Insert at position
    if (index !== undefined && index >= 0 && index < this.effects.length) {
      this.effects.splice(index, 0, effect);
    } else {
      this.effects.push(effect);
    }
    
    this.effectsById.set(effect.id, effect);
    
    // Initialize if stack is already initialized
    if (this.device && effect.init) {
      await effect.init(this.device);
    }
    
    return this;
  }

  /**
   * Remove an effect by ID
   */
  remove(id: string): boolean {
    const effect = this.effectsById.get(id);
    if (!effect) return false;
    
    // Remove from array
    const index = this.effects.indexOf(effect);
    if (index !== -1) {
      this.effects.splice(index, 1);
    }
    
    // Remove from map
    this.effectsById.delete(id);
    
    // Clean up effect
    if (effect.destroy) {
      effect.destroy();
    }
    
    return true;
  }

  /**
   * Get an effect by ID
   */
  get(id: string): SurfaceEffect | undefined {
    return this.effectsById.get(id);
  }

  /**
   * Check if effect exists
   */
  has(id: string): boolean {
    return this.effectsById.has(id);
  }

  /**
   * Set effect enabled state
   */
  setEnabled(id: string, enabled: boolean): boolean {
    const effect = this.effectsById.get(id);
    if (!effect) return false;
    effect.enabled = enabled;
    return true;
  }

  /**
   * Set effect intensity
   */
  setIntensity(id: string, intensity: number): boolean {
    const effect = this.effectsById.get(id);
    if (!effect) return false;
    effect.intensity = Math.max(0, Math.min(1, intensity));
    return true;
  }

  /**
   * Move effect to new position
   */
  reorder(id: string, newIndex: number): boolean {
    const effect = this.effectsById.get(id);
    if (!effect) return false;
    
    const currentIndex = this.effects.indexOf(effect);
    if (currentIndex === -1) return false;
    
    // Remove from current position
    this.effects.splice(currentIndex, 1);
    
    // Insert at new position
    const clampedIndex = Math.max(0, Math.min(this.effects.length, newIndex));
    this.effects.splice(clampedIndex, 0, effect);
    
    return true;
  }

  /**
   * Get all effect IDs in order
   */
  getEffectIds(): string[] {
    return this.effects.map(e => e.id);
  }

  /**
   * Get number of effects
   */
  get count(): number {
    return this.effects.length;
  }

  /**
   * Get number of enabled effects
   */
  get enabledCount(): number {
    return this.effects.filter(e => e.enabled && e.intensity > 0).length;
  }

  /**
   * Check if any effects are enabled
   */
  get hasEnabledEffects(): boolean {
    return this.enabledCount > 0;
  }

  /**
   * Ensure intermediate textures are the right size
   */
  private ensureTextures(width: number, height: number): void {
    if (!this.device) return;
    
    // Only recreate if size changed
    if (this.currentSize.width === width && this.currentSize.height === height) {
      return;
    }
    
    // Destroy old textures
    this.pingTexture?.destroy();
    this.pongTexture?.destroy();
    
    // Create new textures
    const descriptor: GPUTextureDescriptor = {
      size: [width, height, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
    };
    
    this.pingTexture = this.device.createTexture(descriptor);
    this.pongTexture = this.device.createTexture(descriptor);
    
    this.currentSize = { width, height };
  }

  /**
   * Render all effects in the stack
   * 
   * @param inputTexture - Source texture (surface content)
   * @param outputTexture - Final output texture
   * @param rect - Surface rect for resolution uniforms
   */
  render(inputTexture: GPUTexture, outputTexture: GPUTexture, rect?: SurfaceRect): void {
    if (!this.device || !this.initialized) return;
    
    const activeEffects = this.effects.filter(e => e.enabled && e.intensity > 0);
    if (activeEffects.length === 0) {
      // No effects - just copy input to output (or skip if same texture)
      if (inputTexture !== outputTexture) {
        this.copyTexture(inputTexture, outputTexture);
      }
      return;
    }
    
    // Calculate timing
    const currentTime = performance.now() / 1000;
    const time = currentTime - this.startTime;
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    
    // Update effects
    for (const effect of activeEffects) {
      if (effect.update) {
        effect.update(time, deltaTime);
      }
    }
    
    // Get rect from surface or use texture dimensions
    const effectRect = rect ?? this.surface.rect;
    const width = effectRect.width || inputTexture.width;
    const height = effectRect.height || inputTexture.height;
    
    // Ensure intermediate textures
    if (activeEffects.length > 1) {
      this.ensureTextures(width, height);
    }
    
    // Render effect chain
    let currentInput = inputTexture;
    
    for (let i = 0; i < activeEffects.length; i++) {
      const effect = activeEffects[i];
      const isLast = i === activeEffects.length - 1;
      
      // Determine output texture
      const currentOutput = isLast 
        ? outputTexture 
        : (i % 2 === 0 ? this.pingTexture! : this.pongTexture!);
      
      // Create render context
      const ctx: EffectRenderContext = {
        device: this.device,
        surface: this.surface,
        rect: effectRect,
        inputTexture: currentInput,
        outputTexture: currentOutput,
        time,
        deltaTime,
      };
      
      // Apply effect
      effect.apply(ctx);
      
      // Swap for next iteration
      currentInput = currentOutput;
    }
  }

  /**
   * Copy texture contents
   */
  private copyTexture(src: GPUTexture, dst: GPUTexture): void {
    if (!this.device) return;
    
    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyTextureToTexture(
      { texture: src },
      { texture: dst },
      [src.width, src.height, 1]
    );
    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Clear all effects
   */
  clear(): void {
    for (const effect of this.effects) {
      if (effect.destroy) {
        effect.destroy();
      }
    }
    this.effects = [];
    this.effectsById.clear();
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.clear();
    this.pingTexture?.destroy();
    this.pongTexture?.destroy();
    this.pingTexture = null;
    this.pongTexture = null;
    this.device = null;
    this.initialized = false;
  }
}
