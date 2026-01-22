/**
 * GestureRecognizer
 *
 * Recognizes discrete gestures: tap, double-tap, long-press, swipe.
 * Supports custom gesture definitions.
 */

import type { NormalizedPointer } from './PointerManager';

/**
 * Gesture types
 */
export type GestureType = 'tap' | 'doubleTap' | 'longPress' | 'swipe' | 'custom';

/**
 * Swipe direction
 */
export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

/**
 * Base gesture event
 */
export interface BaseGestureEvent {
  /** Gesture type */
  type: GestureType;
  /** Gesture name (for custom gestures) */
  name: string;
  /** Position where gesture started */
  startX: number;
  startY: number;
  /** Position where gesture ended */
  endX: number;
  endY: number;
  /** Gesture duration in ms */
  duration: number;
  /** Timestamp when gesture was recognized */
  timestamp: number;
  /** Number of pointers involved */
  pointerCount: number;
}

/**
 * Tap gesture event
 */
export interface TapGestureEvent extends BaseGestureEvent {
  type: 'tap';
  name: 'tap';
}

/**
 * Double tap gesture event
 */
export interface DoubleTapGestureEvent extends BaseGestureEvent {
  type: 'doubleTap';
  name: 'doubleTap';
}

/**
 * Long press gesture event
 */
export interface LongPressGestureEvent extends BaseGestureEvent {
  type: 'longPress';
  name: 'longPress';
}

/**
 * Swipe gesture event
 */
export interface SwipeGestureEvent extends BaseGestureEvent {
  type: 'swipe';
  name: 'swipe';
  /** Swipe direction */
  direction: SwipeDirection;
  /** Swipe velocity in px/ms */
  velocity: number;
  /** Total distance swiped */
  distance: number;
}

/**
 * Custom gesture event
 */
export interface CustomGestureEvent extends BaseGestureEvent {
  type: 'custom';
  /** Custom data from recognizer */
  data?: unknown;
}

/**
 * Union of all gesture events
 */
export type GestureEvent =
  | TapGestureEvent
  | DoubleTapGestureEvent
  | LongPressGestureEvent
  | SwipeGestureEvent
  | CustomGestureEvent;

/**
 * Gesture recognizer callbacks
 */
export interface GestureRecognizerCallbacks {
  /** Called when any gesture is recognized */
  onGesture?: (event: GestureEvent) => void;
  /** Called on tap */
  onTap?: (event: TapGestureEvent) => void;
  /** Called on double tap */
  onDoubleTap?: (event: DoubleTapGestureEvent) => void;
  /** Called on long press */
  onLongPress?: (event: LongPressGestureEvent) => void;
  /** Called on swipe */
  onSwipe?: (event: SwipeGestureEvent) => void;
}

/**
 * Gesture recognizer options
 */
export interface GestureRecognizerOptions {
  /** Maximum duration for tap in ms (default: 300) */
  tapMaxDuration?: number;
  /** Maximum movement for tap in px (default: 10) */
  tapMaxDistance?: number;
  /** Maximum time between taps for double-tap in ms (default: 300) */
  doubleTapMaxDelay?: number;
  /** Maximum distance between taps for double-tap in px (default: 40) */
  doubleTapMaxDistance?: number;
  /** Duration to trigger long press in ms (default: 500) */
  longPressDuration?: number;
  /** Maximum movement during long press in px (default: 10) */
  longPressMaxDistance?: number;
  /** Minimum velocity for swipe in px/ms (default: 0.3) */
  swipeMinVelocity?: number;
  /** Minimum distance for swipe in px (default: 30) */
  swipeMinDistance?: number;
  /** Enable tap recognition (default: true) */
  enableTap?: boolean;
  /** Enable double-tap recognition (default: true) */
  enableDoubleTap?: boolean;
  /** Enable long-press recognition (default: true) */
  enableLongPress?: boolean;
  /** Enable swipe recognition (default: true) */
  enableSwipe?: boolean;
}

const DEFAULT_OPTIONS: Required<GestureRecognizerOptions> = {
  tapMaxDuration: 300,
  tapMaxDistance: 10,
  doubleTapMaxDelay: 300,
  doubleTapMaxDistance: 40,
  longPressDuration: 500,
  longPressMaxDistance: 10,
  swipeMinVelocity: 0.3,
  swipeMinDistance: 30,
  enableTap: true,
  enableDoubleTap: true,
  enableLongPress: true,
  enableSwipe: true,
};

