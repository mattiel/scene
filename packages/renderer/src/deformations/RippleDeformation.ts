/**
 * RippleDeformation - Click/tap ripple effect
 * 
 * Creates an expanding ring distortion from a point,
 * commonly used for touch feedback.
 */

import { BaseDeformation, type DeformationConfig } from './BaseDeformation';
import type { UniformSchema } from '../materials/uniforms';

/** RippleDeformation configuration */
export interface RippleDeformationConfig extends DeformationConfig {
  /** Ripple amplitude (default: 0.1) */
  amplitude?: number;
  /** Ripple frequency (default: 8) */
  frequency?: number;
  /** Ripple decay speed (default: 2) */
  decay?: number;
  /** Ripple expansion speed (default: 3) */
  speed?: number;
}

/**
 * RippleDeformation - Expanding ring effect
 * 
 * Creates a wave that expands from a center point.
 * 
 * @example
 * ```typescript
 * const ripple = new RippleDeformation({
 *   amplitude: 0.15,
 *   frequency: 10,
 * });
 * 
 * // Trigger ripple at tap position
 * function onTap(x: number, y: number) {
 *   material.setUniform('rippleCenter', [x, y]);
 *   material.setUniform('rippleTime', 0);
 *   
 *   // Animate rippleTime from 0 to 1
 *   animate(0, 1, {
 *     duration: 800,
 *     onUpdate: (t) => material.setUniform('rippleTime', t),
 *   });
 * }
 * ```
 */
export class RippleDeformation extends BaseDeformation {
  readonly defaultAmplitude: number;
  readonly defaultFrequency: number;
  readonly defaultDecay: number;
  readonly defaultSpeed: number;

  constructor(config: RippleDeformationConfig = {}) {
    super({ id: 'ripple', ...config });
    this.defaultAmplitude = config.amplitude ?? 0.1;
    this.defaultFrequency = config.frequency ?? 8;
    this.defaultDecay = config.decay ?? 2;
    this.defaultSpeed = config.speed ?? 3;
  }

  get uniforms(): UniformSchema {
    return {
      rippleCenter: { type: 'vec2f', default: [0.5, 0.5] },
      rippleTime: { type: 'f32', default: 0 },
      rippleAmplitude: { type: 'f32', default: this.defaultAmplitude },
      rippleFrequency: { type: 'f32', default: this.defaultFrequency },
      rippleDecay: { type: 'f32', default: this.defaultDecay },
      rippleSpeed: { type: 'f32', default: this.defaultSpeed },
    };
  }

  getFunctionName(): string {
    return 'applyRipple';
  }

  getShaderCode(): string {
    return `
// Ripple Deformation
// Creates an expanding ring distortion from a center point

fn applyRipple(position: vec3f, texCoord: vec2f) -> vec3f {
  var pos = position;
  
  // Get ripple parameters
  let center = uniforms.rippleCenter;
  let time = uniforms.rippleTime;
  let amplitude = uniforms.rippleAmplitude;
  let frequency = uniforms.rippleFrequency;
  let decay = uniforms.rippleDecay;
  let speed = uniforms.rippleSpeed;
  
  // Skip if no ripple active
  if (time <= 0.0 || time >= 1.0) {
    return pos;
  }
  
  // Distance from ripple center (in UV space)
  let dist = distance(texCoord, center);
  
  // Ripple ring position expands over time
  let ringPos = time * speed;
  
  // Distance from the ring
  let ringDist = abs(dist - ringPos);
  
  // Ripple wave with decay
  let wave = sin(ringDist * frequency * 6.28318);
  
  // Amplitude falls off with distance from ring and time
  let ringFalloff = exp(-ringDist * 10.0);
  let timeFalloff = 1.0 - time;
  let totalAmplitude = amplitude * wave * ringFalloff * timeFalloff;
  
  // Apply displacement in Z
  pos.z += totalAmplitude;
  
  return pos;
}
`;
  }
}

/**
 * Create a subtle ripple effect
 */
export function subtleRipple(): RippleDeformation {
  return new RippleDeformation({
    amplitude: 0.05,
    frequency: 6,
    decay: 3,
  });
}

/**
 * Create a strong ripple effect
 */
export function strongRipple(): RippleDeformation {
  return new RippleDeformation({
    amplitude: 0.2,
    frequency: 10,
    decay: 1.5,
  });
}
