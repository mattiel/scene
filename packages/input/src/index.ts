/**
 * @scene/input
 *
 * Input system for Scene engine.
 * Provides unified pointer handling, inertia, and surface picking.
 */

// InputManager - High-level coordinator
export { InputManager } from './InputManager';
export type { InputManagerConfig, InputIntents, IntentCallback } from './InputManager';

// PointerManager - Normalized pointer events
export { PointerManager } from './PointerManager';
export type {
  NormalizedPointer,
  GestureState,
  PointerManagerCallbacks,
  PointerManagerOptions,
} from './PointerManager';

// Inertia - Momentum and deceleration
export { Inertia } from './Inertia';
export type { InertiaState, InertiaOptions, InertiaCallback } from './Inertia';

// Picking - Surface hit testing
export { Picking } from './Picking';
export type {
  PickableSurface,
  PickableRegistry,
  PickResult,
  PickEvent,
  PickingCallbacks,
  PickingOptions,
} from './Picking';
