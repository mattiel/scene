/**
 * @scene/screen
 *
 * Screen effects and transitions for Scene engine.
 * Provides post-processing pipeline management and navigation transitions.
 */

// Effect Stack
export { EffectStack } from './EffectStack';
export type { Effect, EffectConfig, EffectFactory } from './EffectStack';

// Built-in Effects
export {
  BaseEffect,
  BlurEffect,
  createBlurEffect,
  VignetteEffect,
  createVignetteEffect,
  ChromaticAberrationEffect,
  createChromaticAberrationEffect,
} from './effects';
export type {
  BlurParams,
  VignetteParams,
  ChromaticAberrationParams,
} from './effects';

// Transitions
export { TransitionEffect } from './transitions';
export type {
  TransitionConfig,
  TransitionType,
  WipeDirection,
} from './transitions';

// Shaders
export {
  dissolveShader,
  wipeShader,
  fadeToBlackShader,
  zoomShader,
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
