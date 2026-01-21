/**
 * Scrollable
 * 
 * 1D scroll controller with bounds, snap points, inertia, and wheel support.
 * Designed to work with Scene's input system and Motion values.
 */

import type { SceneValue } from '@scene/motion';

/**
 * Scrollable events
 */
export interface ScrollableEvents {
  /** Offset changed */
  change: { offset: number; velocity: number };
  /** Snapping started */
  snapStart: { from: number; to: number };
  /** Snapping completed */
  snapEnd: { offset: number };
  /** Reached a bound (min or max) */
  boundReached: { bound: 'min' | 'max'; offset: number };
}

/**
 * Event callback type
 */
export type ScrollableCallback<K extends keyof ScrollableEvents> = (
  payload: ScrollableEvents[K]
) => void;

/**
 * Scrollable configuration
 */
export interface ScrollableConfig {
  /** Initial offset (default: 0) */
  initialOffset?: number;
  /** Minimum offset bound */
  minOffset?: number;
  /** Maximum offset bound */
  maxOffset?: number;
  /** Snap points (positions to snap to) */
  snapPoints?: number[];
  /** Automatically snap to nearest point on release (default: false) */
  autoSnap?: boolean;
  /** Snap threshold - how close to a snap point before snapping (default: 50) */
  snapThreshold?: number;
  /** Drag sensitivity multiplier (default: 1) */
  dragSensitivity?: number;
  /** Wheel sensitivity multiplier (default: 0.025) */
  wheelSensitivity?: number;
  /** Wheel decay duration in ms (default: 800) */
  wheelDecayDuration?: number;
  /** Inertia friction (0-1, default: 0.92) */
  friction?: number;
  /** Minimum velocity to maintain inertia (default: 0.15) */
  minVelocity?: number;
  /** Reduced motion mode - faster animations, less inertia */
  reducedMotion?: boolean;
  /** Optional SceneValue to bind offset to */
  sceneValue?: SceneValue;
}

/**
 * Resolved config with defaults
 */
interface ResolvedConfig {
  initialOffset: number;
  minOffset: number;
  maxOffset: number;
  snapPoints: number[];
  autoSnap: boolean;
  snapThreshold: number;
  dragSensitivity: number;
  wheelSensitivity: number;
  wheelDecayDuration: number;
  friction: number;
  minVelocity: number;
  reducedMotion: boolean;
  sceneValue: SceneValue | undefined;
}

const DEFAULT_CONFIG: ResolvedConfig = {
  initialOffset: 0,
  minOffset: -Infinity,
  maxOffset: Infinity,
  snapPoints: [],
  autoSnap: false,
  snapThreshold: 50,
  dragSensitivity: 1,
  wheelSensitivity: 0.025,
  wheelDecayDuration: 800,
  friction: 0.92,
  minVelocity: 0.15,
  reducedMotion: false,
  sceneValue: undefined,
};

/**
 * Scrollable - 1D scroll controller
 */
export class Scrollable {
  private config: ResolvedConfig;
  private listeners: Map<keyof ScrollableEvents, Set<ScrollableCallback<keyof ScrollableEvents>>> = new Map();
  
  // State
  private _offset: number;
  private _velocity: number = 0;
  private _isDragging: boolean = false;
  
  // Wheel inertia state
  private lastWheelTime: number = 0;
  private wheelDecayActive: boolean = false;
  private wheelDecayStartTime: number = 0;
  private wheelInitialVelocity: number = 0;
  
  // Drag inertia state
  private dragInertiaActive: boolean = false;
  private dragDecayStartTime: number = 0;
  private dragInitialVelocity: number = 0;
  private dragStartOffset: number = 0;
  
  // Animation
  private animationId: number | null = null;
  private lastFrameTime: number = 0;
  
  // Snap animation state
  private isSnapping: boolean = false;
  private snapTargetOffset: number = 0;
  private snapStartOffset: number = 0;
  private snapStartTime: number = 0;
  private snapDuration: number = 300;

