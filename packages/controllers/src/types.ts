/**
 * @scene/controllers - Shared Types
 * 
 * Generic type definitions for composable interaction controllers.
 * Inspired by motion library - primitives over implementations.
 */

// ============================================
// Base Types
// ============================================

/**
 * 2D point/position
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * 2D velocity vector
 */
export interface Velocity2D {
  x: number;
  y: number;
}

/**
 * 1D bounds constraint
 */
export interface Bounds1D {
  min?: number;
  max?: number;
}

/**
 * 2D bounds constraint
 */
export interface Bounds2D {
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
}

// ============================================
// Constraint Types
// ============================================

/**
 * Axis constraint for drag operations
 */
export type Axis = 'x' | 'y' | 'both';

/**
 * Snap point definition
 */
export interface SnapPoint {
  /** Position to snap to */
  position: number;
  /** Optional label/identifier */
  id?: string;
}

/**
 * Snap configuration
 */
export interface SnapConfig {
  /** Snap points */
  points: number[] | SnapPoint[];
  /** Distance threshold to trigger snap */
  threshold?: number;
  /** Velocity threshold - faster releases skip snap */
  velocityThreshold?: number;
}

// ============================================
// Inertia Configuration
// ============================================

/**
 * Inertia/momentum configuration
 */
export interface InertiaConfig {
  /** Enable inertia on release (default: true) */
  enabled?: boolean;
  /** Friction coefficient 0-1 (default: 0.92) */
  friction?: number;
  /** Minimum velocity to start inertia */
  minVelocity?: number;
  /** Maximum velocity cap */
  maxVelocity?: number;
  /** Decay duration in ms */
  duration?: number;
  /** Bounce coefficient at bounds 0-1 (default: 0) */
  bounce?: number;
}

// ============================================
// Controller State
// ============================================

/**
 * 1D controller state snapshot
 */
export interface State1D {
  /** Current offset/position */
  offset: number;
  /** Current velocity */
  velocity: number;
  /** Whether actively dragging */
  isDragging: boolean;
  /** Whether inertia is active */
  isAnimating: boolean;
}

/**
 * 2D controller state snapshot
 */
export interface State2D {
  /** Current position */
  position: Point;
  /** Current velocity */
  velocity: Velocity2D;
  /** Whether actively dragging */
  isDragging: boolean;
  /** Whether inertia is active */
  isAnimating: boolean;
}

// ============================================
// Event Types
// ============================================

/**
 * Generic change event for 1D controllers
 */
export interface ChangeEvent1D {
  /** Current offset */
  offset: number;
  /** Current velocity */
  velocity: number;
}

/**
 * Generic change event for 2D controllers
 */
export interface ChangeEvent2D {
  /** Current position */
  position: Point;
  /** Current velocity */
  velocity: Velocity2D;
}

/**
 * Snap event
 */
export interface SnapEvent {
  /** Starting position */
  from: number;
  /** Target position */
  to: number;
}

/**
 * Bound reached event
 */
export interface BoundEvent1D {
  /** Which bound */
  bound: 'min' | 'max';
  /** Position at bound */
  offset: number;
}

/**
 * Bound reached event for 2D
 */
export interface BoundEvent2D {
  /** Which bounds were hit */
  bounds: ('minX' | 'maxX' | 'minY' | 'maxY')[];
  /** Position at bounds */
  position: Point;
}

// ============================================
// Utility Types
// ============================================

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;

/**
 * Event callback
 */
export type EventCallback<T> = (event: T) => void;
