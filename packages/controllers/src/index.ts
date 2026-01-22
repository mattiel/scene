/**
 * @scene/controllers
 * 
 * Composable interaction controllers for Scene engine.
 * Provides primitives for building custom interactions.
 * 
 * Inspired by motion library - low-level primitives, not implementations.
 */

// Shared types - generic building blocks
export type {
  // Geometry
  Point,
  Velocity2D,
  Bounds1D,
  Bounds2D,
  Axis,
  // Constraints
  SnapPoint,
  SnapConfig,
  InertiaConfig,
  // State
  State1D,
  State2D,
  // Events
  ChangeEvent1D,
  ChangeEvent2D,
  SnapEvent,
  BoundEvent1D,
  BoundEvent2D,
  // Utilities
  EventCallback,
  Unsubscribe,
} from './types';

// Scrollable - 1D controller with bounds, snap, inertia, wheel
export { Scrollable } from './Scrollable';
export type {
  ScrollableConfig,
  ScrollableEvents,
  ScrollableCallback,
} from './Scrollable';

// Draggable - 2D controller with bounds, axis lock, inertia
export { Draggable } from './Draggable';
export type {
  DraggableConfig,
  DraggableEvents,
  DraggableCallback,
  DraggableBounds,
  DragAxis,
  Position,
  Velocity,
} from './Draggable';

// Utilities
export { prefersReducedMotion, onReducedMotionChange } from './utils';
