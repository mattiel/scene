/**
 * Spring presets for Scene animations
 * 
 * Pre-configured spring configurations for common UI patterns.
 * These match the Motion library's spring options format.
 */

import type { SpringOptions } from 'motion';

/**
 * Spring configuration for Motion animations
 */
export interface SpringConfig extends SpringOptions {
  type: 'spring';
}

/**
 * Create a spring configuration
 */
function spring(stiffness: number, damping: number, mass = 1): SpringConfig {
  return {
    type: 'spring',
    stiffness,
    damping,
    mass,
  };
}

/**
 * Pre-configured spring presets for Scene animations
 * 
 * @example
 * ```typescript
 * import { springs, SceneValue } from '@scene/motion';
 * 
 * const offset = new SceneValue(0);
 * offset.animateTo(500, springs.snappy);
 * ```
 */
export const springs = {
  /**
   * Default balanced spring
   * Good for most UI animations
   */
  default: spring(300, 30),

  /**
   * Quick, responsive spring
   * Good for toggles, tabs, small interactions
   */
  snappy: spring(500, 35),

  /**
   * Gentle, smooth spring
   * Good for page transitions, modals
   */
  smooth: spring(200, 25),

  /**
   * Playful spring with bounce
   * Good for attention-grabbing animations
   */
  bouncy: spring(400, 15),

  /**
   * Very quick, minimal overshoot
   * Good for micro-interactions
   */
  stiff: spring(700, 40),

  /**
   * Deliberate, slow spring
   * Good for background effects, parallax
   */
  slow: spring(100, 20),

  /**
   * Carousel-optimized spring
   * Balanced for card swiping with natural momentum
   */
  carousel: spring(350, 30),

  /**
   * Inertia-like spring
   * Low stiffness for momentum-based scrolling
   */
  inertia: spring(150, 25),

  /**
   * Material design spring
   * Matches Android's default animation curve
   */
  material: spring(400, 35),

  /**
   * iOS-like spring
   * Matches iOS UIKit's default spring
   */
  ios: spring(500, 30),

  // === New Phase 9 presets ===

  /**
   * High bounce spring
   * Maximum overshoot for playful, attention-grabbing animations
   */
  bounce: spring(450, 10),

  /**
   * Rubber-band spring
   * Elastic feel like stretching rubber, good for overscroll
   */
  rubber: spring(200, 12, 0.8),

  /**
   * Very stiff, almost instant
   * Near-instant response with minimal overshoot
   */
  rigid: spring(1000, 50),

  /**
   * Gentle settle spring
   * Very soft landing, good for dropping/placing items
   */
  settle: spring(180, 22),

  /**
   * Wobbly spring
   * Extended oscillation for playful jelly-like effects
   */
  wobbly: spring(300, 8),

  /**
   * Heavy spring
   * High mass feels weighty and deliberate
   */
  heavy: spring(300, 35, 2),

  /**
   * Light spring
   * Low mass feels airy and responsive
   */
  light: spring(400, 25, 0.5),

  /**
   * Snap spring
   * Sharp deceleration, good for snapping to positions
   */
  snap: spring(600, 45),

  /**
   * Fluid spring
   * Liquid-like motion, smooth without being slow
   */
  fluid: spring(250, 28),

  /**
   * Crisp spring
   * Clean, professional motion for UI elements
   */
  crisp: spring(550, 38),
} as const;

/**
 * Spring preset names
 */
export type SpringPreset = keyof typeof springs;

/**
 * Get a spring configuration by preset name
 * 
 * @param name - Name of the preset
 * @returns Spring configuration
 * 
 * @example
 * ```typescript
 * import { fromPreset, SceneValue } from '@scene/motion';
 * 
 * const value = new SceneValue(0);
 * value.animateTo(100, fromPreset('bouncy'));
 * 
 * // Dynamic preset selection
 * const preset = userPreference === 'playful' ? 'wobbly' : 'crisp';
 * value.animateTo(100, fromPreset(preset));
 * ```
 */
export function fromPreset(name: SpringPreset): SpringConfig {
  return springs[name];
}

/**
 * Create a custom spring configuration
 * 
 * @param stiffness - Spring stiffness (higher = faster)
 * @param damping - Damping ratio (higher = less bounce)
 * @param mass - Mass of the spring (higher = more inertia)
 * 
 * @example
 * ```typescript
 * import { createSpring, SceneValue } from '@scene/motion';
 * 
 * const mySpring = createSpring(600, 20, 1.5);
 * const value = new SceneValue(0);
 * value.animateTo(100, mySpring);
 * ```
 */
export function createSpring(
  stiffness: number,
  damping: number,
  mass = 1
): SpringConfig {
  return spring(stiffness, damping, mass);
}

/**
 * Tween/duration-based animation options
 */
export interface TweenConfig {
  type?: 'tween';
  duration: number;
  ease?: string | number[];
}

/**
 * Common easing presets as tween configurations
 */
export const tweens = {
  /**
   * Linear interpolation
   */
  linear: { duration: 0.3, ease: 'linear' } as TweenConfig,

  /**
   * Ease out quad - quick start, slow end
   */
  easeOut: { duration: 0.3, ease: 'easeOut' } as TweenConfig,

  /**
   * Ease in out - smooth start and end
   */
  easeInOut: { duration: 0.3, ease: 'easeInOut' } as TweenConfig,

  /**
   * Quick tween (150ms)
   */
  quick: { duration: 0.15, ease: 'easeOut' } as TweenConfig,

  /**
   * Slow tween (500ms)
   */
  slow: { duration: 0.5, ease: 'easeInOut' } as TweenConfig,
} as const;

/** Animation options - either spring or tween */
export type AnimationConfig = SpringConfig | TweenConfig;
