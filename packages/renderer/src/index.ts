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
  WebGPUCapabilities,
  WebGPUInitProgress,
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
  StandardMaterial,
  createBasicMaterial,
  createColorMaterial,
  createTexturedMaterial,
  createEmissiveMaterial,
  UniformBuffer,
  GlobalUniformManager,
  uniformSize,
  uniformAlignment,
  calculateLayout,
  generateUniformStruct,
  type MaterialConfig,
  type BlendMode,
  type TypedMaterialConfig,
  type ShaderMaterialConfig,
  type StandardMaterialConfig,
  type Deformation,
  type VertexAttribute,
  type TextureSlot,
  type BindGroupEntry,
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
  CircleGeometry,
  RingGeometry,
  MorphGeometry,
  createFullscreenQuad,
  createScaleMorphTarget,
  createOffsetMorphTarget,
  createBulgeMorphTarget,
  type TypedArray,
  type BoundingBox,
  type PlaneGeometryConfig,
  type CircleGeometryConfig,
  type RingGeometryConfig,
  type MorphTarget,
  type MorphGeometryConfig,
} from './geometry';

// Mesh
export { 
  Mesh, 
  type MeshTransform,
  type MeshConfig,
} from './Mesh';

// Mesh Renderer
export {
  MeshRenderer,
  createMeshRenderer,
  type SortMode,
  type CameraData,
  type RenderStats,
  type MeshRendererConfig,
} from './MeshRenderer';

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

// Camera & Matrix Utilities
export {
  Camera,
  perspective,
  lookAt,
  translate,
  rotateX,
  rotateY,
  rotateZ,
  scale,
  multiply,
  composeModelMatrix,
  identity,
  type CameraConfig,
} from './Camera';

// Note: FabricWaveRenderer has been moved to website/src/lib/carousel/
// It is a user-level implementation, not a library primitive.