  constructor(config: ScrollableConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._offset = this.config.initialOffset;
    
    // Apply reduced motion adjustments
    if (this.config.reducedMotion) {
      this.config.friction = 0.75;
      this.config.wheelDecayDuration = 400;
    }
    
    // Sync initial value to SceneValue if provided
    this.syncToSceneValue();
  }

  // ============================================
  // Getters
  // ============================================

  /** Current offset */
  get offset(): number {
    return this._offset;
  }

  /** Current velocity */
  get velocity(): number {
    return this._velocity;
  }

  /** Whether currently dragging */
  get isDragging(): boolean {
    return this._isDragging;
  }

  /** Whether currently snapping */
  get snapping(): boolean {
    return this.isSnapping;
  }

  /** Whether inertia is active */
  get hasInertia(): boolean {
    return this.wheelDecayActive || this.dragInertiaActive;
  }

  // ============================================
  // Configuration
  // ============================================

  /**
   * Update configuration
   */
  setConfig(config: Partial<ScrollableConfig>): void {
    Object.assign(this.config, config);
    
    // Re-clamp offset if bounds changed
    const clamped = this.clampOffset(this._offset);
    if (clamped !== this._offset) {
      this.setOffset(clamped);
    }
  }

  /**
   * Set scroll bounds
   */
  setBounds(min: number, max: number): void {
    this.config.minOffset = min;
    this.config.maxOffset = max;
    
    // Re-clamp offset
    const clamped = this.clampOffset(this._offset);
    if (clamped !== this._offset) {
      this.setOffset(clamped);
    }
  }

  /**
   * Set snap points
   */
  setSnapPoints(points: number[]): void {
    this.config.snapPoints = [...points].sort((a, b) => a - b);
  }

  // ============================================
  // Offset Control
  // ============================================

  /**
   * Set offset directly (stops any animation)
   */
  setOffset(offset: number, emitEvent: boolean = true): void {
    this.stopAnimations();
    
    const clamped = this.clampOffset(offset);
    const changed = clamped !== this._offset;
    
    this._offset = clamped;
    this._velocity = 0;
    
    this.syncToSceneValue();
    
    if (changed && emitEvent) {
      this.emit('change', { offset: this._offset, velocity: 0 });
    }
    
    // Check bounds
    if (clamped === this.config.minOffset && offset < this.config.minOffset) {
      this.emit('boundReached', { bound: 'min', offset: clamped });
    } else if (clamped === this.config.maxOffset && offset > this.config.maxOffset) {
      this.emit('boundReached', { bound: 'max', offset: clamped });
    }
  }

  /**
   * Snap to a specific offset with animation
   */
  snapTo(targetOffset: number, duration?: number): void {
    this.stopAnimations();
    
    const clamped = this.clampOffset(targetOffset);
    
    if (clamped === this._offset) {
      return;
    }
    
    this.isSnapping = true;
    this.snapTargetOffset = clamped;
    this.snapStartOffset = this._offset;
    this.snapStartTime = performance.now();
    this.snapDuration = duration ?? (this.config.reducedMotion ? 200 : 300);
    
    this.emit('snapStart', { from: this._offset, to: clamped });
    
    this.startAnimation();
  }

  /**
   * Snap to the nearest snap point
   */
  snapToNearest(): void {
    const nearest = this.findNearestSnapPoint(this._offset);
    if (nearest !== null) {
      this.snapTo(nearest);
    }
  }

  /**
   * Find nearest snap point to a given offset
   */
  findNearestSnapPoint(offset: number): number | null {
    const { snapPoints } = this.config;
    if (snapPoints.length === 0) return null;
    
    let nearest = snapPoints[0];
    let minDistance = Math.abs(offset - nearest);
    
    for (const point of snapPoints) {
      const distance = Math.abs(offset - point);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = point;
      }
    }
    
