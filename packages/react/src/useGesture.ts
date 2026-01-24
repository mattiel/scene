/**
 * @scene/react - useGesture
 *
 * Unified gesture handling for pointer and wheel events.
 * Inspired by Motion's drag API with (event, info) callbacks.
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { clamp } from '@scene/core';

// ============================================
// Types
// ============================================

export interface Point {
  x: number;
  y: number;
}

export interface GestureInfo {
  /** Current pointer position */
  point: Point;
  /** Delta from last event */
  delta: Point;
  /** Total offset from drag start */
  offset: Point;
  /** Current velocity in px/ms */
  velocity: Point;
}

export interface GestureConstraints {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}

export type Axis = 'x' | 'y' | 'both';

export interface UseGestureOptions {
  /** Constrain movement to axis (default: 'both') */
  axis?: Axis;
  /** Lock to dominant axis after movement threshold (default: false) */
  directionLock?: boolean;
  /** Threshold in px before direction lock engages (default: 10) */
  directionLockThreshold?: number;
  /** Bounds constraints */
  constraints?: GestureConstraints;
  /** Elastic overscroll factor (0-1, default: 0.5) */
  elastic?: number | boolean;
  /** Enable momentum/inertia after release (default: false) */
  momentum?: boolean;
  /** Momentum decay factor (default: 0.95) */
  momentumDecay?: number;
  /** Snap points for the primary axis */
  snapPoints?: number[];
  /** Snap spring tension (default: 300) */
  snapTension?: number;
  /** Snap spring friction (default: 30) */
  snapFriction?: number;
  /** Enable wheel input (default: false) */
  wheel?: boolean;
  /** Wheel sensitivity multiplier (default: 1) */
  wheelSensitivity?: number;
  /** Minimum movement in px to be considered a drag vs tap (default: 3) */
  dragThreshold?: number;
  /** Maximum duration in ms for a tap (default: 300) */
  tapMaxDuration?: number;
  /** Use external controls (from useGestureControls) */
  controls?: GestureControls;
  /** Callback on tap */
  onTap?: (event: PointerEvent, info: GestureInfo) => void;
  /** Callback when drag starts */
  onDragStart?: (event: PointerEvent, info: GestureInfo) => void;
  /** Callback during drag */
  onDrag?: (event: PointerEvent, info: GestureInfo) => void;
  /** Callback when drag ends */
  onDragEnd?: (event: PointerEvent, info: GestureInfo) => void;
  /** Callback on wheel */
  onWheel?: (event: WheelEvent, info: GestureInfo) => void;
  /** Callback when snap animation starts */
  onSnapStart?: (info: { from: Point; to: Point }) => void;
  /** Callback when snap animation ends */
  onSnapEnd?: (info: { offset: Point }) => void;
}

export interface GestureControls {
  /** Start a drag programmatically */
  start: (event: PointerEvent, options?: { snapToCursor?: boolean }) => void;
  /** Stop current drag */
  stop: () => void;
  /** Cancel drag without triggering end callbacks */
  cancel: () => void;
  /** Internal: register the gesture instance */
  _register?: (instance: GestureInstance) => void;
}

interface GestureInstance {
  startDrag: (event: PointerEvent, snapToCursor?: boolean) => void;
  stopDrag: () => void;
  cancelDrag: () => void;
}

export interface UseGestureReturn {
  /** Bind props to spread on your element */
  bind: () => GestureBindings;
  /** Whether currently dragging */
  isDragging: boolean;
  /** Locked axis (if directionLock enabled) */
  lockedAxis: 'x' | 'y' | null;
  /** Current offset */
  offset: Point;
  /** Current velocity */
  velocity: Point;
  /** Snap to a specific offset */
  snapTo: (target: number | Point) => void;
  /** Set offset immediately (no animation) */
  setOffset: (target: number | Point) => void;
}

export interface GestureBindings {
  onPointerDown: (e: React.PointerEvent) => void;
  onWheel?: (e: React.WheelEvent) => void;
}

// ============================================
// Internal State
// ============================================

interface GestureState {
  isDragging: boolean;
  isControlled: boolean;
  startPoint: Point;
  startOffset: Point;
  currentPoint: Point;
  lastPoint: Point;
  lastTime: number;
  velocity: Point;
  lockedAxis: 'x' | 'y' | null;
  totalMovement: number;
  startTime: number;
  pointerId: number | null;
  // Momentum animation
  momentumRaf: number | null;
  // Snap animation
  snapRaf: number | null;
  snapFrom: Point;
  snapTo: Point;
  snapProgress: number;
  snapVelocity: Point;
  // Wheel inactivity timeout for elastic snap-back
  wheelTimeout: ReturnType<typeof setTimeout> | null;
}

