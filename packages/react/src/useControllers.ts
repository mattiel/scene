/**
 * useControllers - React hooks for Scrollable and Draggable controllers
 * 
 * Provides React-friendly lifecycle management for interaction controllers,
 * handling creation, event binding, and cleanup automatically.
 */

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import {
  Scrollable,
  Draggable,
  type ScrollableConfig,
  type DraggableConfig,
  type State1D,
  type State2D,
  type ScrollableEvents,
  type DraggableEvents,
  prefersReducedMotion,
  onReducedMotionChange,
} from '@scene/controllers';

// ============================================
// useReducedMotion - React hook for reduced motion preference
// ============================================

/**
 * Hook that tracks the user's reduced motion preference
 * 
 * Automatically updates when the OS setting changes.
 * 
 * @returns true if the user prefers reduced motion
 * 
 * @example
 * ```tsx
 * function AnimatedComponent() {
 *   const reducedMotion = useReducedMotion();
 *   
 *   return (
 *     <motion.div
 *       animate={{ x: 100 }}
 *       transition={{ duration: reducedMotion ? 0 : 0.3 }}
 *     />
 *   );
 * }
 * ```
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => prefersReducedMotion());
  
  useEffect(() => {
    return onReducedMotionChange(setReduced);
  }, []);
  
  return reduced;
}

// ============================================
// useScrollableInput - Pointer/Wheel handlers for canvas-based UIs
// ============================================

/**
 * Options for useScrollableInput
 */
export interface UseScrollableInputOptions {
  /** The Scrollable instance to control */
  scrollable: Scrollable | null;
  /** Direction (default: 'horizontal') */
  direction?: 'horizontal' | 'vertical';
  /** Drag sensitivity multiplier (default: 1) */
  dragSensitivity?: number;
  /** Invert drag direction (default: false, drag right = scroll right) */
  invertDrag?: boolean;
  /** Tap threshold in pixels (default: 8) */
  tapThreshold?: number;
  /** Tap max duration in ms (default: 300) */
  tapMaxDuration?: number;
  /** Callback when tap is detected */
  onTap?: (x: number, y: number) => void;
  /** Callback when drag starts */
  onDragStart?: () => void;
  /** Callback when drag ends */
  onDragEnd?: (velocity: number) => void;
}

/**
 * Return type for useScrollableInput
 */
export interface UseScrollableInputReturn {
  /** Pointer down handler */
  onPointerDown: (e: React.PointerEvent) => void;
  /** Pointer move handler */
  onPointerMove: (e: React.PointerEvent) => void;
  /** Pointer up handler */
  onPointerUp: (e: React.PointerEvent) => void;
  /** Pointer leave handler (same as up) */
  onPointerLeave: (e: React.PointerEvent) => void;
  /** Wheel handler */
  onWheel: (e: React.WheelEvent) => void;
  /** Whether currently dragging */
  isDragging: boolean;
}

/**
 * Hook for canvas/container-level pointer and wheel input
 * 
 * Unlike useScrollable which binds events to a specific element via ref,
 * this hook returns event handlers you can attach to any element (like a canvas).
 * 
 * @example
 * ```tsx
 * function CarouselCanvas() {
 *   const scrollable = useRef(new Scrollable({ snapPoints: [...] }));
 *   const handlers = useScrollableInput({
 *     scrollable: scrollable.current,
 *     direction: 'horizontal',
 *     onTap: (x, y) => handleItemTap(x, y),
 *   });
 *   
 *   return <canvas {...handlers} />;
 * }
 * ```
 */
