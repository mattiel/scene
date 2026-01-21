/**
 * BaseDeformation - Base class for vertex deformations
 * 
 * Deformations modify vertex positions in the shader.
 * They provide WGSL code and uniform definitions.
 */

import type { Deformation } from '../materials/ShaderMaterial';
import type { UniformSchema } from '../materials/uniforms';

/** Base deformation configuration */
export interface DeformationConfig {
  /** Unique identifier for this deformation */
  id?: string;
  /** Whether deformation is enabled */
  enabled?: boolean;
}

/**
 * BaseDeformation - Abstract base for deformations
 */
export abstract class BaseDeformation implements Deformation {
  readonly id: string;
  enabled: boolean;

  constructor(config: DeformationConfig = {}) {
    this.id = config.id ?? this.constructor.name;
    this.enabled = config.enabled ?? true;
  }

  /**
   * Get uniform schema for this deformation
   */
  abstract get uniforms(): UniformSchema;

  /**
   * Get WGSL shader code for this deformation
   */
  abstract getShaderCode(): string;

  /**
   * Get the function name to call in vertex shader
   */
  abstract getFunctionName(): string;
}
