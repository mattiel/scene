/**
 * @scene/react
 * 
 * React bindings for Scene engine.
 * Provides hooks and components for declarative Scene integration.
 */

// Context and Provider
export {
  SceneProvider,
  useSceneContext,
  useSceneContextOptional,
  type SceneContextValue,
  type SceneProviderProps,
} from './SceneProvider';

// Engine access
export {
  useScene,
  useSceneEvent,
  useSceneProperty,
  type UseSceneReturn,
} from './useScene';

// Surface management
export {
  useSurface,
  useSurfaceById,
  useSurfaces,
  useSurfaceEvents,
  type UseSurfaceOptions,
  type UseSurfaceReturn,
} from './useSurface';

// Motion/animation
export {
  useMotion,
  useMotion2D,
  useMotionBinding,
  springs,
  type UseMotionReturn,
  type UseMotion2DReturn,
} from './useMotion';

// Material management
export {
  useMaterial,
  useMaterialUniform,
  useMaterialUniforms,
  useDeformableMaterial,
  type UseMaterialReturn,
  type UseDeformableMaterialReturn,
} from './useMaterial';

// Re-export useful types from dependencies
export { InteractionMode } from '@scene/core';
export type { Surface, SurfaceRect } from '@scene/surfaces';
export type { AnimationConfig, SpringConfig } from '@scene/motion';
