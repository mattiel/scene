/**
 * @scene/motion
 * 
 * Motion library integration layer for Scene engine.
 * Bridges Motion (motion.dev) with Scene's render loop and uniform system.
 */

// Core value types
export {
  SceneValue,
  SceneValue2D,
  DerivedSceneValue,
  MultiSourceDerivedSceneValue,
  createSceneValue,
  type ValueChangeCallback,
  type VelocityChangeCallback,
  type SceneValueOptions,
  type InterpolateOptions,
  type UniformTarget,
} from './SceneValue';

// Spring presets and configuration
export {
  springs,
  tweens,
  createSpring,
  fromPreset,
  type SpringConfig,
  type SpringPreset,
  type TweenConfig,
  type AnimationConfig,
} from './springs';

// Frame synchronization
export {
  FrameBridge,
  getFrameBridge,
  syncFrame,
  unsyncFrame,
  useMotionFrame,
  type MotionFrameCallback,
  type FrameData,
} from './bridge';

// MotionValue adapter for Motion library interop
export {
  MotionValueAdapter,
  createMotionValue,
  fromMotionValue,
  hasAdapter,
  destroyAdapter,
  type MotionValueAdapterOptions,
} from './MotionValueAdapter';

// Re-export useful Motion functions and types for convenience
export { animate, motionValue } from 'motion';
export type { AnimationPlaybackControls, SpringOptions, MotionValue } from 'motion';