export function useScrollableInput(options: UseScrollableInputOptions): UseScrollableInputReturn {
  const {
    scrollable,
    direction = 'horizontal',
    dragSensitivity = 1,
    invertDrag = false,
    tapThreshold = 8,
    tapMaxDuration = 300,
    onTap,
    onDragStart,
    onDragEnd,
  } = options;

  // Tracking refs
  const startPosRef = useRef({ x: 0, y: 0 });
  const lastPosRef = useRef({ x: 0, y: 0 });
  const startTimeRef = useRef(0);
  const lastTimeRef = useRef(0);
  const totalMovementRef = useRef(0);
  const velocityRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isDownRef = useRef(false);
  
  // State for React consumers
  const [isDragging, setIsDragging] = useState(false);
  
  // Use refs for callbacks to avoid stale closures
  const scrollableRef = useRef(scrollable);
  const onTapRef = useRef(onTap);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  
  useEffect(() => {
    scrollableRef.current = scrollable;
    onTapRef.current = onTap;
    onDragStartRef.current = onDragStart;
    onDragEndRef.current = onDragEnd;
  }, [scrollable, onTap, onDragStart, onDragEnd]);

  const isHorizontal = direction === 'horizontal';
  const dirMultiplier = invertDrag ? -1 : 1;

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const now = performance.now();
    startPosRef.current = { x: e.clientX, y: e.clientY };
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    startTimeRef.current = now;
    lastTimeRef.current = now;
    totalMovementRef.current = 0;
    velocityRef.current = 0;
    isDraggingRef.current = false;
    isDownRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDownRef.current) return;
    
    const now = performance.now();
    const dt = now - lastTimeRef.current;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    const delta = isHorizontal ? dx : dy;
    
    totalMovementRef.current += Math.abs(delta);
    
    // Start drag if moved beyond tap threshold
    if (!isDraggingRef.current && totalMovementRef.current > tapThreshold) {
      isDraggingRef.current = true;
      setIsDragging(true);
      scrollableRef.current?.handleDragStart();
      onDragStartRef.current?.();
    }
    
    if (isDraggingRef.current && scrollableRef.current) {
      // Calculate velocity for smooth inertia
      if (dt > 0) {
        velocityRef.current = (delta / dt) * 1000 * dirMultiplier; // px/s
      }
      scrollableRef.current.handleDrag(delta * dragSensitivity * dirMultiplier);
    }
    
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    lastTimeRef.current = now;
  }, [isHorizontal, tapThreshold, dragSensitivity, dirMultiplier]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDownRef.current) return;
    isDownRef.current = false;
    
    const duration = performance.now() - startTimeRef.current;
    const movement = totalMovementRef.current;
    
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture was already released
    }
    
    // Check if this was a tap
    if (duration < tapMaxDuration && movement < tapThreshold) {
      onTapRef.current?.(e.clientX, e.clientY);
    } else if (isDraggingRef.current) {
      // End drag with velocity
      scrollableRef.current?.handleDragEnd(velocityRef.current);
      onDragEndRef.current?.(velocityRef.current);
    }
    
    isDraggingRef.current = false;
    setIsDragging(false);
  }, [tapMaxDuration, tapThreshold]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    const delta = isHorizontal ? e.deltaX || e.deltaY : e.deltaY;
    scrollableRef.current?.handleWheel(delta);
  }, [isHorizontal]);

  return useMemo(() => ({
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave: onPointerUp,
    onWheel,
    isDragging,
  }), [onPointerDown, onPointerMove, onPointerUp, onWheel, isDragging]);
}

// ============================================
// useScrollable
// ============================================

/**
 * Options for useScrollable hook
 * 
 * Note: Key properties from ScrollableConfig are duplicated here to ensure
 * proper type resolution during declaration file generation.
 */
export interface UseScrollableOptions extends ScrollableConfig {
  /** Whether the scrollable is enabled (default: true) */
  enabled?: boolean;
  /** Callback when offset changes */
  onChange?: (event: ScrollableEvents['change']) => void;
  /** Callback when snapping starts */
  onSnapStart?: (event: ScrollableEvents['snapStart']) => void;
  /** Callback when snapping ends */
  onSnapEnd?: (event: ScrollableEvents['snapEnd']) => void;
  /** Callback when bound is reached */
  onBoundReached?: (event: ScrollableEvents['boundReached']) => void;
  // Duplicated from ScrollableConfig for declaration file generation
  /** Initial offset (default: 0) */
  initialOffset?: number;
  /** Minimum offset bound */
  minOffset?: number;
  /** Maximum offset bound */
  maxOffset?: number;
  /** Snap points (positions to snap to) */
  snapPoints?: number[];
  /** Automatically snap to nearest point on release (default: false) */
  autoSnap?: boolean;
}

/**
 * Return type for useScrollable hook
 */
