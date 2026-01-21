/**
 * @scene/controllers - Shared Types
 * 
 * Common type definitions for all controller implementations.
 */

import type { SceneValue } from '@scene/motion';

// ============================================
// Base Types
// ============================================

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
 * 1D bounds
 */
export interface Bounds1D {
  min?: number;
  max?: number;
}

/**
 * 2D bounds
 */
export interface Bounds2D {
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
}

// ============================================
// Event System
// ============================================

/**
 * Base event payload - all events include timestamp
 */
export interface BaseEventPayload {
  /** Event timestamp (performance.now()) */
  timestamp: number;
}

/**
 * Change event payload for 1D controllers
 */
export interface Change1DPayload extends BaseEventPayload {
  /** Current offset value */
  offset: number;
  /** Current velocity */
  velocity: number;
}

/**
 * Change event payload for 2D controllers
 */
export interface Change2DPayload extends BaseEventPayload {
  /** Current position */
  position: Position;
  /** Current velocity */
  velocity: Velocity;
}

/**
 * Drag start event payload
 */
export interface DragStartPayload extends BaseEventPayload {
  /** Position/offset at drag start */
  position: Position | number;
}

/**
 * Drag end event payload for 1D
 */
export interface DragEnd1DPayload extends BaseEventPayload {
  /** Final offset */
  offset: number;
  /** Velocity at release */
  velocity: number;
}

/**
 * Drag end event payload for 2D
 */
export interface DragEnd2DPayload extends BaseEventPayload {
  /** Final position */
  position: Position;
  /** Velocity at release */
  velocity: Velocity;
}

/**
 * Snap event payload
 */
export interface SnapPayload extends BaseEventPayload {
  /** Starting position/offset */
  from: number;
  /** Target position/offset */
  to: number;
}

/**
 * Snap end event payload
 */
export interface SnapEndPayload extends BaseEventPayload {
  /** Final position/offset */
  offset: number;
}

/**
 * Bound reached event payload for 1D
 */
export interface BoundReached1DPayload extends BaseEventPayload {
  /** Which bound was reached */
  bound: 'min' | 'max';
  /** Offset at bound */
  offset: number;
}

/**
 * Bound reached event payload for 2D
 */
export interface BoundReached2DPayload extends BaseEventPayload {
  /** Which bounds were reached */
  bounds: ('minX' | 'maxX' | 'minY' | 'maxY')[];
  /** Position at bound */
  position: Position;
}

// ============================================
// Controller Interfaces
// ============================================

/**
 * Base controller interface
 * All controllers implement these common methods
 */
export interface BaseController {
  /** Whether currently dragging */
  readonly isDragging: boolean;
  /** Whether inertia/animation is active */
  readonly hasInertia: boolean;
  /** Handle drag start */
  handleDragStart(): void;
  /** Destroy the controller and clean up */
  destroy(): void;
}

/**
 * 1D controller interface (Scrollable, Carousel)
 */
export interface Controller1D extends BaseController {
  /** Current offset */
  readonly offset: number;
  /** Current velocity */
  readonly velocity: number;
  /** Set offset directly */
  setOffset(offset: number): void;
  /** Snap to target */
  snapTo(target: number): void;
  /** Handle drag delta */
  handleDrag(delta: number): void;
  /** Handle drag end */
  handleDragEnd(velocity?: number): void;
}

/**
 * 2D controller interface (Draggable)
 */
export interface Controller2D extends BaseController {
  /** Current position */
  readonly position: Position;
  /** Current velocity */
  readonly velocity: Velocity;
  /** Set position directly */
  setPosition(position: Position): void;
  /** Handle drag delta */
  handleDrag(deltaX: number, deltaY: number): void;
  /** Handle drag end */
  handleDragEnd(velocityX?: number, velocityY?: number): void;
}

// ============================================
// Carousel Controller Interface
// ============================================

/**
 * Carousel item state
 */
export interface CarouselItemState<T = unknown> {
  /** Item data */
  data: T;
  /** Current index in the carousel */
  index: number;
  /** Visual offset from center (in units) */
  offset: number;
  /** Whether this is the active/center item */
  isActive: boolean;
  /** Whether this item is visible */
  isVisible: boolean;
  /** Progress through the carousel (0-1) */
  progress: number;
}

/**
 * Carousel controller events
 */
export interface CarouselEvents<T = unknown> {
  /** Carousel offset changed */
  change: Change1DPayload & { activeIndex: number };
  /** Active item changed */
  indexChange: BaseEventPayload & { 
    index: number; 
    previousIndex: number;
    item: T;
  };
  /** Snap started */
  snapStart: SnapPayload;
  /** Snap completed */
  snapEnd: SnapEndPayload & { index: number };
  /** Reached start or end of carousel */
  boundReached: BoundReached1DPayload;
}

/**
 * Carousel controller configuration
 */
export interface CarouselConfig<T = unknown> {
  /** Items in the carousel */
  items: T[];
  /** Initial active index */
  initialIndex?: number;
  /** Loop continuously */
  loop?: boolean;
  /** Drag sensitivity */
  dragSensitivity?: number;
  /** Wheel sensitivity */
  wheelSensitivity?: number;
  /** Auto-snap to nearest item */
  autoSnap?: boolean;
  /** SceneValue to bind offset */
  sceneValue?: SceneValue;
  /** Reduced motion mode */
  reducedMotion?: boolean;
}

/**
 * Generic carousel controller interface
 * 
 * @template T - Type of items in the carousel
 */
export interface CarouselController<T = unknown> extends Controller1D {
  /** Total number of items */
  readonly itemCount: number;
  /** Currently active index */
  readonly activeIndex: number;
  /** Get state for all visible items */
  getVisibleItems(): CarouselItemState<T>[];
  /** Get state for a specific item */
  getItemState(index: number): CarouselItemState<T>;
  /** Go to a specific index */
  goTo(index: number, animate?: boolean): void;
  /** Go to next item */
  next(): void;
  /** Go to previous item */
  prev(): void;
  /** Subscribe to events */
  on<K extends keyof CarouselEvents<T>>(
    event: K, 
    callback: (payload: CarouselEvents<T>[K]) => void
  ): () => void;
  /** Bind offset to a SceneValue */
  bindToSceneValue(sceneValue: SceneValue): () => void;
}

// ============================================
// Event Helper Types
// ============================================

/**
 * Extract event callback type from an event map
 */
export type EventCallback<E, K extends keyof E> = (payload: E[K]) => void;

/**
 * Unsubscribe function returned by event subscriptions
 */
export type Unsubscribe = () => void;
