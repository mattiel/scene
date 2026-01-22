/**
 * @scene/surfaces - Surface tracking and management
 * 
 * This package provides the surface system for Scene, which tracks
 * DOM elements and prepares them for GPU augmentation.
 */

// Core Surface
export { Surface, type SurfaceRect, type SurfaceOptions, type SurfaceMotionProperty } from './Surface';
export { SurfaceRegistry } from './SurfaceRegistry';
export { LayoutTracker, type LayoutTrackerOptions } from './LayoutTracker';

// Ghost Surfaces
export {
  createGhost,
  createGhostFromSurface,
  createGhostFromElement,
  createGhostWithTexture,
  isGhost,
  captureTextureFromElement,
  type GhostSurfaceOptions,
} from './GhostSurface';

// Ghost Pool
export {
  GhostPool,
  createGhostPool,
  type GhostPoolConfig,
} from './GhostPool';

// Transform Utilities
export {
  decomposeTransform,
  composeTransform,
  lerpTransform,
  getTransformMatrix,
  getTransformOrigin,
  getFullTransformMatrix,
  isIdentityTransform,
  IDENTITY_TRANSFORM,
  type DecomposedTransform,
} from './TransformUtils';

// Surface Effects
export {
  BaseSurfaceEffect,
  SurfaceEffectStack,
  BlurEffect,
  GlowEffect,
  DistortEffect,
  RefractEffect,
  blur,
  glow,
  distort,
  refract,
  type SurfaceEffect,
  type EffectUniform,
  type EffectUniformValue,
  type EffectRenderContext,
  type SurfaceEffectStackConfig,
  type BlurEffectConfig,
  type GlowEffectConfig,
  type DistortEffectConfig,
  type RefractEffectConfig,
} from './effects';