export interface UseScrollableReturn<T extends HTMLElement> {
  /** Ref to attach to the DOM element */
  ref: React.RefObject<T | null>;
  /** The Scrollable instance (null if not created) */
  scrollable: Scrollable | null;
  /** Current state snapshot */
  state: State1D;
  /** Current offset */
  offset: number;
  /** Whether currently dragging */
  isDragging: boolean;
  /** Whether inertia is active */
  isAnimating: boolean;
  /** Set offset directly */
  setOffset: (offset: number) => void;
  /** Snap to a position with animation */
  snapTo: (offset: number, duration?: number) => void;
  /** Snap to a snap point by index */
  snapToIndex: (index: number) => void;
  /** Stop any animation */
  stop: () => void;
}

/**
 * Hook to create and manage a Scrollable controller
 * 
 * @param options - Scrollable options and callbacks
 * 
 * @example
 * ```tsx
 * function Carousel() {
 *   const { ref, offset, isDragging, snapToIndex } = useScrollable<HTMLDivElement>({
 *     minOffset: 0,
 *     maxOffset: 1000,
 *     snapPoints: [0, 250, 500, 750, 1000],
 *     autoSnap: true,
 *     direction: 'horizontal',
 *     onChange: ({ offset }) => console.log('Offset:', offset),
 *   });
 *   
 *   return (
 *     <div ref={ref} style={{ transform: `translateX(${-offset}px)` }}>
 *       {items.map((item, i) => (
 *         <div key={i} onClick={() => snapToIndex(i)}>
 *           {item}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useScrollable<T extends HTMLElement = HTMLElement>(
  options: UseScrollableOptions = {}
): UseScrollableReturn<T> {
  const ref = useRef<T | null>(null);
  const scrollableRef = useRef<Scrollable | null>(null);
  const isDraggingRef = useRef(false);
  const lastPointerXRef = useRef(0);
  const lastPointerYRef = useRef(0);
  
  const [state, setState] = useState<State1D>({
    offset: options.initialOffset ?? 0,
    velocity: 0,
    isDragging: false,
    isAnimating: false,
  });

  const {
    enabled = true,
    onChange,
    onSnapStart,
    onSnapEnd,
    onBoundReached,
    ...scrollableConfig
  } = options as UseScrollableOptions & ScrollableConfig;

  // Create scrollable instance
  useEffect(() => {
    if (!enabled) return;

    const scrollable = new Scrollable(scrollableConfig);
    scrollableRef.current = scrollable;

    // Set initial state
    setState(scrollable.getState());

    // Subscribe to events
    const unsubs: (() => void)[] = [];

    unsubs.push(scrollable.on('change', (event: { offset: number; velocity: number }) => {
      setState({
        offset: event.offset,
        velocity: event.velocity,
        isDragging: scrollable.isDragging,
        isAnimating: scrollable.hasInertia || scrollable.snapping,
      });
      onChange?.(event);
    }));

    if (onSnapStart) {
      unsubs.push(scrollable.on('snapStart', onSnapStart));
    }

    if (onSnapEnd) {
      unsubs.push(scrollable.on('snapEnd', onSnapEnd));
    }

    if (onBoundReached) {
      unsubs.push(scrollable.on('boundReached', onBoundReached));
    }

    return () => {
      unsubs.forEach(unsub => unsub());
      scrollable.destroy();
      scrollableRef.current = null;
    };
  }, [enabled]);

  // Attach DOM event handlers
  useEffect(() => {
    if (!enabled || !ref.current) return;

    const element = ref.current;
    const scrollable = scrollableRef.current;
    if (!scrollable) return;

    const isHorizontal = scrollable.direction === 'horizontal';

    const handlePointerDown = (e: PointerEvent): void => {
      isDraggingRef.current = true;
      lastPointerXRef.current = e.clientX;
      lastPointerYRef.current = e.clientY;
      scrollable.handleDragStart();
      element.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent): void => {
      if (!isDraggingRef.current) return;
      
      const delta = isHorizontal
        ? e.clientX - lastPointerXRef.current
        : e.clientY - lastPointerYRef.current;
      
      lastPointerXRef.current = e.clientX;
      lastPointerYRef.current = e.clientY;
      
      scrollable.handleDrag(-delta); // Negative because drag right = scroll left
    };

    const handlePointerUp = (e: PointerEvent): void => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      element.releasePointerCapture(e.pointerId);
      scrollable.handleDragEnd();
    };

    const handleWheel = (e: WheelEvent): void => {
      const delta = isHorizontal ? e.deltaX : e.deltaY;
      scrollable.handleWheel(delta);
      e.preventDefault();
    };

    // Add event listeners
    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerup', handlePointerUp);
    element.addEventListener('pointercancel', handlePointerUp);
    element.addEventListener('wheel', handleWheel, { passive: false });

    // Set touch-action for better touch handling
    element.style.touchAction = isHorizontal ? 'pan-y' : 'pan-x';

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', handlePointerUp);
      element.removeEventListener('pointercancel', handlePointerUp);
      element.removeEventListener('wheel', handleWheel);
      element.style.touchAction = '';
    };
  }, [enabled]);

  // Update config when options change
  useEffect(() => {
    if (scrollableRef.current) {
      scrollableRef.current.setConfig(scrollableConfig);
    }
  }, [scrollableConfig.minOffset, scrollableConfig.maxOffset, scrollableConfig.snapPoints, scrollableConfig.autoSnap]);

  const setOffset = useCallback((offset: number) => {
    scrollableRef.current?.setOffset(offset);
  }, []);

  const snapTo = useCallback((offset: number, duration?: number) => {
    scrollableRef.current?.snapTo(offset, duration);
  }, []);

  const snapToIndex = useCallback((index: number) => {
    const snapPoints = scrollableConfig.snapPoints;
    if (snapPoints && index >= 0 && index < snapPoints.length) {
      scrollableRef.current?.snapTo(snapPoints[index]);
    }
  }, [scrollableConfig.snapPoints]);

  const stop = useCallback(() => {
    // Stop by setting current offset (this halts any animations)
    const current = scrollableRef.current?.offset;
    if (current !== undefined) {
      scrollableRef.current?.setOffset(current);
    }
  }, []);

  return useMemo(
    () => ({
      ref,
      scrollable: scrollableRef.current,
      state,
      offset: state.offset,
      isDragging: state.isDragging,
      isAnimating: state.isAnimating,
      setOffset,
      snapTo,
      snapToIndex,
      stop,
    }),
    [state, setOffset, snapTo, snapToIndex, stop]
  );
}

// ============================================
// useDraggable
// ============================================

/**
 * Options for useDraggable hook
 * 
 * Note: Key properties from DraggableConfig are duplicated here to ensure
 * proper type resolution during declaration file generation.
 */
