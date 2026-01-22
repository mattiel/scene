/**
 * DepthOfFieldEffect
 *
 * Simulates camera depth of field with configurable focus point and bokeh.
 * Creates cinematic blur for out-of-focus areas.
 */

/// <reference types="@webgpu/types" />

import type { ScreenPass } from '@scene/renderer';
import { BaseEffect } from './BaseEffect';

export interface DepthOfFieldParams {
  /** Focus point X (0-1, default: 0.5 = center) */
  focusPointX: number;
  /** Focus point Y (0-1, default: 0.5 = center) */
  focusPointY: number;
  /** Focus range - how far from focus point before blur starts (default: 0.3) */
  focusRange: number;
  /** Blur amount multiplier (default: 10) */
  blurAmount: number;
  /** Bokeh size multiplier (default: 40) */
  bokehSize: number;
  /** Bokeh brightness - makes bright spots more prominent (default: 2) */
  bokehBrightness: number;
}

const DEFAULT_DOF_PARAMS: DepthOfFieldParams = {
  focusPointX: 0.5,
  focusPointY: 0.5,
  focusRange: 0.3,
  blurAmount: 10,
  bokehSize: 40,
  bokehBrightness: 2,
};

export class DepthOfFieldEffect extends BaseEffect {
  readonly type: string = 'depth_of_field';

  constructor(
    id: string,
    screenPass: ScreenPass,
    params?: Partial<DepthOfFieldParams>
  ) {
    super(
      id,
      screenPass,
      'depth_of_field_fragment',
      8, // vec2 focusPoint + f32 focusRange + f32 blurAmount + f32 bokehSize + f32 bokehBrightness + 2 padding
      { ...DEFAULT_DOF_PARAMS, ...params }
    );
  }

  protected syncUniformData(): void {
    this.uniformData[0] = this.params.focusPointX;
    this.uniformData[1] = this.params.focusPointY;
    this.uniformData[2] = this.params.focusRange;
    this.uniformData[3] = this.params.blurAmount;
    this.uniformData[4] = this.params.bokehSize;
    this.uniformData[5] = this.params.bokehBrightness;
    this.uniformData[6] = 0; // padding
    this.uniformData[7] = 0; // padding
  }

  /**
   * Set the focus point (0-1 coordinates)
   */
  setFocusPoint(x: number, y: number): void {
    this.update({ focusPointX: x, focusPointY: y });
  }

  /**
   * Set the focus range
   */
  setFocusRange(range: number): void {
    this.update({ focusRange: range });
  }

  /**
   * Set the blur amount
   */
  setBlurAmount(amount: number): void {
    this.update({ blurAmount: amount });
  }

  /**
   * Set bokeh parameters
   */
  setBokeh(size: number, brightness: number): void {
    this.update({ bokehSize: size, bokehBrightness: brightness });
  }

  /**
   * Focus on center of screen
   */
  focusCenter(): void {
    this.setFocusPoint(0.5, 0.5);
  }
}

/**
 * Factory function for creating depth of field effects
 */
export function createDepthOfFieldEffect(
  id: string,
  screenPass: ScreenPass,
  params?: Record<string, number>
): DepthOfFieldEffect {
  return new DepthOfFieldEffect(id, screenPass, params as Partial<DepthOfFieldParams>);
}
