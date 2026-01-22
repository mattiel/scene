/**
 * Built-in screen effects
 */

export { BaseEffect } from './BaseEffect';

export { BlurEffect, createBlurEffect } from './BlurEffect';
export type { BlurParams } from './BlurEffect';

export { VignetteEffect, createVignetteEffect } from './VignetteEffect';
export type { VignetteParams } from './VignetteEffect';

export {
  ChromaticAberrationEffect,
  createChromaticAberrationEffect,
} from './ChromaticAberrationEffect';
export type { ChromaticAberrationParams } from './ChromaticAberrationEffect';

// New cinematic effects
export { DepthOfFieldEffect, createDepthOfFieldEffect } from './DepthOfFieldEffect';
export type { DepthOfFieldParams } from './DepthOfFieldEffect';

export { MotionBlurEffect, createMotionBlurEffect } from './MotionBlurEffect';
export type { MotionBlurParams } from './MotionBlurEffect';

export { FilmGrainEffect, createFilmGrainEffect } from './FilmGrainEffect';
export type { FilmGrainParams } from './FilmGrainEffect';

export { ColorGradingEffect, createColorGradingEffect } from './ColorGradingEffect';
export type { ColorGradingParams } from './ColorGradingEffect';
