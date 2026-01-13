/**
 * EffectStack
 *
 * Manages an ordered stack of post-processing effects.
 * Provides high-level API for adding, removing, enabling/disabling effects.
 */

/// <reference types="@webgpu/types" />

import type { ScreenPass } from '@scene/renderer';

/**
 * Base interface for all screen effects
 */
export interface Effect {
  /** Unique identifier for this effect instance */
  readonly id: string;
  /** Effect type name (e.g., 'blur', 'vignette') */
  readonly type: string;
  /** Whether the effect is currently enabled */
  enabled: boolean;
  /** Internal effect handle from ScreenPass */
  readonly effectHandle: string;
  /** Update effect uniforms */
  update(params: Record<string, number>): void;
  /** Get current uniform data */
  getUniformData(): Float32Array;
}

/**
 * Configuration for creating an effect
 */
export interface EffectConfig {
  type: string;
  enabled?: boolean;
  params?: Record<string, number>;
}

/**
 * Effect factory function type
 */
export type EffectFactory = (
  id: string,
  screenPass: ScreenPass,
  params?: Record<string, number>
) => Effect;

/**
 * EffectStack manages the post-processing pipeline.
 * Effects are applied in order from first to last.
 */
export class EffectStack {
  private screenPass: ScreenPass;
  private effects: Map<string, Effect>;
  private order: string[];
  private factories: Map<string, EffectFactory>;
  private intermediateTextures: GPUTexture[];
  private textureSize: { width: number; height: number };
  private effectIdCounter: number;
  private initialized: boolean;
  private passthroughEffectHandle: string | null;

  constructor(screenPass: ScreenPass) {
    this.screenPass = screenPass;
    this.effects = new Map();
    this.order = [];
    this.factories = new Map();
    this.intermediateTextures = [];
    this.textureSize = { width: 0, height: 0 };
    this.effectIdCounter = 0;
    this.initialized = false;
    this.passthroughEffectHandle = null;
  }

  /**
   * Initialize the effect stack
   */
  initialize(): boolean {
    if (!this.screenPass.isInitialized) {
      console.warn('EffectStack: ScreenPass not initialized');
      return false;
    }

    // Create passthrough effect for when all effects are disabled
    try {
      this.passthroughEffectHandle = this.screenPass.createEffect({
        shaderName: 'copy_fragment',
      });
    } catch (error: unknown) {
      console.warn('EffectStack: Failed to create passthrough effect:', error);
      return false;
    }

    this.initialized = true;
    return true;
  }

