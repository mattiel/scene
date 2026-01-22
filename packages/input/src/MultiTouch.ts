/**
 * MultiTouch
 *
 * Multi-touch gesture detection for pinch, rotate, and pan.
 * Tracks multiple pointers and calculates gesture state.
 */

import type { NormalizedPointer } from './PointerManager';

/**
 * Point with pointer metadata
 */
export interface TouchPoint {
  id: number;
  x: number;
  y: number;
  /** Touch pressure (0-1) */
  pressure: number;
  /** Pen tilt X in degrees (-90 to 90) */
  tiltX: number;
  /** Pen tilt Y in degrees (-90 to 90) */
  tiltY: number;
  /** Pen twist angle in degrees (0-359) */
  twist: number;
  timestamp: number;
}

/**
 * Multi-touch gesture state
 */
export interface MultiTouchState {
  /** Number of active touch points */
  touchCount: number;
  /** Whether a multi-touch gesture is active (2+ touches) */
  isActive: boolean;
  /** Center point of all touches */
  center: { x: number; y: number };
  /** Delta of center since last update */
  centerDelta: { x: number; y: number };
  /** Current distance between two touches (for pinch) */
  distance: number;
  /** Distance at gesture start */
  initialDistance: number;
  /** Scale factor relative to initial (1.0 = no scale) */
  scale: number;
  /** Delta scale since last update */
  scaleDelta: number;
  /** Current angle between two touches in radians */
  angle: number;
  /** Angle at gesture start */
  initialAngle: number;
  /** Rotation delta since gesture start in radians */
  rotation: number;
  /** Delta rotation since last update */
  rotationDelta: number;
  /** All active touch points */
  touches: TouchPoint[];
}

/**
 * Multi-touch event callbacks
 */
export interface MultiTouchCallbacks {
  /** Called when multi-touch gesture starts (2+ touches) */
  onMultiTouchStart?: (state: MultiTouchState) => void;
  /** Called on multi-touch gesture update */
  onMultiTouchMove?: (state: MultiTouchState) => void;
  /** Called when multi-touch gesture ends (< 2 touches) */
  onMultiTouchEnd?: (state: MultiTouchState) => void;
  /** Called on pinch gesture (scale changed significantly) */
  onPinch?: (state: MultiTouchState) => void;
  /** Called on rotate gesture (rotation changed significantly) */
  onRotate?: (state: MultiTouchState) => void;
}

/**
 * Multi-touch configuration
 */
export interface MultiTouchOptions {
  /** Minimum scale change to trigger onPinch (default: 0.01) */
  pinchThreshold?: number;
  /** Minimum rotation change in radians to trigger onRotate (default: 0.02 ~1.1 degrees) */
  rotationThreshold?: number;
}

const DEFAULT_OPTIONS: Required<MultiTouchOptions> = {
  pinchThreshold: 0.01,
  rotationThreshold: 0.02,
};

/**
 * MultiTouch - Multi-pointer gesture tracking
 */
export class MultiTouch {
  private options: Required<MultiTouchOptions>;
  private callbacks: MultiTouchCallbacks;
  
  // Active touch points
  private touches: Map<number, TouchPoint> = new Map();
  
  // Gesture state
  private state: MultiTouchState;
  private gestureActive: boolean = false;

  constructor(callbacks: MultiTouchCallbacks = {}, options: MultiTouchOptions = {}) {
    this.callbacks = callbacks;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.state = this.createInitialState();
  }

  /**
   * Create initial/reset state
   */
  private createInitialState(): MultiTouchState {
    return {
      touchCount: 0,
      isActive: false,
      center: { x: 0, y: 0 },
      centerDelta: { x: 0, y: 0 },
      distance: 0,
      initialDistance: 0,
      scale: 1,
      scaleDelta: 0,
      angle: 0,
      initialAngle: 0,
      rotation: 0,
      rotationDelta: 0,
      touches: [],
    };
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: Partial<MultiTouchCallbacks>): void {
    Object.assign(this.callbacks, callbacks);
  }

  /**
   * Update options
   */
  setOptions(options: Partial<MultiTouchOptions>): void {
    Object.assign(this.options, options);
  }

  /**
   * Convert NormalizedPointer to TouchPoint with extended data
   */
  private createTouchPoint(pointer: NormalizedPointer, event?: PointerEvent): TouchPoint {
    return {
      id: pointer.id,
      x: pointer.x,
      y: pointer.y,
      pressure: pointer.pressure,
      tiltX: event?.tiltX ?? 0,
      tiltY: event?.tiltY ?? 0,
      twist: event?.twist ?? 0,
      timestamp: pointer.timestamp,
    };
  }

  /**
   * Handle pointer down
   */
  handlePointerDown(pointer: NormalizedPointer, event?: PointerEvent): void {
    const touch = this.createTouchPoint(pointer, event);
    this.touches.set(pointer.id, touch);
    this.updateState();
    
    // Check if we just activated multi-touch
    if (this.touches.size >= 2 && !this.gestureActive) {
      this.gestureActive = true;
      this.initializeGestureState();
      this.callbacks.onMultiTouchStart?.(this.state);
    }
  }

