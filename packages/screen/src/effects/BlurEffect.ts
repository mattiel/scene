/**
 * BlurEffect
 *
 * Gaussian blur post-processing effect.
 * Supports directional blur with configurable strength.
 */

/// <reference types="@webgpu/types" />

import type { ScreenPass } from '@scene/renderer';
import { BaseEffect } from './BaseEffect';

export interface BlurParams {
  /** Blur direction X (0-1, typically 1 or 0) */
  directionX: number;
  /** Blur direction Y (0-1, typically 1 or 0) */
  directionY: number;
  /** Blur strength/radius */
  strength: number;
}

const DEFAULT_BLUR_PARAMS: BlurParams = {
  directionX: 1.0,
  directionY: 0.0,
  strength: 2.0,
};

export class BlurEffect extends BaseEffect {
  readonly type: string = 'blur';

  constructor(
    id: string,
    screenPass: ScreenPass,
    params?: Partial<BlurParams>
  ) {
    super(
      id,
      screenPass,
      'blur_fragment',
      4, // vec2 direction + f32 strength + f32 padding
      { ...DEFAULT_BLUR_PARAMS, ...params }
    );
  }

  protected syncUniformData(): void {
    // Layout: vec2 direction, f32 strength, f32 padding
    this.uniformData[0] = this.params.directionX;
    this.uniformData[1] = this.params.directionY;
    this.uniformData[2] = this.params.strength;
    this.uniformData[3] = 0; // padding
  }

  /**
   * Set blur direction
   */
  setDirection(x: number, y: number): void {
    this.update({ directionX: x, directionY: y });
  }

  /**
   * Set blur strength
   */
  setStrength(strength: number): void {
    this.update({ strength });
  }

  /**
   * Configure for horizontal blur
   */
  horizontal(): void {
    this.setDirection(1.0, 0.0);
  }

  /**
   * Configure for vertical blur
   */
  vertical(): void {
    this.setDirection(0.0, 1.0);
  }
}

/**
 * Factory function for creating blur effects
 */
export function createBlurEffect(
  id: string,
  screenPass: ScreenPass,
  params?: Record<string, number>
): BlurEffect {
  return new BlurEffect(id, screenPass, params as Partial<BlurParams>);
}
