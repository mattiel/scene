/**
 * FilmGrainEffect
 *
 * Adds cinematic film grain noise to the image.
 * Supports both monochrome and colored grain with luminance-based response.
 */

/// <reference types="@webgpu/types" />

import type { ScreenPass } from '@scene/renderer';
import { BaseEffect } from './BaseEffect';

export interface FilmGrainParams {
  /** Grain intensity (0-1, default: 0.1) */
  intensity: number;
  /** Animation time seed - update each frame for animated grain */
  time: number;
  /** Luminance response - how much grain varies with brightness (0-1, default: 0.5) */
  luminanceResponse: number;
  /** Whether to use colored grain (1) or monochrome (0) */
  coloredGrain: number;
}

const DEFAULT_FILM_GRAIN_PARAMS: FilmGrainParams = {
  intensity: 0.1,
  time: 0,
  luminanceResponse: 0.5,
  coloredGrain: 0,
};

export class FilmGrainEffect extends BaseEffect {
  readonly type: string = 'film_grain';

  constructor(
    id: string,
    screenPass: ScreenPass,
    params?: Partial<FilmGrainParams>
  ) {
    super(
      id,
      screenPass,
      'film_grain_fragment',
      4, // f32 intensity + f32 time + f32 luminanceResponse + f32 coloredGrain
      { ...DEFAULT_FILM_GRAIN_PARAMS, ...params }
    );
  }

  protected syncUniformData(): void {
    this.uniformData[0] = this.params.intensity;
    this.uniformData[1] = this.params.time;
    this.uniformData[2] = this.params.luminanceResponse;
    this.uniformData[3] = this.params.coloredGrain;
  }

  /**
   * Set the grain intensity (0-1)
   */
  setIntensity(intensity: number): void {
    this.update({ intensity: Math.max(0, Math.min(1, intensity)) });
  }

  /**
   * Update the time seed for animated grain
   * Call this each frame with current time for animated effect
   */
  setTime(time: number): void {
    this.update({ time });
  }

  /**
   * Set the luminance response (how grain varies with brightness)
   */
  setLuminanceResponse(response: number): void {
    this.update({ luminanceResponse: Math.max(0, Math.min(1, response)) });
  }

  /**
   * Use colored grain
   */
  colored(): void {
    this.update({ coloredGrain: 1 });
  }

  /**
   * Use monochrome grain
   */
  monochrome(): void {
    this.update({ coloredGrain: 0 });
  }

  /**
   * Configure for subtle film look
   */
  subtle(): void {
    this.update({
      intensity: 0.05,
      luminanceResponse: 0.3,
      coloredGrain: 0,
    });
  }

  /**
   * Configure for vintage film look
   */
  vintage(): void {
    this.update({
      intensity: 0.15,
      luminanceResponse: 0.7,
      coloredGrain: 0,
    });
  }

  /**
   * Configure for heavy grain look
   */
  heavy(): void {
    this.update({
      intensity: 0.25,
      luminanceResponse: 0.5,
      coloredGrain: 1,
    });
  }
}

/**
 * Factory function for creating film grain effects
 */
export function createFilmGrainEffect(
  id: string,
  screenPass: ScreenPass,
  params?: Record<string, number>
): FilmGrainEffect {
  return new FilmGrainEffect(id, screenPass, params as Partial<FilmGrainParams>);
}
