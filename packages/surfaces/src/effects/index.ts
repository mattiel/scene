/**
 * Surface Effects System
 * 
 * Per-surface GPU effects that can be stacked and composed.
 */

// Core effect types
export {
  BaseSurfaceEffect,
  type SurfaceEffect,
  type EffectUniform,
  type EffectUniformValue,
  type EffectRenderContext,
} from './SurfaceEffect';

// Effect stack
export {
  SurfaceEffectStack,
  type SurfaceEffectStackConfig,
} from './SurfaceEffectStack';

// Built-in effects
export {
  BlurEffect,
  GlowEffect,
  DistortEffect,
  RefractEffect,
  blur,
  glow,
  distort,
  refract,
  type BlurEffectConfig,
  type GlowEffectConfig,
  type DistortEffectConfig,
  type RefractEffectConfig,
} from './BuiltinEffects';