/**
 * Pointer sequence for tracking gesture candidates
 */
interface PointerSequence {
  id: number;
  startX: number;
  startY: number;
  startTime: number;
  currentX: number;
  currentY: number;
  maxDistance: number;
  velocitySamples: Array<{ x: number; y: number; time: number }>;
}

/**
 * Custom gesture definition
 */
export interface CustomGestureDefinition {
  /** Unique name for this gesture */
  name: string;
  /** 
   * Recognition function - receives pointer sequence and returns
   * whether gesture was recognized, plus optional data
   */
  recognize: (sequence: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    duration: number;
    maxDistance: number;
    velocity: { x: number; y: number };
  }) => { recognized: boolean; data?: unknown };
  /** Priority relative to built-in gestures (higher = checked first, default: 0) */
  priority?: number;
}

/**
 * GestureRecognizer - Discrete gesture detection
 */
export class GestureRecognizer {
  private options: Required<GestureRecognizerOptions>;
  private callbacks: GestureRecognizerCallbacks;
  
  // Active pointer sequences
  private sequences: Map<number, PointerSequence> = new Map();
  
  // Long press timer
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressPointerId: number | null = null;
  
  // Double tap tracking
  private lastTap: { x: number; y: number; time: number } | null = null;
  private tapTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTap: TapGestureEvent | null = null;
  
  // Custom gestures
  private customGestures: Map<string, CustomGestureDefinition> = new Map();
  
  // Long press fired flag (prevents tap after long press)
  private longPressFired: boolean = false;

  constructor(callbacks: GestureRecognizerCallbacks = {}, options: GestureRecognizerOptions = {}) {
    this.callbacks = callbacks;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: Partial<GestureRecognizerCallbacks>): void {
    Object.assign(this.callbacks, callbacks);
  }

  /**
   * Update options
   */
  setOptions(options: Partial<GestureRecognizerOptions>): void {
    Object.assign(this.options, options);
  }

  /**
   * Register a custom gesture
   */
  registerGesture(definition: CustomGestureDefinition): () => void {
    this.customGestures.set(definition.name, definition);
    return () => this.customGestures.delete(definition.name);
  }

  /**
   * Unregister a custom gesture
   */
  unregisterGesture(name: string): boolean {
    return this.customGestures.delete(name);
  }

  /**
   * Handle pointer down
   */
  handlePointerDown(pointer: NormalizedPointer): void {
    // Create new sequence
    const sequence: PointerSequence = {
      id: pointer.id,
      startX: pointer.x,
      startY: pointer.y,
      startTime: pointer.timestamp,
      currentX: pointer.x,
      currentY: pointer.y,
      maxDistance: 0,
      velocitySamples: [{ x: pointer.x, y: pointer.y, time: pointer.timestamp }],
    };
    
    this.sequences.set(pointer.id, sequence);
    
    // Start long press timer if enabled and primary pointer
    if (this.options.enableLongPress && pointer.isPrimary) {
      this.cancelLongPressTimer();
      this.longPressFired = false;
      this.longPressPointerId = pointer.id;
      this.longPressTimer = setTimeout(() => {
        this.checkLongPress(pointer.id);
      }, this.options.longPressDuration);
    }
  }

  /**
   * Handle pointer move
   */
  handlePointerMove(pointer: NormalizedPointer): void {
    const sequence = this.sequences.get(pointer.id);
    if (!sequence) return;
    
    // Update position
    sequence.currentX = pointer.x;
    sequence.currentY = pointer.y;
    
    // Track max distance from start
    const dx = pointer.x - sequence.startX;
    const dy = pointer.y - sequence.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    sequence.maxDistance = Math.max(sequence.maxDistance, distance);
    
    // Add velocity sample
    sequence.velocitySamples.push({ x: pointer.x, y: pointer.y, time: pointer.timestamp });
    // Keep last 5 samples
    if (sequence.velocitySamples.length > 5) {
      sequence.velocitySamples.shift();
    }
    
    // Cancel long press if moved too far
    if (distance > this.options.longPressMaxDistance && this.longPressPointerId === pointer.id) {
      this.cancelLongPressTimer();
    }
  }

