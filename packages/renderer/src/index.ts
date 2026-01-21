/**
 * @scene/renderer
 * 
 * WebGPU rendering foundation for Scene engine.
 * Provides WebGPU context management, quad rendering, post-processing, 
 * shader library, material system, and geometry management.
 */

// Core rendering
export { WebGPUContext } from './WebGPUContext';
export type { 
  WebGPUContextOptions, 
  WebGPUContextState,
  BrowserInfo,
  WebGPUCapabilities 
} from './WebGPUContext';

export { QuadRenderer } from './QuadRenderer';
export type { QuadVertex, QuadInstance, QuadRenderOptions } from './QuadRenderer';

export { ScreenPass } from './ScreenPass';
export type { ScreenPassOptions, ScreenPassEffect } from './ScreenPass';

export { ShaderLibrary } from './ShaderLibrary';
export type { ShaderModule, CompiledShader } from './ShaderLibrary';

// Material System
export {
  Material,
  ShaderMaterial,
  createBasicMaterial,
  UniformBuffer,
  uniformSize,
  uniformAlignment,
  calculateLayout,
  generateUniformStruct,
  type MaterialConfig,
  type BlendMode,
  type TypedMaterialConfig,
  type ShaderMaterialConfig,
  type Deformation,
  type VertexAttribute,
  type UniformValue,
  type UniformDefinition,
  type UniformSchema,
  type UniformValues,
  type UniformLayout,
} from './materials';

// Geometry System
export {
  BufferAttribute,
  float32Attribute,
  uint16Index,
  uint32Index,
  Geometry,
  PlaneGeometry,
  createFullscreenQuad,
  type TypedArray,
  type BoundingBox,
  type PlaneGeometryConfig,
} from './geometry';

// Mesh
export { 
  Mesh, 
  type MeshTransform,
  type MeshConfig,
} from './Mesh';

// Deformations
export {
  BaseDeformation,
  BendDeformation,
  RippleDeformation,
  WaveDeformation,
  horizontalBend,
  verticalBend,
  subtleRipple,
  strongRipple,
  horizontalWave,
  verticalWave,
  type DeformationConfig,
  type BendDeformationConfig,
  type RippleDeformationConfig,
  type WaveDeformationConfig,
} from './deformations';
