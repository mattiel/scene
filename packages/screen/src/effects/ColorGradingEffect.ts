/**
 * ColorGradingEffect
 *
 * Comprehensive color grading post-processing effect.
 * Provides brightness, contrast, saturation, temperature, tint,
 * and lift/gamma/gain (shadows/midtones/highlights) controls.
 */

/// <reference types="@webgpu/types" />

import type { ScreenPass } from '@scene/renderer';
import { BaseEffect } from './BaseEffect';

export interface ColorGradingParams {
  /** Brightness multiplier (default: 1.0, range: 0-2) */
  brightness: number;
  /** Contrast (default: 1.0, range: 0-2) */
  contrast: number;
  /** Saturation (default: 1.0, 0 = grayscale, >1 = oversaturated) */
  saturation: number;
  /** Temperature (-1 = cool/blue, 1 = warm/orange, default: 0) */
  temperature: number;
  /** Tint (-1 = magenta, 1 = green, default: 0) */
  tint: number;
  /** Shadow adjustment (-1 to 1, default: 0) */
  shadows: number;
  /** Midtone adjustment (-1 to 1, default: 0) */
  midtones: number;
  /** Highlight adjustment (-1 to 1, default: 0) */
  highlights: number;
}

const DEFAULT_COLOR_GRADING_PARAMS: ColorGradingParams = {
  brightness: 1.0,
  contrast: 1.0,
  saturation: 1.0,
  temperature: 0,
  tint: 0,
  shadows: 0,
  midtones: 0,
  highlights: 0,
};

export class ColorGradingEffect extends BaseEffect {
  readonly type: string = 'color_grading';

  constructor(
    id: string,
    screenPass: ScreenPass,
    params?: Partial<ColorGradingParams>
  ) {
    super(
      id,
      screenPass,
      'color_grading_fragment',
      8, // 8 f32 values
      { ...DEFAULT_COLOR_GRADING_PARAMS, ...params }
    );
  }

  protected syncUniformData(): void {
    this.uniformData[0] = this.params.brightness;
    this.uniformData[1] = this.params.contrast;
    this.uniformData[2] = this.params.saturation;
    this.uniformData[3] = this.params.temperature;
    this.uniformData[4] = this.params.tint;
    this.uniformData[5] = this.params.shadows;
    this.uniformData[6] = this.params.midtones;
    this.uniformData[7] = this.params.highlights;
  }

  /**
   * Set brightness (0-2, default 1)
   */
  setBrightness(brightness: number): void {
    this.update({ brightness: Math.max(0, Math.min(2, brightness)) });
  }

  /**
   * Set contrast (0-2, default 1)
   */
  setContrast(contrast: number): void {
    this.update({ contrast: Math.max(0, Math.min(2, contrast)) });
  }

  /**
   * Set saturation (0 = grayscale, 1 = normal, >1 = oversaturated)
   */
  setSaturation(saturation: number): void {
    this.update({ saturation: Math.max(0, saturation) });
  }

  /**
   * Set color temperature (-1 = cool, 1 = warm)
   */
  setTemperature(temperature: number): void {
    this.update({ temperature: Math.max(-1, Math.min(1, temperature)) });
  }

  /**
   * Set color tint (-1 = magenta, 1 = green)
   */
  setTint(tint: number): void {
    this.update({ tint: Math.max(-1, Math.min(1, tint)) });
  }

  /**
   * Set shadow/midtone/highlight adjustments
   */
  setLift(shadows: number, midtones: number, highlights: number): void {
    this.update({
      shadows: Math.max(-1, Math.min(1, shadows)),
      midtones: Math.max(-1, Math.min(1, midtones)),
      highlights: Math.max(-1, Math.min(1, highlights)),
    });
  }

  /**
   * Reset to default values
   */
  reset(): void {
    this.update({ ...DEFAULT_COLOR_GRADING_PARAMS });
  }

  /**
   * Apply a warm, sunny look
   */
  warmSunny(): void {
    this.update({
      brightness: 1.1,
      contrast: 1.1,
      saturation: 1.2,
      temperature: 0.3,
      tint: 0,
      shadows: -0.1,
      midtones: 0.1,
      highlights: 0.2,
    });
  }

  /**
   * Apply a cool, moody look
   */
  coolMoody(): void {
    this.update({
      brightness: 0.95,
      contrast: 1.2,
      saturation: 0.8,
      temperature: -0.3,
      tint: 0,
      shadows: 0.1,
      midtones: -0.05,
      highlights: -0.1,
    });
  }

  /**
   * Apply a vintage/retro look
   */
  vintage(): void {
    this.update({
      brightness: 1.0,
      contrast: 0.9,
      saturation: 0.7,
      temperature: 0.2,
      tint: 0.1,
      shadows: 0.15,
      midtones: 0,
      highlights: -0.1,
    });
  }

  /**
   * Apply a cinematic teal-orange look
   */
  cinematic(): void {
    this.update({
      brightness: 1.0,
      contrast: 1.15,
      saturation: 1.1,
      temperature: 0.15,
      tint: -0.05,
      shadows: 0.05,
      midtones: 0,
      highlights: 0.1,
    });
  }

  /**
   * Apply a high-contrast dramatic look
   */
  dramatic(): void {
    this.update({
      brightness: 0.95,
      contrast: 1.4,
      saturation: 0.9,
      temperature: 0,
      tint: 0,
      shadows: -0.2,
      midtones: 0,
      highlights: 0.2,
    });
  }

  /**
   * Apply a desaturated, bleached look
   */
  bleached(): void {
    this.update({
      brightness: 1.1,
      contrast: 0.8,
      saturation: 0.4,
      temperature: 0.1,
      tint: 0,
      shadows: 0.2,
      midtones: 0.1,
      highlights: 0.1,
    });
  }
}

/**
 * Factory function for creating color grading effects
 */
export function createColorGradingEffect(
  id: string,
  screenPass: ScreenPass,
  params?: Record<string, number>
): ColorGradingEffect {
  return new ColorGradingEffect(id, screenPass, params as Partial<ColorGradingParams>);
}