  /**
   * Handle pointer move
   */
  handlePointerMove(pointer: NormalizedPointer, event?: PointerEvent): void {
    if (!this.touches.has(pointer.id)) {
      return;
    }
    
    const touch = this.createTouchPoint(pointer, event);
    this.touches.set(pointer.id, touch);
    
    if (this.gestureActive) {
      this.updateState();
      this.callbacks.onMultiTouchMove?.(this.state);
      
      // Check for specific gestures
      if (Math.abs(this.state.scaleDelta) >= this.options.pinchThreshold) {
        this.callbacks.onPinch?.(this.state);
      }
      if (Math.abs(this.state.rotationDelta) >= this.options.rotationThreshold) {
        this.callbacks.onRotate?.(this.state);
      }
    }
  }

  /**
   * Handle pointer up
   */
  handlePointerUp(pointer: NormalizedPointer): void {
    this.touches.delete(pointer.id);
    this.updateState();
    
    // Check if we just ended multi-touch
    if (this.touches.size < 2 && this.gestureActive) {
      this.gestureActive = false;
      this.callbacks.onMultiTouchEnd?.(this.state);
      this.resetGestureState();
    }
  }

  /**
   * Handle pointer cancel
   */
  handlePointerCancel(pointer: NormalizedPointer): void {
    this.handlePointerUp(pointer);
  }

  /**
   * Initialize gesture state when multi-touch begins
   */
  private initializeGestureState(): void {
    const touchArray = Array.from(this.touches.values());
    
    if (touchArray.length >= 2) {
      const [t1, t2] = touchArray;
      this.state.initialDistance = this.calculateDistance(t1, t2);
      this.state.initialAngle = this.calculateAngle(t1, t2);
      this.state.scale = 1;
      this.state.rotation = 0;
    }
  }

  /**
   * Reset gesture state when multi-touch ends
   */
  private resetGestureState(): void {
    this.state.initialDistance = 0;
    this.state.initialAngle = 0;
    this.state.scale = 1;
    this.state.rotation = 0;
  }

  /**
   * Update gesture state from current touches
   */
  private updateState(): void {
    const touchArray = Array.from(this.touches.values());
    
    // Store previous for delta calculation
    const prevCenter = { ...this.state.center };
    const prevScale = this.state.scale;
    const prevRotation = this.state.rotation;
    
    // Basic state
    this.state.touchCount = touchArray.length;
    this.state.isActive = touchArray.length >= 2;
    this.state.touches = touchArray;
    
    // Calculate center
    if (touchArray.length > 0) {
      const sumX = touchArray.reduce((sum, t) => sum + t.x, 0);
      const sumY = touchArray.reduce((sum, t) => sum + t.y, 0);
      this.state.center = {
        x: sumX / touchArray.length,
        y: sumY / touchArray.length,
      };
      this.state.centerDelta = {
        x: this.state.center.x - prevCenter.x,
        y: this.state.center.y - prevCenter.y,
      };
    }
    
    // Calculate two-finger gestures
    if (touchArray.length >= 2 && this.state.initialDistance > 0) {
      const [t1, t2] = touchArray;
      
      // Distance and scale
      this.state.distance = this.calculateDistance(t1, t2);
      this.state.scale = this.state.distance / this.state.initialDistance;
      this.state.scaleDelta = this.state.scale - prevScale;
      
      // Angle and rotation
      this.state.angle = this.calculateAngle(t1, t2);
      this.state.rotation = this.normalizeAngle(this.state.angle - this.state.initialAngle);
      this.state.rotationDelta = this.normalizeAngle(this.state.rotation - prevRotation);
    } else {
      this.state.distance = 0;
      this.state.scaleDelta = 0;
      this.state.rotationDelta = 0;
    }
  }

  /**
   * Calculate distance between two touch points
   */
  private calculateDistance(t1: TouchPoint, t2: TouchPoint): number {
    const dx = t2.x - t1.x;
    const dy = t2.y - t1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate angle between two touch points
   */
  private calculateAngle(t1: TouchPoint, t2: TouchPoint): number {
    return Math.atan2(t2.y - t1.y, t2.x - t1.x);
  }

  /**
   * Normalize angle to -PI to PI range
   */
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  /**
   * Get current gesture state
   */
  getState(): MultiTouchState {
    return { ...this.state, touches: [...this.state.touches] };
  }

  /**
   * Get active touch count
   */
  get touchCount(): number {
    return this.touches.size;
  }

  /**
   * Check if multi-touch gesture is active
   */
  get isActive(): boolean {
    return this.gestureActive;
  }

  /**
   * Get a specific touch point
   */
  getTouch(id: number): TouchPoint | undefined {
    return this.touches.get(id);
  }

  /**
   * Get all touch points
   */
  getTouches(): TouchPoint[] {
    return Array.from(this.touches.values());
  }

  /**
   * Clear all touches and reset state
   */
  clear(): void {
    if (this.gestureActive) {
      this.gestureActive = false;
      this.callbacks.onMultiTouchEnd?.(this.state);
    }
    this.touches.clear();
    this.state = this.createInitialState();
  }

  /**
   * Destroy the MultiTouch instance
   */
  destroy(): void {
    this.clear();
  }
}
