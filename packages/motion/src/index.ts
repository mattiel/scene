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
  createSceneValue,
  type ValueChangeCallback,
  type SceneValueOptions,
  type UniformTarget,
} from './SceneValue';

// Spring presets and configuration
export {
  springs,
  tweens,
  createSpring,
  type SpringConfig,
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

// Re-export useful Motion types for convenience
export type { AnimationPlaybackControls, SpringOptions } from 'motion';
