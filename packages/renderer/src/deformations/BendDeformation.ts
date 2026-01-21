/**
 * BendDeformation - Fabric-like bend effect
 * 
 * Creates a curved/bent surface effect, commonly used
 * for carousel cards and page curl effects.
 */

import { BaseDeformation, type DeformationConfig } from './BaseDeformation';
import type { UniformSchema } from '../materials/uniforms';

/** BendDeformation configuration */
export interface BendDeformationConfig extends DeformationConfig {
  /** Bend intensity (default: 0.3) */
  intensity?: number;
  /** Bend axis: 'x' or 'y' (default: 'x') */
  axis?: 'x' | 'y';
  /** Bend direction multiplier (default: 1) */
  direction?: number;
}

/**
 * BendDeformation - Curved surface effect
 * 
 * Creates a cylindrical bend along one axis.
 * 
 * @example
 * ```typescript
 * const bend = new BendDeformation({
 *   intensity: 0.5,
 *   axis: 'x',
 * });
 * 
 * const material = new ShaderMaterial({
 *   deformations: [bend],
 * });
 * 
 * // Animate bend during scroll
 * material.setUniform('bendIntensity', velocity * 0.01);
 * ```
 */
export class BendDeformation extends BaseDeformation {
  readonly axis: 'x' | 'y';
  readonly defaultIntensity: number;
  readonly defaultDirection: number;

  constructor(config: BendDeformationConfig = {}) {
    super({ id: 'bend', ...config });
    this.axis = config.axis ?? 'x';
    this.defaultIntensity = config.intensity ?? 0.3;
    this.defaultDirection = config.direction ?? 1;
  }

  get uniforms(): UniformSchema {
    return {
      bendIntensity: { type: 'f32', default: this.defaultIntensity },
      bendDirection: { type: 'f32', default: this.defaultDirection },
      bendOffset: { type: 'f32', default: 0 },
    };
  }

  getFunctionName(): string {
    return 'applyBend';
  }

  getShaderCode(): string {
    const posComponent = this.axis === 'x' ? 'x' : 'y';
    const bendComponent = this.axis === 'x' ? 'y' : 'x';

    return `
// Bend Deformation
// Creates a cylindrical bend along the ${this.axis} axis

fn applyBend(position: vec3f, texCoord: vec2f) -> vec3f {
  var pos = position;
  
  // Get bend parameters from uniforms
  let intensity = uniforms.bendIntensity;
  let direction = uniforms.bendDirection;
  let offset = uniforms.bendOffset;
  
  // Calculate bend based on position along axis
  let t = (pos.${posComponent} + offset) * intensity * direction;
  
  // Apply sinusoidal bend to create curved surface
  // Use cosine for smooth falloff at edges
  let bendAmount = sin(t * 3.14159);
  
  // Displace perpendicular to bend axis
  pos.z += bendAmount * intensity * 0.5;
  
  // Slight scaling to maintain arc length
  pos.${bendComponent} *= 1.0 - abs(bendAmount) * intensity * 0.1;
  
  return pos;
}
`;
  }
}

/**
 * Create a horizontal bend deformation
 */
export function horizontalBend(intensity = 0.3): BendDeformation {
  return new BendDeformation({ axis: 'x', intensity });
}

/**
 * Create a vertical bend deformation  
 */
export function verticalBend(intensity = 0.3): BendDeformation {
  return new BendDeformation({ axis: 'y', intensity });
}
