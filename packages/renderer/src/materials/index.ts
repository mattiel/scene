/**
 * Material System
 * 
 * Abstracts shaders into reusable, composable materials.
 */

export { Material, type MaterialConfig, type BlendMode, type TypedMaterialConfig } from './Material';
export { 
  ShaderMaterial, 
  createBasicMaterial,
  type ShaderMaterialConfig,
  type Deformation,
  type VertexAttribute,
} from './ShaderMaterial';
export { 
  UniformBuffer, 
  uniformSize, 
  uniformAlignment, 
  calculateLayout,
  generateUniformStruct,
  type UniformValue,
  type UniformDefinition,
  type UniformSchema,
  type UniformValues,
  type UniformLayout,
} from './uniforms';
