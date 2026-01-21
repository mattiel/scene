/**
 * WaveDeformation - Continuous wave effect
 * 
 * Creates a continuous undulating wave across the surface,
 * useful for scroll-linked effects and ambient motion.
 */

import { BaseDeformation, type DeformationConfig } from './BaseDeformation';
import type { UniformSchema } from '../materials/uniforms';

/** WaveDeformation configuration */
export interface WaveDeformationConfig extends DeformationConfig {
  /** Wave amplitude (default: 0.1) */
  amplitude?: number;
  /** Wave frequency (default: 2) */
  frequency?: number;
  /** Wave direction: 'horizontal', 'vertical', 'diagonal' (default: 'horizontal') */
  direction?: 'horizontal' | 'vertical' | 'diagonal';
}

/**
 * WaveDeformation - Continuous wave effect
 * 
 * @example
 * ```typescript
 * const wave = new WaveDeformation({
 *   amplitude: 0.05,
 *   frequency: 3,
 *   direction: 'horizontal',
 * });
 * 
 * // Drive wave phase with scroll position
 * scrollValue.on('change', (offset) => {
 *   material.setUniform('wavePhase', offset * 0.01);
 * });
 * ```
 */
export class WaveDeformation extends BaseDeformation {
  readonly defaultAmplitude: number;
  readonly defaultFrequency: number;
  readonly direction: 'horizontal' | 'vertical' | 'diagonal';

  constructor(config: WaveDeformationConfig = {}) {
    super({ id: 'wave', ...config });
    this.defaultAmplitude = config.amplitude ?? 0.1;
    this.defaultFrequency = config.frequency ?? 2;
    this.direction = config.direction ?? 'horizontal';
  }

  get uniforms(): UniformSchema {
    return {
      waveAmplitude: { type: 'f32', default: this.defaultAmplitude },
      waveFrequency: { type: 'f32', default: this.defaultFrequency },
      wavePhase: { type: 'f32', default: 0 },
      waveSpeed: { type: 'f32', default: 1 },
    };
  }

  getFunctionName(): string {
    return 'applyWave';
  }

  getShaderCode(): string {
    let uvComponent: string;
    switch (this.direction) {
      case 'vertical':
        uvComponent = 'texCoord.y';
        break;
      case 'diagonal':
        uvComponent = '(texCoord.x + texCoord.y) * 0.5';
        break;
      default:
        uvComponent = 'texCoord.x';
    }

    return `
// Wave Deformation
// Creates a continuous undulating wave (${this.direction})

fn applyWave(position: vec3f, texCoord: vec2f) -> vec3f {
  var pos = position;
  
  let amplitude = uniforms.waveAmplitude;
  let frequency = uniforms.waveFrequency;
  let phase = uniforms.wavePhase;
  let speed = uniforms.waveSpeed;
  
  // Calculate wave based on UV position
  let waveInput = ${uvComponent} * frequency * 6.28318 + phase * speed;
  let wave = sin(waveInput) * amplitude;
  
  // Apply displacement
  pos.z += wave;
  
  return pos;
}
`;
  }
}

/**
 * Create a horizontal wave
 */
export function horizontalWave(amplitude = 0.1, frequency = 2): WaveDeformation {
  return new WaveDeformation({ direction: 'horizontal', amplitude, frequency });
}

/**
 * Create a vertical wave
 */
export function verticalWave(amplitude = 0.1, frequency = 2): WaveDeformation {
  return new WaveDeformation({ direction: 'vertical', amplitude, frequency });
}
