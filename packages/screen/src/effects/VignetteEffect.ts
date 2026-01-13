/**
 * VignetteEffect
 *
 * Darkens the edges of the screen for a cinematic look.
 */

/// <reference types="@webgpu/types" />

import type { ScreenPass } from '@scene/renderer';
import { BaseEffect } from './BaseEffect';

export interface VignetteParams {
  /** Vignette strength (0 = none, 1 = full) */
  strength: number;
  /** Radius from center where vignette starts (0-1) */
  radius: number;
  /** Softness of the vignette edge */
  softness: number;
}

const DEFAULT_VIGNETTE_PARAMS: VignetteParams = {
  strength: 0.5,
  radius: 0.5,
  softness: 0.5,
};

export class VignetteEffect extends BaseEffect {
  readonly type: string = 'vignette';

  constructor(
    id: string,
    screenPass: ScreenPass,
    params?: Partial<VignetteParams>
  ) {
    super(
      id,
      screenPass,
      'vignette_fragment',
      4, // f32 strength + f32 radius + f32 softness + f32 padding
      { ...DEFAULT_VIGNETTE_PARAMS, ...params }
    );
  }

  protected syncUniformData(): void {
    // Layout: f32 strength, f32 radius, f32 softness, f32 padding
    this.uniformData[0] = this.params.strength;
    this.uniformData[1] = this.params.radius;
    this.uniformData[2] = this.params.softness;
    this.uniformData[3] = 0; // padding
  }

  /**
   * Set vignette strength
   */
  setStrength(strength: number): void {
    this.update({ strength: Math.max(0, Math.min(1, strength)) });
  }

  /**
   * Set vignette radius
   */
  setRadius(radius: number): void {
    this.update({ radius: Math.max(0, Math.min(1, radius)) });
  }

  /**
   * Set vignette softness
   */
  setSoftness(softness: number): void {
    this.update({ softness: Math.max(0, Math.min(1, softness)) });
  }

  /**
   * Apply a subtle vignette preset
   */
  subtle(): void {
    this.update({ strength: 0.3, radius: 0.6, softness: 0.4 });
  }

  /**
   * Apply a strong cinematic vignette preset
   */
  cinematic(): void {
    this.update({ strength: 0.7, radius: 0.4, softness: 0.5 });
  }
}

/**
 * Factory function for creating vignette effects
 */
export function createVignetteEffect(
  id: string,
  screenPass: ScreenPass,
  params?: Record<string, number>
): VignetteEffect {
  return new VignetteEffect(id, screenPass, params as Partial<VignetteParams>);
}
