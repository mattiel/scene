/**
 * BaseEffect
 *
 * Abstract base class for screen effects.
 * Provides common functionality for uniform management.
 */

/// <reference types="@webgpu/types" />

import type { ScreenPass } from '@scene/renderer';
import type { Effect } from '../EffectStack';

export abstract class BaseEffect implements Effect {
  readonly id: string;
  abstract readonly type: string;
  enabled: boolean;
  readonly effectHandle: string;

  protected screenPass: ScreenPass;
  protected uniformData: Float32Array;
  protected params: Record<string, number>;

  constructor(
    id: string,
    screenPass: ScreenPass,
    shaderName: string,
    uniformSize: number,
    defaultParams: Record<string, number>
  ) {
    this.id = id;
    this.screenPass = screenPass;
    this.enabled = true;
    this.params = { ...defaultParams };
    this.uniformData = new Float32Array(uniformSize);

    // Initialize uniform data from params
    this.syncUniformData();

    // Create the effect
    this.effectHandle = screenPass.createEffect({
      shaderName,
      uniformData: this.uniformData,
    });
  }

  /**
   * Sync uniform data from params - override in subclasses
   */
  protected abstract syncUniformData(): void;

  /**
   * Update effect parameters
   */
  update(newParams: Record<string, number>): void {
    // Merge new params
    for (const key of Object.keys(newParams)) {
      if (key in this.params) {
        this.params[key] = newParams[key];
      }
    }

    // Sync and upload
    this.syncUniformData();
    this.screenPass.updateUniform(this.effectHandle, this.uniformData);
  }

  /**
   * Get current uniform data
   */
  getUniformData(): Float32Array {
    return this.uniformData;
  }

  /**
   * Get current parameters
   */
  getParams(): Record<string, number> {
    return { ...this.params };
  }
}
