/**
 * @scene/controllers
 * 
 * High-level interaction controllers for Scene engine.
 * Composes input + motion + constraints into reusable behaviors.
 */

// Scrollable - 1D scroll with bounds, snap, inertia, wheel
export { Scrollable } from './Scrollable';
export type {
  ScrollableConfig,
  ScrollableEvents,
  ScrollableCallback,
} from './Scrollable';

// Draggable - 2D drag with inertia, constraints
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