// ============================================
// Helpers
// ============================================

function applyConstraints(
  value: Point,
  constraints: GestureConstraints | undefined,
  elastic: number
): Point {
  if (!constraints) return value;

  let { x, y } = value;

  if (constraints.left !== undefined && x > constraints.left) {
    const over = x - constraints.left;
    x = constraints.left + over * elastic;
  }
  if (constraints.right !== undefined && x < constraints.right) {
    const over = constraints.right - x;
    x = constraints.right - over * elastic;
  }
  if (constraints.top !== undefined && y > constraints.top) {
    const over = y - constraints.top;
    y = constraints.top + over * elastic;
  }
  if (constraints.bottom !== undefined && y < constraints.bottom) {
    const over = constraints.bottom - y;
    y = constraints.bottom - over * elastic;
  }

  return { x, y };
}

function constrainToAxis(delta: Point, axis: Axis, lockedAxis: 'x' | 'y' | null): Point {
  if (axis === 'x' || lockedAxis === 'x') return { x: delta.x, y: 0 };
  if (axis === 'y' || lockedAxis === 'y') return { x: 0, y: delta.y };
  return delta;
}

function findNearestSnapPoint(value: number, snapPoints: number[]): number {
  if (snapPoints.length === 0) return value;
  
  let nearest = snapPoints[0];
  let minDist = Math.abs(value - nearest);
  
  for (let i = 1; i < snapPoints.length; i++) {
    const dist = Math.abs(value - snapPoints[i]);
    if (dist < minDist) {
      minDist = dist;
      nearest = snapPoints[i];
    }
  }
  
  return nearest;
}

// ============================================
// Hook
// ============================================

/**
 * Unified gesture handling with Motion-style API.
 *
 * @example
 * ```tsx
 * const { bind, isDragging, offset } = useGesture({
 *   axis: 'x',
 *   constraints: { left: 0, right: -500 },
 *   elastic: 0.2,
 *   snapPoints: [0, -250, -500],
 *   onDrag: (event, info) => {
 *     console.log('Dragging:', info.offset);
 *   },
 * });
 *
 * return <div {...bind()} style={{ x: offset.x }} />;
 * ```
 */