export interface UseDraggableOptions extends DraggableConfig {
  /** Whether the draggable is enabled (default: true) */
  enabled?: boolean;
  /** Callback when position changes */
  onChange?: (event: DraggableEvents['change']) => void;
  /** Callback when bound is reached */
  onBoundReached?: (event: DraggableEvents['boundReached']) => void;
  // Duplicated from DraggableConfig for declaration file generation
  /** Initial position (default: { x: 0, y: 0 }) */
  initialPosition?: { x: number; y: number };
  /** Bounds for constraining drag */
  bounds?: { minX?: number; maxX?: number; minY?: number; maxY?: number };
}

/**
 * Return type for useDraggable hook
 */
export interface UseDraggableReturn<T extends HTMLElement> {
  /** Ref to attach to the DOM element */
  ref: React.RefObject<T | null>;
  /** The Draggable instance (null if not created) */
  draggable: Draggable | null;
  /** Current state snapshot */
  state: State2D;
  /** Current x position */
  x: number;
  /** Current y position */
  y: number;
  /** Whether currently dragging */
  isDragging: boolean;
  /** Whether inertia is active */
  isAnimating: boolean;
  /** Set position directly */
  setPosition: (x: number, y: number) => void;
  /** Move to a position with animation */
  moveTo: (x: number, y: number) => void;
  /** Stop any animation */
  stop: () => void;
  /** Set bounds dynamically */
  setBounds: (bounds: { minX?: number; maxX?: number; minY?: number; maxY?: number }) => void;
}

/**
 * Hook to create and manage a Draggable controller
 * 
 * @param options - Draggable options and callbacks
 * 
 * @example
 * ```tsx
 * function DraggableCard() {
 *   const { ref, x, y, isDragging, moveTo } = useDraggable<HTMLDivElement>({
 *     bounds: { minX: 0, maxX: 500, minY: 0, maxY: 500 },
 *     axis: 'both',
 *     inertia: { enabled: true, friction: 0.95 },
 *   });
 *   
 *   return (
 *     <div 
 *       ref={ref}
 *       style={{
 *         transform: `translate(${x}px, ${y}px)`,
 *         cursor: isDragging ? 'grabbing' : 'grab',
 *       }}
 *     >
 *       Drag me!
 *     </div>
 *   );
 * }
 * ```
 */
