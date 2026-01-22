/**
 * MotionBlurEffect
 *
 * Velocity-based motion blur post-processing effect.
 * Simulates camera or object motion blur.
 */

/// <reference types="@webgpu/types" />

import type { ScreenPass } from '@scene/renderer';
import { BaseEffect } from './BaseEffect';

export interface MotionBlurParams {
  /** Velocity X direction (-1 to 1) */
  velocityX: number;
  /** Velocity Y direction (-1 to 1) */
  velocityY: number;
  /** Blur strength multiplier (default: 50) */
  strength: number;
  /** Number of blur samples (default: 16) */
  samples: number;
}

const DEFAULT_MOTION_BLUR_PARAMS: MotionBlurParams = {
  velocityX: 0,
  velocityY: 0,
  strength: 50,
  samples: 16,
};

export class MotionBlurEffect extends BaseEffect {
  readonly type: string = 'motion_blur';

  constructor(
    id: string,
    screenPass: ScreenPass,
    params?: Partial<MotionBlurParams>
  ) {
    super(
      id,
      screenPass,
      'motion_blur_fragment',
      4, // vec2 velocity + f32 strength + f32 samples
      { ...DEFAULT_MOTION_BLUR_PARAMS, ...params }
    );
  }

  protected syncUniformData(): void {
    this.uniformData[0] = this.params.velocityX;
    this.uniformData[1] = this.params.velocityY;
    this.uniformData[2] = this.params.strength;
    this.uniformData[3] = this.params.samples;
  }

  /**
   * Set the motion velocity
   */
  setVelocity(x: number, y: number): void {
    this.update({ velocityX: x, velocityY: y });
  }

  /**
   * Set the blur strength
   */
  setStrength(strength: number): void {
    this.update({ strength });
  }

  /**
   * Set the number of samples (higher = smoother but slower)
   */
  setSamples(samples: number): void {
    this.update({ samples: Math.max(2, Math.min(64, samples)) });
  }

  /**
   * Configure for horizontal motion blur
   */
  horizontal(amount: number = 1): void {
    this.setVelocity(amount, 0);
  }

  /**
   * Configure for vertical motion blur
   */
  vertical(amount: number = 1): void {
    this.setVelocity(0, amount);
  }

  /**
   * Configure for radial zoom blur (zoom in effect)
   * Note: This is an approximation using directional blur
   */
  radial(amount: number = 1): void {
    this.setVelocity(amount * 0.707, amount * 0.707);
  }

  /**
   * Clear motion blur
   */
  clear(): void {
    this.setVelocity(0, 0);
  }
}

/**
 * Factory function for creating motion blur effects
 */
export function createMotionBlurEffect(
  id: string,
  screenPass: ScreenPass,
  params?: Record<string, number>
): MotionBlurEffect {
  return new MotionBlurEffect(id, screenPass, params as Partial<MotionBlurParams>);
}
