/**
 * @scene/input
 *
 * Input system for Scene engine.
 * Provides unified pointer handling, inertia, surface picking,
 * multi-touch gestures, gesture recognition, and debugging tools.
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

// MultiTouch - Multi-touch gesture tracking (pinch, rotate)
export { MultiTouch } from './MultiTouch';
export type {
  TouchPoint,
  MultiTouchState,
  MultiTouchCallbacks,
  MultiTouchOptions,
} from './MultiTouch';

// GestureRecognizer - Discrete gesture detection (tap, swipe, long-press)
export { GestureRecognizer } from './GestureRecognizer';
export type {
  GestureType,
  SwipeDirection,
  BaseGestureEvent,
  TapGestureEvent,
  DoubleTapGestureEvent,
  LongPressGestureEvent,
  SwipeGestureEvent,
  CustomGestureEvent,
  GestureEvent,
  GestureRecognizerCallbacks,
  GestureRecognizerOptions,
  CustomGestureDefinition,
} from './GestureRecognizer';

// InputRecorder - Recording and playback
export { InputRecorder } from './InputRecorder';
export type {
  RecordedEventType,
  RecordedEvent,
  RecordingMetadata,
  InputRecording,
  PlaybackCallbacks,
  PlaybackOptions,
} from './InputRecorder';

// InputVisualizer - Debug overlay
export { InputVisualizer } from './InputVisualizer';
export type { InputVisualizerOptions } from './InputVisualizer';