export function useDraggable<T extends HTMLElement = HTMLElement>(
  options: UseDraggableOptions = {}
): UseDraggableReturn<T> {
  const ref = useRef<T | null>(null);
  const draggableRef = useRef<Draggable | null>(null);
  const isDraggingRef = useRef(false);
  const lastPointerXRef = useRef(0);
  const lastPointerYRef = useRef(0);
  
  const initialX = options.initialPosition?.x ?? 0;
  const initialY = options.initialPosition?.y ?? 0;
  
  const [state, setState] = useState<State2D>({
    position: { x: initialX, y: initialY },
    velocity: { x: 0, y: 0 },
    isDragging: false,
    isAnimating: false,
  });

  const {
    enabled = true,
    onChange,
    onBoundReached,
    ...draggableConfig
  } = options as UseDraggableOptions & DraggableConfig;

  // Create draggable instance
  useEffect(() => {
    if (!enabled) return;

    const draggable = new Draggable(draggableConfig);
    draggableRef.current = draggable;

    // Set initial state
    setState(draggable.getState());

    // Subscribe to events
    const unsubs: (() => void)[] = [];

    unsubs.push(draggable.on('change', (event: { position: { x: number; y: number }; velocity: { x: number; y: number } }) => {
      setState({
        position: event.position,
        velocity: event.velocity,
        isDragging: draggable.isDragging,
        isAnimating: draggable.hasInertia,
      });
      onChange?.(event);
    }));

    if (onBoundReached) {
      unsubs.push(draggable.on('boundReached', onBoundReached));
    }

    return () => {
      unsubs.forEach(unsub => unsub());
      draggable.destroy();
      draggableRef.current = null;
    };
  }, [enabled]);

  // Attach DOM event handlers
  useEffect(() => {
    if (!enabled || !ref.current) return;

    const element = ref.current;
    const draggable = draggableRef.current;
    if (!draggable) return;

    const handlePointerDown = (e: PointerEvent): void => {
      isDraggingRef.current = true;
      lastPointerXRef.current = e.clientX;
      lastPointerYRef.current = e.clientY;
      draggable.handleDragStart();
      element.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent): void => {
      if (!isDraggingRef.current) return;
      
      const deltaX = e.clientX - lastPointerXRef.current;
      const deltaY = e.clientY - lastPointerYRef.current;
      
      lastPointerXRef.current = e.clientX;
      lastPointerYRef.current = e.clientY;
      
      draggable.handleDrag(deltaX, deltaY);
    };

    const handlePointerUp = (e: PointerEvent): void => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      element.releasePointerCapture(e.pointerId);
      draggable.handleDragEnd();
    };

    // Add event listeners
    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerup', handlePointerUp);
    element.addEventListener('pointercancel', handlePointerUp);

    // Set touch-action for drag
    element.style.touchAction = 'none';

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', handlePointerUp);
      element.removeEventListener('pointercancel', handlePointerUp);
      element.style.touchAction = '';
    };
  }, [enabled]);

  // Update config when bounds change
  useEffect(() => {
    if (draggableRef.current && draggableConfig.bounds) {
      draggableRef.current.setBounds(draggableConfig.bounds);
    }
  }, [draggableConfig.bounds]);

  const setPosition = useCallback((x: number, y: number) => {
    draggableRef.current?.setPosition({ x, y });
  }, []);

  const moveTo = useCallback((x: number, y: number) => {
    // moveTo is the same as setPosition - use animation if needed
    draggableRef.current?.setPosition({ x, y });
  }, []);

  const stop = useCallback(() => {
    // Stop by setting current position (this halts any animations)
    const current = draggableRef.current?.getState().position;
    if (current) {
      draggableRef.current?.setPosition(current);
    }
  }, []);

  const setBounds = useCallback((bounds: { minX?: number; maxX?: number; minY?: number; maxY?: number }) => {
    draggableRef.current?.setBounds(bounds);
  }, []);

  return useMemo(
    () => ({
      ref,
      draggable: draggableRef.current,
      state,
      x: state.position.x,
      y: state.position.y,
      isDragging: state.isDragging,
      isAnimating: state.isAnimating,
      setPosition,
      moveTo,
      stop,
      setBounds,
    }),
    [state, setPosition, moveTo, stop, setBounds]
  );
}
