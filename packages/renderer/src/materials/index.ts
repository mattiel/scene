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
  type TextureSlot,
  type BindGroupEntry,
} from './ShaderMaterial';
export {
  StandardMaterial,
  createColorMaterial,
  createTexturedMaterial,
  createEmissiveMaterial,
  type StandardMaterialConfig,
} from './StandardMaterial';
export { 
  UniformBuffer,
  GlobalUniformManager,
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
// Note: FabricWaveMaterial has been moved to website/src/lib/carousel/
// It is a user-level implementation, not a library primitive.