  /**
   * Handle pointer up
   */
  handlePointerUp(pointer: NormalizedPointer): void {
    const sequence = this.sequences.get(pointer.id);
    if (!sequence) return;
    
    // Cancel long press timer
    if (this.longPressPointerId === pointer.id) {
      this.cancelLongPressTimer();
    }
    
    const duration = pointer.timestamp - sequence.startTime;
    const velocity = this.calculateVelocity(sequence);
    
    // Don't recognize tap/swipe if long press was fired
    if (!this.longPressFired) {
      // Check custom gestures first (sorted by priority)
      const customRecognized = this.checkCustomGestures(sequence, duration, velocity);
      
      if (!customRecognized) {
        // Check built-in gestures
        this.checkSwipe(sequence, duration, velocity);
        this.checkTap(sequence, duration, pointer);
      }
    }
    
    // Clean up
    this.sequences.delete(pointer.id);
    if (this.longPressPointerId === pointer.id) {
      this.longPressFired = false;
    }
  }

  /**
   * Handle pointer cancel
   */
  handlePointerCancel(pointer: NormalizedPointer): void {
    // Cancel any pending recognitions
    if (this.longPressPointerId === pointer.id) {
      this.cancelLongPressTimer();
      this.longPressFired = false;
    }
    
    this.sequences.delete(pointer.id);
  }

  /**
   * Calculate velocity from samples
   */
  private calculateVelocity(sequence: PointerSequence): { x: number; y: number; magnitude: number } {
    const samples = sequence.velocitySamples;
    if (samples.length < 2) {
      return { x: 0, y: 0, magnitude: 0 };
    }
    
    // Use last two samples for velocity
    const last = samples[samples.length - 1];
    const prev = samples[samples.length - 2];
    const dt = last.time - prev.time;
    
    if (dt <= 0) {
      return { x: 0, y: 0, magnitude: 0 };
    }
    
    const vx = (last.x - prev.x) / dt;
    const vy = (last.y - prev.y) / dt;
    
    return {
      x: vx,
      y: vy,
      magnitude: Math.sqrt(vx * vx + vy * vy),
    };
  }

  /**
   * Check for long press
   */
  private checkLongPress(pointerId: number): void {
    const sequence = this.sequences.get(pointerId);
    if (!sequence) return;
    
    // Verify we haven't moved too far
    if (sequence.maxDistance <= this.options.longPressMaxDistance) {
      this.longPressFired = true;
      
      const event: LongPressGestureEvent = {
        type: 'longPress',
        name: 'longPress',
        startX: sequence.startX,
        startY: sequence.startY,
        endX: sequence.currentX,
        endY: sequence.currentY,
        duration: this.options.longPressDuration,
        timestamp: performance.now(),
        pointerCount: this.sequences.size,
      };
      
      this.emitGesture(event);
      this.callbacks.onLongPress?.(event);
    }
    
    this.longPressTimer = null;
    this.longPressPointerId = null;
  }

  /**
   * Cancel long press timer
   */
  private cancelLongPressTimer(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressPointerId = null;
  }

