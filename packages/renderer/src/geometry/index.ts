/**
 * Geometry System
 * 
 * Vertex attribute and buffer management for GPU rendering.
 */

export { 
  BufferAttribute, 
  float32Attribute, 
  uint16Index, 
  uint32Index,
  type TypedArray,
} from './BufferAttribute';

export { 
  Geometry, 
  type BoundingBox,
} from './Geometry';

export { 
  PlaneGeometry, 
  createFullscreenQuad,
  type PlaneGeometryConfig,
} from './PlaneGeometry';

export {
  CircleGeometry,
  type CircleGeometryConfig,
} from './CircleGeometry';

export {
  RingGeometry,
  type RingGeometryConfig,
} from './RingGeometry';

export {
  MorphGeometry,
  createScaleMorphTarget,
  createOffsetMorphTarget,
  createBulgeMorphTarget,
  type MorphTarget,
  type MorphGeometryConfig,
} from './MorphGeometry';
