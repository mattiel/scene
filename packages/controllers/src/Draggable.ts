/**
 * Draggable
 * 
 * 2D drag controller with bounds, constraints, and inertia.
 * Provides position control for freely-draggable elements.
 */

import type { SceneValue2D } from '@scene/motion';

/**
 * 2D position
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * 2D velocity
 */
export interface Velocity {
  x: number;
  y: number;
}

/**
 * Bounds for constraining drag
 */
export interface DraggableBounds {
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
}

/**
 * Draggable events
 */
export interface DraggableEvents {
  /** Position changed */
  change: { position: Position; velocity: Velocity };
  /** Drag started */
  dragStart: { position: Position };
  /** Drag ended */
  dragEnd: { position: Position; velocity: Velocity };
  /** Reached a bound */
  boundReached: { bounds: ('minX' | 'maxX' | 'minY' | 'maxY')[]; position: Position };
}

/**
 * Event callback type
 */
export type DraggableCallback<K extends keyof DraggableEvents> = (
  payload: DraggableEvents[K]
) => void;

/**
 * Axis constraint
 */
export type DragAxis = 'x' | 'y' | 'both';

/**
 * Draggable configuration
 */
export interface DraggableConfig {
  /** Initial position (default: { x: 0, y: 0 }) */
  initialPosition?: Position;
  /** Bounds for constraining drag */
  bounds?: DraggableBounds;
  /** Constrain drag to a specific axis (default: 'both') */
  axis?: DragAxis;
  /** Drag sensitivity multiplier (default: 1) */
  sensitivity?: number;
  /** Enable inertia on release (default: true) */
  enableInertia?: boolean;
  /** Inertia friction (0-1, default: 0.92) */
  friction?: number;
  /** Minimum velocity to maintain inertia (default: 0.1) */
  minVelocity?: number;
  /** Inertia decay duration in ms (default: 1000) */
  decayDuration?: number;
  /** Bounce coefficient when hitting bounds (0-1, default: 0) */
  bounce?: number;
  /** Reduced motion mode */
  reducedMotion?: boolean;
  /** Optional SceneValue2D to bind position to */
  sceneValue?: SceneValue2D;
}

/**
 * Resolved config with defaults
 */
interface ResolvedConfig {
  initialPosition: Position;
  bounds: DraggableBounds;
  axis: DragAxis;
  sensitivity: number;
  enableInertia: boolean;
  friction: number;
  minVelocity: number;
  decayDuration: number;
  bounce: number;
  reducedMotion: boolean;
  sceneValue: SceneValue2D | undefined;
}

const DEFAULT_CONFIG: ResolvedConfig = {
  initialPosition: { x: 0, y: 0 },
  bounds: {},
  axis: 'both',
  sensitivity: 1,
  enableInertia: true,
  friction: 0.92,
  minVelocity: 0.1,
  decayDuration: 1000,
  bounce: 0,
  reducedMotion: false,
  sceneValue: undefined,
};

/**
 * Draggable - 2D drag controller
 */
export class Draggable {
  private config: ResolvedConfig;
  private listeners: Map<keyof DraggableEvents, Set<DraggableCallback<keyof DraggableEvents>>> = new Map();
  
  // State
  private _position: Position;
  private _velocity: Velocity = { x: 0, y: 0 };
  private _isDragging: boolean = false;
  
  // Inertia state
  private inertiaActive: boolean = false;
  private inertiaStartTime: number = 0;
  private initialVelocity: Velocity = { x: 0, y: 0 };
  private startPosition: Position = { x: 0, y: 0 };
  
  // Animation
  private animationId: number | null = null;
  private lastFrameTime: number = 0;

  constructor(config: DraggableConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      initialPosition: config.initialPosition ?? DEFAULT_CONFIG.initialPosition,
      bounds: config.bounds ?? DEFAULT_CONFIG.bounds,
    };
    
    this._position = { ...this.config.initialPosition };
    
    // Apply reduced motion adjustments
    if (this.config.reducedMotion) {
      this.config.decayDuration = 500;
    }
    
