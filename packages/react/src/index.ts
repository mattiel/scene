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

// Motion bridge (SceneValue ↔ MotionValue)
export {
  useMotionBridge,
  useMotionBridgeMany,
  useMotionBridgeWithState,
  type UseMotionBridgeWithStateReturn,
} from './useMotionBridge';

// Material management
export {
  useMaterial,
  useMaterialUniform,
  useMaterialUniforms,
  useDeformableMaterial,
  type UseMaterialReturn,
  type UseDeformableMaterialReturn,
} from './useMaterial';

// Controller hooks (Scrollable, Draggable)
export {
  useScrollable,
  useDraggable,
  useScrollableInput,
  useReducedMotion,
  type UseScrollableOptions,
  type UseScrollableReturn,
  type UseDraggableOptions,
  type UseDraggableReturn,
  type UseScrollableInputOptions,
  type UseScrollableInputReturn,
} from './useControllers';

// Screen effects
export {
  useScreenEffect,
  useScreenEffects,
  type UseScreenEffectOptions,
  type UseScreenEffectReturn,
  type UseScreenEffectsOptions,
  type UseScreenEffectsReturn,
} from './useScreenEffect';

// Surface effects
export {
  useSurfaceEffect,
  useSurfaceEffects,
  type SurfaceEffectType,
  type UseSurfaceEffectOptions,
  type UseSurfaceEffectReturn,
  type UseSurfaceEffectsReturn,
} from './useSurfaceEffect';

// Transitions
export {
  useTransition,
  useTransitionStyle,
  useStaggeredTransition,
  type TransitionState,
  type UseTransitionOptions,
  type UseTransitionReturn,
  type UseTransitionStyleOptions,
  type UseStaggeredTransitionReturn,
} from './useTransition';

// GPU initialization
export {
  useGPU,
  useWebGPUAvailable,
  type UseGPUOptions,
  type UseGPUReturn,
  type GPUProgress,
} from './useGPU';

// Render loop
export {
  useRenderLoop,
  useFixedUpdate,
  useThrottledRender,
  type RenderCallback,
  type RenderCallbackArgs,
  type UseRenderLoopOptions,
  type UseRenderLoopReturn,
} from './useRenderLoop';

// Gesture handling
export {
  useGesture,
  type Point,
  type GestureInfo,
  type GestureConstraints,
  type Axis,
  type UseGestureOptions,
  type GestureControls,
  type UseGestureReturn,
  type GestureBindings,
} from './useGesture';

export { useGestureControls } from './useGestureControls';

// Frame rate monitoring
export { useFrameRate, type UseFrameRateOptions, type UseFrameRateReturn } from './useFrameRate';

// Responsive breakpoints
export {
  useBreakpoint,
  useCurrentBreakpoint,
  useBreakpointUp,
  type BreakpointConfig,
} from './useBreakpoint';

// Element sizing
export {
  useSize,
  useResolution,
  useWindowSize,
  useMeasure,
  type Size,
  type UseSizeOptions,
  type Resolution,
  type UseResolutionOptions,
} from './useSize';

// Re-export useful types from dependencies
export { InteractionMode } from '@scene/core';
export type { Surface, SurfaceRect } from '@scene/surfaces';
export type { AnimationConfig, SpringConfig } from '@scene/motion';