export function useGesture(options: UseGestureOptions = {}): UseGestureReturn {
  const {
    axis = 'both',
    directionLock = false,
    directionLockThreshold = 10,
    constraints,
    elastic: elasticOption = 0.5,
    momentum = false,
    momentumDecay = 0.95,
    snapPoints,
    snapTension = 300,
    snapFriction = 30,
    wheel = false,
    wheelSensitivity = 1,
    dragThreshold = 3,
    tapMaxDuration = 300,
    controls,
    onTap,
    onDragStart,
    onDrag,
    onDragEnd,
    onWheel,
    onSnapStart,
    onSnapEnd,
  } = options;

  const elastic = typeof elasticOption === 'boolean' ? (elasticOption ? 0.5 : 0) : elasticOption;

  // State for re-renders
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [velocity, setVelocity] = useState<Point>({ x: 0, y: 0 });
  const [lockedAxis, setLockedAxis] = useState<'x' | 'y' | null>(null);

  // Internal state ref (doesn't trigger re-renders)
  const state = useRef<GestureState>({
    isDragging: false,
    isControlled: false,
    startPoint: { x: 0, y: 0 },
    startOffset: { x: 0, y: 0 },
    currentPoint: { x: 0, y: 0 },
    lastPoint: { x: 0, y: 0 },
    lastTime: 0,
    velocity: { x: 0, y: 0 },
    lockedAxis: null,
    totalMovement: 0,
    startTime: 0,
    pointerId: null,
    momentumRaf: null,
    snapRaf: null,
    snapFrom: { x: 0, y: 0 },
    snapTo: { x: 0, y: 0 },
    snapProgress: 0,
    snapVelocity: { x: 0, y: 0 },
    wheelTimeout: null,
  });

  // Stop any running animations
  const stopAnimations = useCallback(() => {
    if (state.current.momentumRaf) {
      cancelAnimationFrame(state.current.momentumRaf);
      state.current.momentumRaf = null;
    }
    if (state.current.snapRaf) {
      cancelAnimationFrame(state.current.snapRaf);
      state.current.snapRaf = null;
    }
    if (state.current.wheelTimeout) {
      clearTimeout(state.current.wheelTimeout);
      state.current.wheelTimeout = null;
    }
  }, []);

  // Snap to target
  const snapToTarget = useCallback(
    (target: Point, fromOffset?: Point) => {
      stopAnimations();

      const from = fromOffset ?? offset;
      state.current.snapFrom = { ...from };
      state.current.snapTo = { ...target };
      state.current.snapProgress = 0;
      state.current.snapVelocity = { x: 0, y: 0 };

      onSnapStart?.({ from, to: target });

      let lastTime = performance.now();

      const animate = (): void => {
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.064); // Cap at ~15fps minimum
        lastTime = now;

        const s = state.current;
        const current = offset;

        // Spring physics
        const dx = s.snapTo.x - current.x;
        const dy = s.snapTo.y - current.y;

        // F = -kx - cv (spring + damping)
        const ax = (snapTension * dx - snapFriction * s.snapVelocity.x);
        const ay = (snapTension * dy - snapFriction * s.snapVelocity.y);

        s.snapVelocity.x += ax * dt;
        s.snapVelocity.y += ay * dt;

        const newX = current.x + s.snapVelocity.x * dt;
        const newY = current.y + s.snapVelocity.y * dt;

        const newOffset = { x: newX, y: newY };
        setOffset(newOffset);
        setVelocity({ ...s.snapVelocity });

        // Check if settled
        const distSq = dx * dx + dy * dy;
        const velSq = s.snapVelocity.x * s.snapVelocity.x + s.snapVelocity.y * s.snapVelocity.y;

        if (distSq < 0.5 && velSq < 0.5) {
          setOffset({ ...s.snapTo });
          setVelocity({ x: 0, y: 0 });
          s.snapRaf = null;
          onSnapEnd?.({ offset: s.snapTo });
          return;
        }

        s.snapRaf = requestAnimationFrame(animate);
      };

      state.current.snapRaf = requestAnimationFrame(animate);
    },
    [offset, snapTension, snapFriction, onSnapStart, onSnapEnd, stopAnimations]
  );

  // Public snapTo API
  const snapTo = useCallback(
    (target: number | Point) => {
      const targetPoint = typeof target === 'number'
        ? axis === 'y' ? { x: offset.x, y: target } : { x: target, y: offset.y }
        : target;
      snapToTarget(targetPoint);
    },
    [axis, offset, snapToTarget]
  );

  // Public setOffset API
  const setOffsetImmediate = useCallback(
    (target: number | Point) => {
      stopAnimations();
      const targetPoint = typeof target === 'number'
        ? axis === 'y' ? { x: offset.x, y: target } : { x: target, y: offset.y }
        : target;
      setOffset(targetPoint);
      setVelocity({ x: 0, y: 0 });
    },
    [axis, offset, stopAnimations]
  );

  // Create gesture info
  const createInfo = useCallback((point: Point): GestureInfo => {
    const s = state.current;
    return {
      point,
      delta: { x: point.x - s.lastPoint.x, y: point.y - s.lastPoint.y },
      offset: { ...offset },
      velocity: { ...s.velocity },
    };
  }, [offset]);

  // Handle drag start
  const handleDragStart = useCallback(
    (event: PointerEvent, snapToCursor = false) => {
      stopAnimations();

      const s = state.current;
      const point = { x: event.clientX, y: event.clientY };

      s.isDragging = true;
      s.startPoint = { ...point };
      s.startOffset = snapToCursor ? { x: 0, y: 0 } : { ...offset };
      s.currentPoint = { ...point };
      s.lastPoint = { ...point };
      s.lastTime = performance.now();
      s.velocity = { x: 0, y: 0 };
      s.lockedAxis = null;
      s.totalMovement = 0;
      s.startTime = performance.now();
      s.pointerId = event.pointerId;

      setIsDragging(true);
      setLockedAxis(null);

      const info = createInfo(point);
      onDragStart?.(event, info);
    },
    [offset, stopAnimations, createInfo, onDragStart]
  );

  // Handle drag move
  const handleDragMove = useCallback(
    (event: PointerEvent) => {
      const s = state.current;
      if (!s.isDragging || event.pointerId !== s.pointerId) return;

      const now = performance.now();
      const dt = now - s.lastTime;
      const point = { x: event.clientX, y: event.clientY };

      // Calculate raw delta from start
      let rawDelta = {
        x: point.x - s.startPoint.x,
        y: point.y - s.startPoint.y,
      };

      // Update total movement for tap detection
      s.totalMovement += Math.abs(point.x - s.lastPoint.x) + Math.abs(point.y - s.lastPoint.y);

      // Direction lock
      if (directionLock && !s.lockedAxis) {
        if (s.totalMovement > directionLockThreshold) {
          const absX = Math.abs(rawDelta.x);
          const absY = Math.abs(rawDelta.y);
          s.lockedAxis = absX > absY ? 'x' : 'y';
          setLockedAxis(s.lockedAxis);
        }
      }

      // Apply axis constraint
      rawDelta = constrainToAxis(rawDelta, axis, s.lockedAxis);

      // Calculate new offset
      let newOffset = {
        x: s.startOffset.x + rawDelta.x,
        y: s.startOffset.y + rawDelta.y,
      };

      // Apply constraints with elasticity
      newOffset = applyConstraints(newOffset, constraints, elastic);

      // Calculate velocity (px/ms for consistency with motion)
      if (dt > 0) {
        s.velocity = {
          x: (point.x - s.lastPoint.x) / dt,
          y: (point.y - s.lastPoint.y) / dt,
        };
      }

      s.currentPoint = { ...point };
      s.lastPoint = { ...point };
      s.lastTime = now;

      setOffset(newOffset);
      setVelocity({ ...s.velocity });

      const info: GestureInfo = {
        point,
        delta: { x: point.x - s.lastPoint.x, y: point.y - s.lastPoint.y },
        offset: newOffset,
        velocity: { ...s.velocity },
      };
      onDrag?.(event, info);
    },
    [axis, directionLock, directionLockThreshold, constraints, elastic, onDrag]
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: PointerEvent) => {
      const s = state.current;
      if (!s.isDragging || event.pointerId !== s.pointerId) return;

      s.isDragging = false;
      s.pointerId = null;

      const duration = performance.now() - s.startTime;
      const point = { x: event.clientX, y: event.clientY };

      // Check for tap
      if (s.totalMovement < dragThreshold && duration < tapMaxDuration) {
        setIsDragging(false);
        onTap?.(event, createInfo(point));
        return;
      }

      setIsDragging(false);

      const info = createInfo(point);
      onDragEnd?.(event, info);

      // Snap or momentum
      if (snapPoints && snapPoints.length > 0) {
        const primaryOffset = axis === 'y' ? offset.y : offset.x;
        const snapTarget = findNearestSnapPoint(primaryOffset, snapPoints);
        const targetPoint = axis === 'y'
          ? { x: offset.x, y: snapTarget }
          : { x: snapTarget, y: offset.y };
        
        // Apply constraints to snap target
        const constrainedTarget = constraints
          ? {
              x: clamp(
                targetPoint.x,
                constraints.right ?? -Infinity,
                constraints.left ?? Infinity
              ),
              y: clamp(
                targetPoint.y,
                constraints.bottom ?? -Infinity,
                constraints.top ?? Infinity
              ),
            }
          : targetPoint;
        
        snapToTarget(constrainedTarget, offset);
      } else if (momentum) {
        // Start momentum animation
        let lastTime = performance.now();
        let currentVel = { ...s.velocity };
        let currentOff = { ...offset };

        const animate = (): void => {
          const now = performance.now();
          const dt = (now - lastTime) / 1000;
          lastTime = now;

          // Decay velocity
          currentVel.x *= Math.pow(momentumDecay, dt * 60);
          currentVel.y *= Math.pow(momentumDecay, dt * 60);

          // Update position
          currentOff.x += currentVel.x * dt * 1000;
          currentOff.y += currentVel.y * dt * 1000;

          // Apply constraints (hard stop, no elastic)
          if (constraints) {
            if (constraints.left !== undefined) currentOff.x = Math.min(currentOff.x, constraints.left);
            if (constraints.right !== undefined) currentOff.x = Math.max(currentOff.x, constraints.right);
            if (constraints.top !== undefined) currentOff.y = Math.min(currentOff.y, constraints.top);
            if (constraints.bottom !== undefined) currentOff.y = Math.max(currentOff.y, constraints.bottom);
          }

          setOffset({ ...currentOff });
          setVelocity({ ...currentVel });

          // Check if stopped
          const velMag = Math.abs(currentVel.x) + Math.abs(currentVel.y);
          if (velMag < 0.001) {
            s.momentumRaf = null;
            return;
          }

          s.momentumRaf = requestAnimationFrame(animate);
        };

        state.current.momentumRaf = requestAnimationFrame(animate);
      } else if (constraints) {
        // Snap back if over-scrolled (no momentum, no snap points)
        const constrained = {
          x: clamp(
            offset.x,
            constraints.right ?? -Infinity,
            constraints.left ?? Infinity
          ),
          y: clamp(
            offset.y,
            constraints.bottom ?? -Infinity,
            constraints.top ?? Infinity
          ),
        };
        if (constrained.x !== offset.x || constrained.y !== offset.y) {
          snapToTarget(constrained, offset);
        }
      }
    },
    [
      axis,
      constraints,
      dragThreshold,
      tapMaxDuration,
      momentum,
      momentumDecay,
      snapPoints,
      offset,
      createInfo,
      onTap,
      onDragEnd,
      snapToTarget,
    ]
  );

  // Cancel drag
  const cancelDrag = useCallback(() => {
    const s = state.current;
    if (!s.isDragging) return;

    s.isDragging = false;
    s.pointerId = null;
    setIsDragging(false);
    stopAnimations();

    // Restore to start offset
    setOffset({ ...s.startOffset });
    setVelocity({ x: 0, y: 0 });
  }, [stopAnimations]);

  // Stop drag (triggers end)
  const stopDrag = useCallback(() => {
    const s = state.current;
    if (!s.isDragging) return;

    // Create synthetic event
    const syntheticEvent = new PointerEvent('pointerup', {
      clientX: s.currentPoint.x,
      clientY: s.currentPoint.y,
      pointerId: s.pointerId ?? 0,
    });

    handleDragEnd(syntheticEvent);
  }, [handleDragEnd]);

  // Wheel handler
  const handleWheelEvent = useCallback(
    (event: WheelEvent) => {
      if (!wheel) return;

      const s = state.current;

      // Clear existing wheel timeout
      if (s.wheelTimeout) {
        clearTimeout(s.wheelTimeout);
        s.wheelTimeout = null;
      }

      const delta = {
        x: event.deltaX * wheelSensitivity,
        y: event.deltaY * wheelSensitivity,
      };

      // Apply axis constraint
      const constrainedDelta = constrainToAxis(delta, axis, null);

      let newOffset = {
        x: offset.x - constrainedDelta.x,
        y: offset.y - constrainedDelta.y,
      };

      // Apply constraints with elastic (allows over-scroll)
      newOffset = applyConstraints(newOffset, constraints, elastic);

      setOffset(newOffset);

      const info: GestureInfo = {
        point: { x: event.clientX, y: event.clientY },
        delta: { x: -constrainedDelta.x, y: -constrainedDelta.y },
        offset: newOffset,
        velocity: { x: 0, y: 0 },
      };

      onWheel?.(event, info);

      // Set timeout to snap back to bounds when wheel stops
      if (constraints && elastic > 0) {
        s.wheelTimeout = setTimeout(() => {
          s.wheelTimeout = null;
          
          // Check if we're over-scrolled and need to snap back
          const constrained = {
            x: clamp(
              newOffset.x,
              constraints.right ?? -Infinity,
              constraints.left ?? Infinity
            ),
            y: clamp(
              newOffset.y,
              constraints.bottom ?? -Infinity,
              constraints.top ?? Infinity
            ),
          };
          
          if (constrained.x !== newOffset.x || constrained.y !== newOffset.y) {
            snapToTarget(constrained, newOffset);
          }
        }, 150);
      }
    },
    [wheel, wheelSensitivity, axis, offset, constraints, elastic, onWheel, snapToTarget]
  );

  // Global pointer event listeners
  useEffect(() => {
    const handleMove = (e: PointerEvent): void => handleDragMove(e);
    const handleUp = (e: PointerEvent): void => handleDragEnd(e);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [handleDragMove, handleDragEnd]);

  // Register with controls
  useEffect(() => {
    if (controls?._register) {
      controls._register({
        startDrag: handleDragStart,
        stopDrag,
        cancelDrag,
      });
    }
  }, [controls, handleDragStart, stopDrag, cancelDrag]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAnimations();
  }, [stopAnimations]);

  // Bind function
  const bind = useCallback((): GestureBindings => {
    const bindings: GestureBindings = {
      onPointerDown: (e: React.PointerEvent) => {
        handleDragStart(e.nativeEvent);
      },
    };

    if (wheel) {
      bindings.onWheel = (e: React.WheelEvent) => {
        handleWheelEvent(e.nativeEvent);
      };
    }

    return bindings;
  }, [handleDragStart, wheel, handleWheelEvent]);

  return {
    bind,
    isDragging,
    lockedAxis,
    offset,
    velocity,
    snapTo,
    setOffset: setOffsetImmediate,
  };
}