    this.syncToSceneValue();
  }

  // ============================================
  // Getters
  // ============================================

  /** Current position */
  get position(): Position {
    return { ...this._position };
  }

  /** Current X position */
  get x(): number {
    return this._position.x;
  }

  /** Current Y position */
  get y(): number {
    return this._position.y;
  }

  /** Current velocity */
  get velocity(): Velocity {
    return { ...this._velocity };
  }

  /** Whether currently dragging */
  get isDragging(): boolean {
    return this._isDragging;
  }

  /** Whether inertia is active */
  get hasInertia(): boolean {
    return this.inertiaActive;
  }

  // ============================================
  // Configuration
  // ============================================

  /**
   * Update configuration
   */
  setConfig(config: Partial<DraggableConfig>): void {
    if (config.bounds) {
      this.config.bounds = { ...this.config.bounds, ...config.bounds };
    }
    if (config.initialPosition) {
      this.config.initialPosition = { ...config.initialPosition };
    }
    
    const { bounds, initialPosition, ...rest } = config;
    Object.assign(this.config, rest);
    
    // Re-clamp position if bounds changed
    const clamped = this.clampPosition(this._position);
    if (clamped.x !== this._position.x || clamped.y !== this._position.y) {
      this.setPosition(clamped);
    }
  }

  /**
   * Set bounds
   */
  setBounds(bounds: DraggableBounds): void {
    this.config.bounds = { ...this.config.bounds, ...bounds };
    
    // Re-clamp position
    const clamped = this.clampPosition(this._position);
    if (clamped.x !== this._position.x || clamped.y !== this._position.y) {
      this.setPosition(clamped);
    }
  }

  // ============================================
  // Position Control
  // ============================================

  /**
   * Set position directly (stops any animation)
   */
  setPosition(position: Position, emitEvent: boolean = true): void {
    this.stopAnimations();
    
    const clamped = this.clampPosition(position);
    const changed = clamped.x !== this._position.x || clamped.y !== this._position.y;
    
    this._position = clamped;
    this._velocity = { x: 0, y: 0 };
    
    this.syncToSceneValue();
    
    if (changed && emitEvent) {
      this.emit('change', { position: this.position, velocity: this.velocity });
    }
    
    // Check bounds
    this.checkBoundReached(position, clamped);
  }

  /**
   * Move by delta
   */
  moveBy(delta: Position): void {
    this.setPosition({
      x: this._position.x + delta.x,
      y: this._position.y + delta.y,
    });
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
    this._velocity = { x: 0, y: 0 };
    
    this.emit('dragStart', { position: this.position });
  }

  /**
   * Handle drag movement
   */
  handleDrag(deltaX: number, deltaY: number): void {
    const sensitivity = this.config.sensitivity;
    
    // Apply axis constraint
    let dx = deltaX * sensitivity;
    let dy = deltaY * sensitivity;
    
    if (this.config.axis === 'x') {
      dy = 0;
    } else if (this.config.axis === 'y') {
      dx = 0;
    }
    
    const newPosition = {
      x: this._position.x + dx,
      y: this._position.y + dy,
    };
    
    const clamped = this.clampPosition(newPosition);
    
    // Track velocity
    this._velocity = { x: dx, y: dy };
    
    this._position = clamped;
    this.syncToSceneValue();
    
    this.emit('change', { position: this.position, velocity: this.velocity });
  }

  /**
   * Handle drag end with optional inertia velocity
   */
  handleDragEnd(velocityX?: number, velocityY?: number): void {
    this._isDragging = false;
    
    const velocity: Velocity = {
      x: velocityX ?? this._velocity.x,
      y: velocityY ?? this._velocity.y,
    };
    
    // Apply axis constraint to velocity
    if (this.config.axis === 'x') {
      velocity.y = 0;
    } else if (this.config.axis === 'y') {
      velocity.x = 0;
    }
    
    this.emit('dragEnd', { position: this.position, velocity });
    
    // Start inertia if enabled and velocity is significant
    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
    if (this.config.enableInertia && speed > this.config.minVelocity) {
      this.startInertia(velocity);
    } else {
      this._velocity = { x: 0, y: 0 };
    }
  }

  // ============================================
  // Animation
  // ============================================

  private startInertia(velocity: Velocity): void {
    this.inertiaActive = true;
    this.inertiaStartTime = performance.now();
    this.initialVelocity = { ...velocity };
    this.startPosition = { ...this._position };
    this._velocity = { ...velocity };
    
    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame(this.animate);
  }

  private stopAnimations(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    this.inertiaActive = false;
    this._velocity = { x: 0, y: 0 };
  }

  private animate = (): void => {
    if (!this.inertiaActive) {
      this.animationId = null;
      return;
    }
    
    const now = performance.now();
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;
    
    const elapsed = now - this.inertiaStartTime;
    const duration = this.config.decayDuration;
    const t = Math.min(elapsed / duration, 1);
    
    // EaseOutExpo decay
    const progress = this.easeOutExpo(t);
    
    // Calculate distance using integral of easeOutExpo velocity curve
    const decayFactor = 1 / (10 * Math.LN2);
    const totalDistanceX = this.initialVelocity.x * duration * decayFactor;
    const totalDistanceY = this.initialVelocity.y * duration * decayFactor;
    
    const prevPosition = { ...this._position };
    const newPosition = {
      x: this.startPosition.x + totalDistanceX * progress,
      y: this.startPosition.y + totalDistanceY * progress,
    };
    
    const clamped = this.clampPosition(newPosition);
    this._position = clamped;
    
    // Derive velocity from position change
    if (dt > 0) {
      this._velocity = {
        x: (clamped.x - prevPosition.x) / dt,
        y: (clamped.y - prevPosition.y) / dt,
      };
    }
    
    this.syncToSceneValue();
    this.emit('change', { position: this.position, velocity: this.velocity });
    
    // Check if we hit bounds
    const hitBoundX = clamped.x !== newPosition.x;
    const hitBoundY = clamped.y !== newPosition.y;
    
    if (hitBoundX || hitBoundY) {
      // Apply bounce if configured
      if (this.config.bounce > 0) {
        if (hitBoundX) {
          this.initialVelocity.x = -this.initialVelocity.x * this.config.bounce;
          this.startPosition.x = clamped.x;
        }
        if (hitBoundY) {
          this.initialVelocity.y = -this.initialVelocity.y * this.config.bounce;
          this.startPosition.y = clamped.y;
        }
        this.inertiaStartTime = now;
      } else {
        // Stop at bounds
        this.inertiaActive = false;
        this._velocity = { x: 0, y: 0 };
        this.animationId = null;
        
        this.checkBoundReached(newPosition, clamped);
        return;
      }
    }
    
    // Check completion
    const speed = Math.sqrt(this._velocity.x ** 2 + this._velocity.y ** 2);
    if (t >= 1 || speed < this.config.minVelocity) {
      this.inertiaActive = false;
      this._velocity = { x: 0, y: 0 };
      this.animationId = null;
      return;
    }
    
    this.animationId = requestAnimationFrame(this.animate);
  };

  // ============================================
  // Events
  // ============================================

  /**
   * Subscribe to an event
   */
  on<K extends keyof DraggableEvents>(
    event: K,
    callback: DraggableCallback<K>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    const listeners = this.listeners.get(event)!;
    listeners.add(callback as DraggableCallback<keyof DraggableEvents>);
    
    return () => {
      listeners.delete(callback as DraggableCallback<keyof DraggableEvents>);
    };
  }

  private emit<K extends keyof DraggableEvents>(
    event: K,
    payload: DraggableEvents[K]
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const callback of [...listeners]) {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in Draggable "${event}" listener:`, error);
        }
      }
    }
  }

  // ============================================
  // Utilities
  // ============================================

  private clampPosition(position: Position): Position {
    const { bounds, axis } = this.config;
    
    let x = position.x;
    let y = position.y;
    
    if (axis !== 'y') {
      if (bounds.minX !== undefined) x = Math.max(bounds.minX, x);
      if (bounds.maxX !== undefined) x = Math.min(bounds.maxX, x);
    }
    
    if (axis !== 'x') {
      if (bounds.minY !== undefined) y = Math.max(bounds.minY, y);
      if (bounds.maxY !== undefined) y = Math.min(bounds.maxY, y);
    }
    
    return { x, y };
  }

  private checkBoundReached(original: Position, clamped: Position): void {
    const { bounds } = this.config;
    const hitBounds: ('minX' | 'maxX' | 'minY' | 'maxY')[] = [];
    
    if (bounds.minX !== undefined && original.x < bounds.minX) hitBounds.push('minX');
    if (bounds.maxX !== undefined && original.x > bounds.maxX) hitBounds.push('maxX');
    if (bounds.minY !== undefined && original.y < bounds.minY) hitBounds.push('minY');
    if (bounds.maxY !== undefined && original.y > bounds.maxY) hitBounds.push('maxY');
    
    if (hitBounds.length > 0) {
      this.emit('boundReached', { bounds: hitBounds, position: clamped });
    }
  }

  private easeOutExpo(t: number): number {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  private syncToSceneValue(): void {
    if (this.config.sceneValue) {
      this.config.sceneValue.set(this._position.x, this._position.y);
    }
  }

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Destroy the Draggable instance
   */
  destroy(): void {
    this.stopAnimations();
    this.listeners.clear();
  }
}
