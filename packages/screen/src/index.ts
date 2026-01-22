/**
 * @scene/screen
 *
 * Screen effects and transitions for Scene engine.
 * Provides post-processing pipeline management and navigation transitions.
 */

// Effect Stack
export { EffectStack } from './EffectStack';
export type { Effect, EffectConfig, EffectFactory } from './EffectStack';

// Conditional Effect Stack
export { 
  ConditionalEffectStack, 
  createConditionalEffectStack 
} from './ConditionalEffectStack';
export type { 
  ConditionalEffectConfig, 
  EffectCondition, 
  EffectDependency 
} from './ConditionalEffectStack';

// Render Target Pool
export { RenderTargetPool, createRenderTargetPool } from './RenderTargetPool';
export type { RenderTargetPoolConfig } from './RenderTargetPool';

// Built-in Effects
export {
  BaseEffect,
  // Original effects
  BlurEffect,
  createBlurEffect,
  VignetteEffect,
  createVignetteEffect,
  ChromaticAberrationEffect,
  createChromaticAberrationEffect,
  // New cinematic effects
  DepthOfFieldEffect,
  createDepthOfFieldEffect,
  MotionBlurEffect,
  createMotionBlurEffect,
  FilmGrainEffect,
  createFilmGrainEffect,
  ColorGradingEffect,
  createColorGradingEffect,
} from './effects';
export type {
  BlurParams,
  VignetteParams,
  ChromaticAberrationParams,
  DepthOfFieldParams,
  MotionBlurParams,
  FilmGrainParams,
  ColorGradingParams,
} from './effects';

// Transitions
export { 
  TransitionEffect,
  TransitionTimeline,
  Easings,
  createDissolveTimeline,
  createSlideFadeTimeline,
  createDramaticZoomTimeline,
} from './transitions';
export type {
  TransitionConfig,
  TransitionType,
  WipeDirection,
  SlideDirection,
  FlipAxis,
  CubeDirection,
  TransitionKeyframe,
  TransitionTimelineConfig,
  TimelineState,
  EasingFunction,
} from './transitions';

// Shaders
export {
  dissolveShader,
  wipeShader,
  fadeToBlackShader,
  zoomShader,
  slideShader,
  flipShader,
  cubeShader,
  morphShader,
  transitionShaders,
  registerTransitionShaders,
} from './shaders';

// Re-export renderer types for convenience
export type {
  ScreenPass,
  ScreenPassOptions,
  ShaderLibrary,
  ShaderModule,
  WebGPUContext,
} from '@scene/renderer';
