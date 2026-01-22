/**
 * TransitionTimeline
 *
 * Manages sequenced transitions with keyframes and easing.
 * Allows composing multiple transition effects over time.
 */

/// <reference types="@webgpu/types" />

import type { TransitionType, TransitionConfig } from './TransitionEffect';

/** Easing function type */
export type EasingFunction = (t: number) => number;

/** Built-in easing functions */
export const Easings = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - (--t) * t * t * t,
  easeInOutQuart: (t: number) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
  easeInExpo: (t: number) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
  easeOutExpo: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: (t: number) => {
    if (t === 0 || t === 1) return t;
    return t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2;
  },
  easeInBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutBack: (t: number) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
} as const;

/** Keyframe in the timeline */
export interface TransitionKeyframe {
  /** Time position (0-1 normalized to total duration) */
  time: number;
  /** Transition type at this keyframe */
  type: TransitionType;
  /** Transition config overrides */
  config?: Partial<TransitionConfig>;
  /** Easing to this keyframe */
  easing?: EasingFunction;
}

/** Timeline configuration */
export interface TransitionTimelineConfig {
  /** Total duration in milliseconds */
  duration: number;
  /** Keyframes defining the transition sequence */
  keyframes: TransitionKeyframe[];
  /** Default easing function */
  defaultEasing?: EasingFunction;
  /** Whether to loop */
  loop?: boolean;
  /** Callback when timeline completes */
  onComplete?: () => void;
  /** Callback on each frame */
  onUpdate?: (progress: number, type: TransitionType) => void;
}

/** Timeline state */
export type TimelineState = 'idle' | 'playing' | 'paused' | 'completed';

/**
 * TransitionTimeline - Sequence multiple transitions over time
 * 
 * @example
 * ```typescript
 * const timeline = new TransitionTimeline({
 *   duration: 2000,
 *   keyframes: [
 *     { time: 0, type: 'dissolve' },
 *     { time: 0.3, type: 'zoom', easing: Easings.easeOutBack },
 *     { time: 0.7, type: 'slide', config: { slideDirection: 'left' } },
 *     { time: 1, type: 'dissolve' },
 *   ],
 *   onUpdate: (progress, type) => {
 *     transitionEffect.setType(type);
 *     transitionEffect.setProgress(progress);
 *   },
 * });
 * 
 * timeline.play();
 * ```
 */
export class TransitionTimeline {
  private config: Required<TransitionTimelineConfig>;
  private state: TimelineState = 'idle';
  private startTime: number = 0;
  private pauseTime: number = 0;
  private currentProgress: number = 0;
  private currentKeyframeIndex: number = 0;
  private rafHandle: number | null = null;

  constructor(config: TransitionTimelineConfig) {
    // Sort keyframes by time
    const sortedKeyframes = [...config.keyframes].sort((a, b) => a.time - b.time);
    
    this.config = {
      duration: config.duration,
      keyframes: sortedKeyframes,
      defaultEasing: config.defaultEasing ?? Easings.easeInOut,
      loop: config.loop ?? false,
      onComplete: config.onComplete ?? (() => {}),
      onUpdate: config.onUpdate ?? (() => {}),
    };
  }

  /**
   * Start playing the timeline
   */
  play(): void {
    if (this.state === 'playing') return;

    if (this.state === 'paused') {
      // Resume from pause
      const pausedDuration = performance.now() - this.pauseTime;
      this.startTime += pausedDuration;
    } else {
      // Start fresh
      this.startTime = performance.now();
      this.currentProgress = 0;
      this.currentKeyframeIndex = 0;
    }

    this.state = 'playing';
    this.tick();
  }