  /**
   * Check for tap/double-tap
   */
  private checkTap(
    sequence: PointerSequence,
    duration: number,
    pointer: NormalizedPointer
  ): void {
    if (!this.options.enableTap) return;
    
    // Must be quick and not move much
    if (duration > this.options.tapMaxDuration) return;
    if (sequence.maxDistance > this.options.tapMaxDistance) return;
    
    const now = pointer.timestamp;
    
    // Check for double tap
    if (this.options.enableDoubleTap && this.lastTap) {
      const timeSinceLastTap = now - this.lastTap.time;
      const dx = sequence.startX - this.lastTap.x;
      const dy = sequence.startY - this.lastTap.y;
      const distanceFromLastTap = Math.sqrt(dx * dx + dy * dy);
      
      if (
        timeSinceLastTap <= this.options.doubleTapMaxDelay &&
        distanceFromLastTap <= this.options.doubleTapMaxDistance
      ) {
        // Double tap detected
        this.cancelTapTimer();
        this.lastTap = null;
        
        const event: DoubleTapGestureEvent = {
          type: 'doubleTap',
          name: 'doubleTap',
          startX: sequence.startX,
          startY: sequence.startY,
          endX: sequence.currentX,
          endY: sequence.currentY,
          duration,
          timestamp: now,
          pointerCount: 1,
        };
        
        this.emitGesture(event);
        this.callbacks.onDoubleTap?.(event);
        return;
      }
    }
    
    // Prepare tap event
    const tapEvent: TapGestureEvent = {
      type: 'tap',
      name: 'tap',
      startX: sequence.startX,
      startY: sequence.startY,
      endX: sequence.currentX,
      endY: sequence.currentY,
      duration,
      timestamp: now,
      pointerCount: 1,
    };
    
    // If double-tap is enabled, delay tap emission
    if (this.options.enableDoubleTap) {
      this.cancelTapTimer();
      this.pendingTap = tapEvent;
      this.lastTap = { x: sequence.startX, y: sequence.startY, time: now };
      
      this.tapTimer = setTimeout(() => {
        if (this.pendingTap) {
          this.emitGesture(this.pendingTap);
          this.callbacks.onTap?.(this.pendingTap);
          this.pendingTap = null;
        }
        this.lastTap = null;
      }, this.options.doubleTapMaxDelay);
    } else {
      // Emit immediately
      this.emitGesture(tapEvent);
      this.callbacks.onTap?.(tapEvent);
    }
  }

  /**
   * Cancel pending tap timer
   */
  private cancelTapTimer(): void {
    if (this.tapTimer !== null) {
      clearTimeout(this.tapTimer);
      this.tapTimer = null;
    }
    this.pendingTap = null;
  }

  /**
   * Check for swipe
   */
  private checkSwipe(
    sequence: PointerSequence,
    duration: number,
    velocity: { x: number; y: number; magnitude: number }
  ): void {
    if (!this.options.enableSwipe) return;
    
    // Must have sufficient velocity and distance
    if (velocity.magnitude < this.options.swipeMinVelocity) return;
    
    const dx = sequence.currentX - sequence.startX;
    const dy = sequence.currentY - sequence.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < this.options.swipeMinDistance) return;
    
    // Determine direction
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    let direction: SwipeDirection;
    
    if (absX > absY) {
      direction = dx > 0 ? 'right' : 'left';
    } else {
      direction = dy > 0 ? 'down' : 'up';
    }
    
    const event: SwipeGestureEvent = {
      type: 'swipe',
      name: 'swipe',
      startX: sequence.startX,
      startY: sequence.startY,
      endX: sequence.currentX,
      endY: sequence.currentY,
      duration,
      timestamp: performance.now(),
      pointerCount: 1,
      direction,
      velocity: velocity.magnitude,
      distance,
    };
    
    this.emitGesture(event);
    this.callbacks.onSwipe?.(event);
  }

  /**
   * Check custom gestures
   */
  private checkCustomGestures(
    sequence: PointerSequence,
    duration: number,
    velocity: { x: number; y: number; magnitude: number }
  ): boolean {
    // Sort by priority (higher first)
    const sorted = Array.from(this.customGestures.values())
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    
    for (const gesture of sorted) {
      const result = gesture.recognize({
        startX: sequence.startX,
        startY: sequence.startY,
        endX: sequence.currentX,
        endY: sequence.currentY,
        duration,
        maxDistance: sequence.maxDistance,
        velocity: { x: velocity.x, y: velocity.y },
      });
      
      if (result.recognized) {
        const event: CustomGestureEvent = {
          type: 'custom',
          name: gesture.name,
          startX: sequence.startX,
          startY: sequence.startY,
          endX: sequence.currentX,
          endY: sequence.currentY,
          duration,
          timestamp: performance.now(),
          pointerCount: 1,
          data: result.data,
        };
        
        this.emitGesture(event);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Emit gesture to generic callback
   */
  private emitGesture(event: GestureEvent): void {
    this.callbacks.onGesture?.(event);
  }

  /**
   * Get active sequence count
   */
  get sequenceCount(): number {
    return this.sequences.size;
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.cancelLongPressTimer();
    this.cancelTapTimer();
    this.sequences.clear();
    this.lastTap = null;
    this.longPressFired = false;
  }

  /**
   * Destroy the recognizer
   */
  destroy(): void {
    this.clear();
    this.customGestures.clear();
  }
}