  /**
   * Register an effect factory for a given effect type
   */
  registerFactory(type: string, factory: EffectFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * Create and add an effect to the stack
   */
  add(config: EffectConfig): Effect | null {
    if (!this.initialized) {
      console.warn('EffectStack: Not initialized');
      return null;
    }

    const factory: EffectFactory | undefined = this.factories.get(config.type);
    if (!factory) {
      console.warn(`EffectStack: Unknown effect type '${config.type}'`);
      return null;
    }

    const id: string = `${config.type}_${++this.effectIdCounter}`;
    const effect: Effect = factory(id, this.screenPass, config.params);
    effect.enabled = config.enabled ?? true;

    this.effects.set(id, effect);
    this.order.push(id);

    return effect;
  }

  /**
   * Remove an effect from the stack
   */
  remove(id: string): boolean {
    const effect: Effect | undefined = this.effects.get(id);
    if (!effect) {
      return false;
    }

    this.screenPass.removeEffect(effect.effectHandle);
    this.effects.delete(id);
    this.order = this.order.filter((eid: string) => eid !== id);

    return true;
  }

  /**
   * Get an effect by ID
   */
  get(id: string): Effect | undefined {
    return this.effects.get(id);
  }

  /**
   * Get all effects in order
   */
  getAll(): Effect[] {
    return this.order.map((id: string) => this.effects.get(id)!);
  }

  /**
   * Get only enabled effects in order
   */
  getEnabled(): Effect[] {
    return this.order
      .map((id: string) => this.effects.get(id)!)
      .filter((effect: Effect) => effect.enabled);
  }

  /**
   * Move an effect to a new position in the stack
   */
  reorder(id: string, newIndex: number): boolean {
    const currentIndex: number = this.order.indexOf(id);
    if (currentIndex === -1) {
      return false;
    }

    this.order.splice(currentIndex, 1);
    this.order.splice(Math.max(0, Math.min(newIndex, this.order.length)), 0, id);

    return true;
  }

  /**
   * Enable an effect
   */
  enable(id: string): boolean {
    const effect: Effect | undefined = this.effects.get(id);
    if (!effect) {
      return false;
    }
    effect.enabled = true;
    return true;
  }

  /**
   * Disable an effect
   */
  disable(id: string): boolean {
    const effect: Effect | undefined = this.effects.get(id);
    if (!effect) {
      return false;
    }
    effect.enabled = false;
    return true;
  }

  /**
   * Toggle an effect's enabled state
   */
  toggle(id: string): boolean {
    const effect: Effect | undefined = this.effects.get(id);
    if (!effect) {
      return false;
    }
    effect.enabled = !effect.enabled;
    return effect.enabled;
  }

  /**
   * Update effect parameters
   */
  updateEffect(id: string, params: Record<string, number>): boolean {
    const effect: Effect | undefined = this.effects.get(id);
    if (!effect) {
      return false;
    }
    effect.update(params);
    return true;
  }

  /**
   * Ensure intermediate textures are properly sized
   */
  ensureTextures(width: number, height: number): void {
    if (this.textureSize.width === width && this.textureSize.height === height) {
      return;
    }

    // Destroy old textures
    for (const texture of this.intermediateTextures) {
      texture.destroy();
    }
    this.intermediateTextures = [];

    // Create new textures (2 for ping-pong rendering)
    this.intermediateTextures.push(
      this.screenPass.createIntermediateTexture(width, height),
      this.screenPass.createIntermediateTexture(width, height)
    );

    this.textureSize = { width, height };
  }

  /**
   * Execute all enabled effects
   */
  execute(
    commandEncoder: GPUCommandEncoder,
    sourceTexture: GPUTexture,
    finalTarget?: GPUTexture
  ): void {
    if (!this.initialized) {
      return;
    }

    const enabledEffects: Effect[] = this.getEnabled();

    // When no effects are enabled, pass through source to target unchanged
    if (enabledEffects.length === 0) {
      if (this.passthroughEffectHandle) {
        this.screenPass.execute(
          commandEncoder,
          this.passthroughEffectHandle,
          sourceTexture,
          finalTarget
        );
      }
      return;
    }

    // Ensure we have intermediate textures
    const { width, height } = sourceTexture;
    this.ensureTextures(width, height);

    // Get effect handles
    const effectHandles: string[] = enabledEffects.map((e: Effect) => e.effectHandle);

    // Execute through ScreenPass
    this.screenPass.executeStack(
      commandEncoder,
      effectHandles,
      sourceTexture,
      this.intermediateTextures,
      finalTarget
    );
  }

  /**
   * Clear all effects
   */
  clear(): void {
    for (const id of this.order) {
      const effect: Effect | undefined = this.effects.get(id);
      if (effect) {
        this.screenPass.removeEffect(effect.effectHandle);
      }
    }
    this.effects.clear();
    this.order = [];
  }

  /**
   * Get the number of effects in the stack
   */
  get count(): number {
    return this.effects.size;
  }

  /**
   * Get the number of enabled effects
   */
  get enabledCount(): number {
    return this.getEnabled().length;
  }

  /**
   * Check if initialized
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Destroy the effect stack and release resources
   */
  destroy(): void {
    this.clear();

    // Clean up passthrough effect
    if (this.passthroughEffectHandle) {
      this.screenPass.removeEffect(this.passthroughEffectHandle);
      this.passthroughEffectHandle = null;
    }

    for (const texture of this.intermediateTextures) {
      texture.destroy();
    }
    this.intermediateTextures = [];
    this.textureSize = { width: 0, height: 0 };

    this.initialized = false;
  }
}