  /**
   * Pause the timeline
   */
  pause(): void {
    if (this.state !== 'playing') return;
    
    this.state = 'paused';
    this.pauseTime = performance.now();
    
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  /**
   * Stop and reset the timeline
   */
  stop(): void {
    this.state = 'idle';
    this.currentProgress = 0;
    this.currentKeyframeIndex = 0;
    
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  /**
   * Seek to a specific time (0-1)
   */
  seek(normalizedTime: number): void {
    this.currentProgress = Math.max(0, Math.min(1, normalizedTime));
    this.updateKeyframeIndex();
    this.emitUpdate();
  }

  /**
   * Get current state
   */
  getState(): TimelineState {
    return this.state;
  }

  /**
   * Get current progress (0-1)
   */
  getProgress(): number {
    return this.currentProgress;
  }

  /**
   * Get current transition type
   */
  getCurrentType(): TransitionType {
    return this.config.keyframes[this.currentKeyframeIndex].type;
  }

  /**
   * Get current keyframe config
   */
  getCurrentConfig(): Partial<TransitionConfig> | undefined {
    return this.config.keyframes[this.currentKeyframeIndex].config;
  }

  /**
   * Internal tick function
   */
  private tick = (): void => {
    if (this.state !== 'playing') return;

    const elapsed = performance.now() - this.startTime;
    this.currentProgress = elapsed / this.config.duration;

    if (this.currentProgress >= 1) {
      if (this.config.loop) {
        this.currentProgress = this.currentProgress % 1;
        this.startTime = performance.now() - (this.currentProgress * this.config.duration);
      } else {
        this.currentProgress = 1;
        this.state = 'completed';
        this.emitUpdate();
        this.config.onComplete();
        return;
      }
    }

    this.updateKeyframeIndex();
    this.emitUpdate();

    this.rafHandle = requestAnimationFrame(this.tick);
  };

  /**
   * Update current keyframe index based on progress
   */
  private updateKeyframeIndex(): void {
    const keyframes = this.config.keyframes;
    
    for (let i = keyframes.length - 1; i >= 0; i--) {
      if (this.currentProgress >= keyframes[i].time) {
        this.currentKeyframeIndex = i;
        return;
      }
    }
    
    this.currentKeyframeIndex = 0;
  }

  /**
   * Emit update callback with interpolated progress
   */
  private emitUpdate(): void {
    const keyframes = this.config.keyframes;
    const currentKeyframe = keyframes[this.currentKeyframeIndex];
    const nextKeyframe = keyframes[this.currentKeyframeIndex + 1];
    
    // Calculate progress within current segment
    let segmentProgress: number;
    
    if (nextKeyframe) {
      const segmentStart = currentKeyframe.time;
      const segmentEnd = nextKeyframe.time;
      const rawProgress = (this.currentProgress - segmentStart) / (segmentEnd - segmentStart);
      
      // Apply easing
      const easing = nextKeyframe.easing ?? this.config.defaultEasing;
      segmentProgress = easing(Math.max(0, Math.min(1, rawProgress)));
    } else {
      // Last keyframe - progress within final segment
      segmentProgress = 1;
    }
    
    this.config.onUpdate(segmentProgress, currentKeyframe.type);
  }

  /**
   * Destroy the timeline
   */
  destroy(): void {
    this.stop();
  }
}

/**
 * Create a simple dissolve-in-out timeline
 */
export function createDissolveTimeline(
  duration: number,
  onUpdate: (progress: number, type: TransitionType) => void
): TransitionTimeline {
  return new TransitionTimeline({
    duration,
    keyframes: [
      { time: 0, type: 'dissolve' },
      { time: 1, type: 'dissolve' },
    ],
    onUpdate,
  });
}

/**
 * Create a slide-then-fade timeline
 */
export function createSlideFadeTimeline(
  duration: number,
  direction: 'left' | 'right' | 'up' | 'down',
  onUpdate: (progress: number, type: TransitionType) => void
): TransitionTimeline {
  return new TransitionTimeline({
    duration,
    keyframes: [
      { time: 0, type: 'slide', config: { slideDirection: direction } },
      { time: 0.7, type: 'dissolve', easing: Easings.easeOut },
      { time: 1, type: 'dissolve' },
    ],
    onUpdate,
  });
}

/**
 * Create a dramatic zoom transition timeline
 */
export function createDramaticZoomTimeline(
  duration: number,
  onUpdate: (progress: number, type: TransitionType) => void
): TransitionTimeline {
  return new TransitionTimeline({
    duration,
    keyframes: [
      { time: 0, type: 'fade_to_black' },
      { time: 0.4, type: 'zoom', config: { zoomAmount: 0.5 }, easing: Easings.easeInExpo },
      { time: 0.6, type: 'zoom', easing: Easings.easeOutExpo },
      { time: 1, type: 'dissolve', easing: Easings.easeOut },
    ],
    onUpdate,
  });
}