    return nearest;
  }

  // ============================================
  // Input Handlers
  // ============================================

  /**
   * Handle drag start
   */
  handleDragStart(): void {
    this.stopAnimations();
    this._isDragging = true;
    this._velocity = 0;
  }

  /**
   * Handle drag movement
   */
  handleDrag(delta: number): void {
    const newOffset = this._offset + delta * this.config.dragSensitivity;
    const clamped = this.clampOffset(newOffset);
    
    // Track velocity for inertia
    this._velocity = delta * this.config.dragSensitivity;
    
    this._offset = clamped;
    this.syncToSceneValue();
    
    this.emit('change', { offset: this._offset, velocity: this._velocity });
  }

  /**
   * Handle drag end with optional inertia velocity
   */
  handleDragEnd(velocityX?: number): void {
    this._isDragging = false;
    
    // Use provided velocity or calculated velocity
    const velocity = velocityX ?? this._velocity;
    
    // Check if we should snap
    if (this.config.autoSnap) {
      const nearest = this.findNearestSnapPoint(this._offset);
      if (nearest !== null) {
        const distance = Math.abs(this._offset - nearest);
        if (distance < this.config.snapThreshold) {
          this.snapTo(nearest);
          return;
        }
      }
    }
    
    // Start inertia if velocity is significant
    if (Math.abs(velocity) > this.config.minVelocity) {
      this.startDragInertia(velocity);
    } else {
      this._velocity = 0;
      
      // Snap if auto-snap enabled
      if (this.config.autoSnap) {
        this.snapToNearest();
      }
    }
  }

  /**
   * Handle wheel input
   */
  handleWheel(delta: number): void {
    // Stop any active wheel decay when user resumes wheeling
    this.wheelDecayActive = false;
    this.isSnapping = false;
    
    const newOffset = this._offset + delta * this.config.wheelSensitivity;
    const clamped = this.clampOffset(newOffset);
    
    this._offset = clamped;
    this._velocity = delta * this.config.wheelSensitivity * 10;
    this.lastWheelTime = performance.now();
    
    this.syncToSceneValue();
    this.emit('change', { offset: this._offset, velocity: this._velocity });
    
    // Start animation loop to handle wheel decay
    this.startAnimation();
  }

  // ============================================
  // Animation
  // ============================================

  private startAnimation(): void {
    if (this.animationId !== null) return;
    
    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame(this.animate);
  }

  private stopAnimations(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    this.wheelDecayActive = false;
    this.dragInertiaActive = false;
    this.isSnapping = false;
    this._velocity = 0;
  }

  private animate = (): void => {
    const now = performance.now();
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;
    
    let shouldContinue = false;
    
    // Handle snap animation
    if (this.isSnapping) {
      shouldContinue = this.updateSnapAnimation(now);
    }
    // Handle wheel decay
    else if (this.handleWheelDecay(now, dt)) {
      shouldContinue = true;
    }
    // Handle drag inertia
    else if (this.dragInertiaActive) {
      shouldContinue = this.updateDragInertia(now);
    }
    
    if (shouldContinue) {
      this.animationId = requestAnimationFrame(this.animate);
    } else {
      this.animationId = null;
    }
  };

  private handleWheelDecay(now: number, _dt: number): boolean {
    const timeSinceWheel = now - this.lastWheelTime;
    
    // Start decay after 80ms of no wheel events
    if (timeSinceWheel > 80 && !this.wheelDecayActive && Math.abs(this._velocity) > 0.1 && !this._isDragging) {
      this.wheelDecayActive = true;
      this.wheelDecayStartTime = now;
      this.wheelInitialVelocity = this._velocity;
    }
    
    // Apply easeOutExpo decay
    if (this.wheelDecayActive) {
      const elapsed = now - this.wheelDecayStartTime;
      const t = Math.min(elapsed / this.config.wheelDecayDuration, 1);
      
      // Velocity decays as 2^(-10*t)
      const velocityMultiplier = Math.pow(2, -10 * t);
      this._velocity = this.wheelInitialVelocity * velocityMultiplier;
      
      this.emit('change', { offset: this._offset, velocity: this._velocity });
      
      if (t >= 1 || Math.abs(this._velocity) < 0.1) {
        this.wheelDecayActive = false;
        this._velocity = 0;
        
        // Snap after wheel decay if auto-snap enabled
        if (this.config.autoSnap) {
          this.snapToNearest();
          return this.isSnapping;
        }
        return false;
      }
      
      return true;
    }
    
    return false;
  }

  private startDragInertia(velocity: number): void {
    this.dragInertiaActive = true;
    this.dragDecayStartTime = performance.now();
    this.dragInitialVelocity = velocity;
    this.dragStartOffset = this._offset;
    this._velocity = velocity;
    
    this.startAnimation();
  }

  private updateDragInertia(now: number): boolean {
    const duration = this.config.reducedMotion ? 500 : 1000;
    const elapsed = now - this.dragDecayStartTime;
    const t = Math.min(elapsed / duration, 1);
    
    // EaseOutExpo decay
    const progress = this.easeOutExpo(t);
    
    // Calculate distance using integral of easeOutExpo velocity curve
    const decayFactor = 1 / (10 * Math.LN2);
    const totalDistance = this.dragInitialVelocity * duration * decayFactor;
    
    const prevOffset = this._offset;
    const newOffset = this.dragStartOffset + totalDistance * progress;
    const clamped = this.clampOffset(newOffset);
    
    this._offset = clamped;
    
    // Derive velocity from position change
    if (elapsed > 0) {
      this._velocity = (clamped - prevOffset) / Math.max(1, now - this.lastFrameTime);
    }
    
    this.syncToSceneValue();
    this.emit('change', { offset: this._offset, velocity: this._velocity });
    
    // Stop at bounds
    if (clamped !== newOffset) {
      this.dragInertiaActive = false;
      this._velocity = 0;
      
      if (this.config.autoSnap) {
        this.snapToNearest();
        return this.isSnapping;
      }
      return false;
    }
    
    // Check completion
    if (t >= 1 || Math.abs(this._velocity) < this.config.minVelocity) {
      this.dragInertiaActive = false;
      this._velocity = 0;
      
      if (this.config.autoSnap) {
        this.snapToNearest();
        return this.isSnapping;
      }
      return false;
    }
    
    return true;
  }

  private updateSnapAnimation(now: number): boolean {
    const elapsed = now - this.snapStartTime;
    const t = Math.min(elapsed / this.snapDuration, 1);
    
    // EaseOutExpo for smooth snap
    const progress = this.easeOutExpo(t);
    
    this._offset = this.snapStartOffset + (this.snapTargetOffset - this.snapStartOffset) * progress;
    this._velocity = 0;
    
    this.syncToSceneValue();
    this.emit('change', { offset: this._offset, velocity: 0 });
    
    if (t >= 1) {
      this._offset = this.snapTargetOffset;
      this.isSnapping = false;
      this.syncToSceneValue();
      this.emit('snapEnd', { offset: this._offset });
      return false;
    }
    
    return true;
  }

  // ============================================
  // Events
  // ============================================

  /**
   * Subscribe to an event
   */
  on<K extends keyof ScrollableEvents>(
    event: K,
    callback: ScrollableCallback<K>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    const listeners = this.listeners.get(event)!;
    listeners.add(callback as ScrollableCallback<keyof ScrollableEvents>);
    
    return () => {
      listeners.delete(callback as ScrollableCallback<keyof ScrollableEvents>);
    };
  }

  private emit<K extends keyof ScrollableEvents>(
    event: K,
    payload: ScrollableEvents[K]
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const callback of [...listeners]) {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in Scrollable "${event}" listener:`, error);
        }
      }
    }
  }

  // ============================================
  // Utilities
  // ============================================

  private clampOffset(offset: number): number {
    return Math.max(this.config.minOffset, Math.min(this.config.maxOffset, offset));
  }

  private easeOutExpo(t: number): number {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  private syncToSceneValue(): void {
    if (this.config.sceneValue) {
      this.config.sceneValue.set(this._offset);
    }
  }

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Destroy the Scrollable instance
   */
  destroy(): void {
    this.stopAnimations();
    this.listeners.clear();
  }
}
