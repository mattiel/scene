/**
 * @scene/controllers
 * 
 * High-level interaction controllers for Scene engine.
 * Composes input + motion + constraints into reusable behaviors.
 */

// Shared types
export type {
  // Base types
  Position,
  Velocity,
  Bounds1D,
  Bounds2D,
  // Event payloads
  BaseEventPayload,
  Change1DPayload,
  Change2DPayload,
  DragStartPayload,
  DragEnd1DPayload,
  DragEnd2DPayload,
  SnapPayload,
  SnapEndPayload,
  BoundReached1DPayload,
  BoundReached2DPayload,
  // Controller interfaces
  BaseController,
  Controller1D,
  Controller2D,
  // Carousel types
  CarouselItemState,
  CarouselEvents,
  CarouselConfig,
  CarouselController,
  // Utilities
  EventCallback,
  Unsubscribe,
} from './types';

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
} from './Draggable';
