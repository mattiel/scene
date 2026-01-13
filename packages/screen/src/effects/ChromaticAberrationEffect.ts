/**
 * ChromaticAberrationEffect
 *
 * Simulates lens chromatic aberration by offsetting RGB channels.
 */

/// <reference types="@webgpu/types" />

import type { ScreenPass } from '@scene/renderer';
import { BaseEffect } from './BaseEffect';

export interface ChromaticAberrationParams {
  /** Aberration strength (0 = none, typical range 0.001-0.05) */
  strength: number;
}

const DEFAULT_CHROMATIC_PARAMS: ChromaticAberrationParams = {
  strength: 0.01,
};

export class ChromaticAberrationEffect extends BaseEffect {
  readonly type: string = 'chromatic_aberration';

  constructor(
    id: string,
    screenPass: ScreenPass,
    params?: Partial<ChromaticAberrationParams>
  ) {
    super(
      id,
      screenPass,
      'chromatic_aberration_fragment',
      4, // f32 strength + 3x f32 padding (16-byte alignment)
      { ...DEFAULT_CHROMATIC_PARAMS, ...params }
    );
  }

  protected syncUniformData(): void {
    // Layout: f32 strength + padding for 16-byte alignment
    this.uniformData[0] = this.params.strength;
    this.uniformData[1] = 0; // padding
    this.uniformData[2] = 0; // padding
    this.uniformData[3] = 0; // padding
  }

  /**
   * Set aberration strength
   */
  setStrength(strength: number): void {
    this.update({ strength: Math.max(0, strength) });
  }

  /**
   * Apply a subtle aberration preset
   */
  subtle(): void {
    this.update({ strength: 0.005 });
  }

  /**
   * Apply a moderate aberration preset
   */
  moderate(): void {
    this.update({ strength: 0.015 });
  }

  /**
   * Apply a strong aberration preset (for stylized effects)
   */
  strong(): void {
    this.update({ strength: 0.03 });
  }
}

/**
 * Factory function for creating chromatic aberration effects
 */
export function createChromaticAberrationEffect(
  id: string,
  screenPass: ScreenPass,
  params?: Record<string, number>
): ChromaticAberrationEffect {
  return new ChromaticAberrationEffect(
    id,
    screenPass,
    params as Partial<ChromaticAberrationParams>
  );
}
