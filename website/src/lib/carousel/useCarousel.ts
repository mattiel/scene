/**
 * useCarousel - Hook for carousel controller
 * 
 * Provides a declarative React interface to the Carousel controller,
 * handling lifecycle and state updates.
 * 
 * This is a USER-LEVEL implementation showing how to build carousel hooks
 * using Scene's primitives and the Carousel controller.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Carousel,
  type CarouselConfig,
  type CarouselItem,
  type CarouselItemState,
  type CarouselEvents,
} from './Carousel';

/**
 * Return type for useCarousel hook
 */
export interface UseCarouselReturn {
  /** Current carousel offset */
  offset: number;
  /** Current velocity */
  velocity: number;
  /** Whether currently dragging */
  isDragging: boolean;
  /** Current center item index */
  centerIndex: number;
  /** Current center item */
  centerItem: CarouselItem | null;
  /** Currently expanded item index (-1 if none) */
  expandedIndex: number;
  /** Whether an item is expanded */
  hasExpanded: boolean;
  /** Expand progress (0-1) */
  expandProgress: number;
  /** Computed item states */
  itemStates: CarouselItemState[];
  /** Navigate to next item */
  next: () => void;
  /** Navigate to previous item */
  previous: () => void;
  /** Scroll to specific index */
  scrollToIndex: (index: number, animated?: boolean) => void;
  /** Scroll to specific item by ID */
  scrollToItem: (itemId: string, animated?: boolean) => void;
  /** Expand an item by index */
  expandItem: (index: number) => void;
  /** Collapse the expanded item */
  collapseItem: () => void;
  /** Handle drag start (bind to onPointerDown/onMouseDown) */
  handleDragStart: () => void;
  /** Handle drag movement (bind to onPointerMove/onMouseMove) */
  handleDrag: (delta: number) => void;
  /** Handle drag end (bind to onPointerUp/onMouseUp) */
  handleDragEnd: (velocityX?: number) => void;
  /** Handle wheel input (bind to onWheel) */
  handleWheel: (delta: number) => void;
  /** Handle item tap */
  handleItemTap: (itemId: string, x: number, y: number) => void;
  /** The underlying Carousel instance */
  carousel: Carousel;
}

/**
 * Extended config for React hook
 */
export interface UseCarouselConfig extends CarouselConfig {
  /** Called when center item changes */
  onCenterChange?: (payload: CarouselEvents['centerChange']) => void;
  /** Called when offset changes */
  onOffsetChange?: (payload: CarouselEvents['offsetChange']) => void;
  /** Called when item is tapped */
  onItemTap?: (payload: CarouselEvents['itemTap']) => void;
  /** Called when item is expanded */
  onItemExpand?: (payload: CarouselEvents['itemExpand']) => void;
  /** Called when item is collapsed */
  onItemCollapse?: (payload: CarouselEvents['itemCollapse']) => void;
}

/**
 * Hook for carousel controller
 * 
 * @param config - Carousel configuration
 * 
 * @example
 * ```tsx
 * function CarouselDemo() {
 *   const {
 *     itemStates,
 *     centerItem,
 *     handleDragStart,
 *     handleDrag,
 *     handleDragEnd,
 *     handleWheel,
 *   } = useCarousel({
 *     items: CARDS,
 *     itemSpacing: 320,
 *     centerSnap: true,
 *     onCenterChange: ({ item }) => setTitle(item.label),
 *   });
 *   
 *   return (
 *     <div
 *       onPointerDown={handleDragStart}
 *       onPointerMove={(e) => handleDrag(e.movementX)}
 *       onPointerUp={() => handleDragEnd()}
 *       onWheel={(e) => handleWheel(e.deltaY)}
 *     >
 *       {itemStates.map(state => (
 *         <Card
 *           key={state.item.id}
 *           {...state}
 *           style={{ transform: `translateX(${state.x}px)` }}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCarousel(config: UseCarouselConfig = {}): UseCarouselReturn {
  const {
    onCenterChange,
    onOffsetChange,
    onItemTap,
    onItemExpand,
    onItemCollapse,
    ...carouselConfig
  } = config;

  // Create stable Carousel instance
  const carouselRef = useRef<Carousel | null>(null);
  if (!carouselRef.current) {
    carouselRef.current = new Carousel(carouselConfig);
  }
  const carousel = carouselRef.current;

  // State
  const [offset, setOffset] = useState(carousel.offset);
  const [velocity, setVelocity] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [centerIndex, setCenterIndex] = useState(carousel.centerIndex);
  const [expandedIndex, setExpandedIndex] = useState(carousel.expandedIndex);
  const [expandProgress, setExpandProgress] = useState(carousel.expandProgress);
  const [itemStates, setItemStates] = useState<CarouselItemState[]>([]);

  // Subscribe to events
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(
      carousel.on('offsetChange', (payload) => {
        setOffset(payload.offset);
        setVelocity(payload.velocity);
        setIsDragging(carousel.isDragging);
        setItemStates(carousel.computeItemStates());
        onOffsetChange?.(payload);
      })
    );

    unsubscribers.push(
      carousel.on('centerChange', (payload) => {
        setCenterIndex(payload.index);
        onCenterChange?.(payload);
      })
    );

    unsubscribers.push(
      carousel.on('itemTap', (payload) => {
        onItemTap?.(payload);
      })
    );

    unsubscribers.push(
      carousel.on('itemExpand', (payload) => {
        setExpandedIndex(payload.index);
        onItemExpand?.(payload);
      })
    );

    unsubscribers.push(
      carousel.on('itemCollapse', (payload) => {
        setExpandedIndex(-1);
        onItemCollapse?.(payload);
      })
    );

    // Initialize item states
    setItemStates(carousel.computeItemStates());

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [carousel, onCenterChange, onOffsetChange, onItemTap, onItemExpand, onItemCollapse]);

  // Track expand progress
  useEffect(() => {
    const intervalId = setInterval(() => {
      setExpandProgress(carousel.expandProgress);
    }, 16);

    return () => clearInterval(intervalId);
  }, [carousel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      carouselRef.current?.destroy();
    };
  }, []);

  // Memoized handlers
  const next = useCallback(() => carousel.next(), [carousel]);
  const previous = useCallback(() => carousel.previous(), [carousel]);
  
  const scrollToIndex = useCallback(
    (index: number, animated = true) => carousel.scrollToIndex(index, animated),
    [carousel]
  );
  
  const scrollToItem = useCallback(
    (itemId: string, animated = true) => carousel.scrollToItem(itemId, animated),
    [carousel]
  );
  
  const expandItem = useCallback(
    (index: number) => carousel.expandItem(index),
    [carousel]
  );
  
  const collapseItem = useCallback(() => carousel.collapseItem(), [carousel]);
  
  const handleDragStart = useCallback(() => {
    carousel.handleDragStart();
    setIsDragging(true);
  }, [carousel]);
  
  const handleDrag = useCallback(
    (delta: number) => carousel.handleDrag(delta),
    [carousel]
  );
  
  const handleDragEnd = useCallback(
    (velocityX?: number) => {
      carousel.handleDragEnd(velocityX);
      setIsDragging(false);
    },
    [carousel]
  );
  
  const handleWheel = useCallback(
    (delta: number) => carousel.handleWheel(delta),
    [carousel]
  );
  
  const handleItemTap = useCallback(
    (itemId: string, x: number, y: number) => carousel.handleItemTap(itemId, x, y),
    [carousel]
  );

  const centerItem = useMemo(
    () => carousel.centerItem,
    [carousel, centerIndex]
  );

  const hasExpanded = useMemo(() => expandedIndex >= 0, [expandedIndex]);

  return useMemo(
    () => ({
      offset,
      velocity,
      isDragging,
      centerIndex,
      centerItem,
      expandedIndex,
      hasExpanded,
      expandProgress,
      itemStates,
      next,
      previous,
      scrollToIndex,
      scrollToItem,
      expandItem,
      collapseItem,
      handleDragStart,
      handleDrag,
      handleDragEnd,
      handleWheel,
      handleItemTap,
      carousel,
    }),
    [
      offset,
      velocity,
      isDragging,
      centerIndex,
      centerItem,
      expandedIndex,
      hasExpanded,
      expandProgress,
      itemStates,
      next,
      previous,
      scrollToIndex,
      scrollToItem,
      expandItem,
      collapseItem,
      handleDragStart,
      handleDrag,
      handleDragEnd,
      handleWheel,
      handleItemTap,
      carousel,
    ]
  );
}

/**
 * Hook to bind carousel to pointer events
 * 
 * Returns event handlers that can be spread onto a container element.
 * 
 * @param carousel - UseCarouselReturn from useCarousel
 * 
 * @example
 * ```tsx
 * function CarouselContainer() {
 *   const carousel = useCarousel({ items });
 *   const handlers = useCarouselPointerEvents(carousel);
 *   
 *   return (
 *     <div {...handlers}>
 *       {carousel.itemStates.map(state => (
 *         <Card key={state.item.id} {...state} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCarouselPointerEvents(carousel: UseCarouselReturn) {
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const startTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const totalMovementRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isDownRef = useRef(false);

  // Use ref to access latest carousel state in callbacks
  const carouselRef = useRef(carousel);
  carouselRef.current = carousel;

  // Tap detection thresholds
  const TAP_MAX_DURATION = 300; // ms
  const TAP_MAX_MOVEMENT = 8; // px

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      console.log('[Carousel] Pointer down at:', e.clientX, e.clientY);
      const now = performance.now();
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      lastXRef.current = e.clientX;
      lastTimeRef.current = now;
      startTimeRef.current = now;
      velocityRef.current = 0;
      totalMovementRef.current = 0;
      isDraggingRef.current = false;
      isDownRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDownRef.current) return;
      
      const now = performance.now();
      const dt = now - lastTimeRef.current;
      const dx = e.clientX - lastXRef.current;
      
      // Track total movement from start
      totalMovementRef.current += Math.abs(dx);
      
      // Start drag if moved beyond tap threshold
      if (!isDraggingRef.current && totalMovementRef.current > TAP_MAX_MOVEMENT) {
        isDraggingRef.current = true;
        carouselRef.current.handleDragStart();
      }
      
      if (isDraggingRef.current) {
        if (dt > 0) {
          velocityRef.current = dx / dt * 1000; // px/s
        }
        carouselRef.current.handleDrag(dx);
      }
      
      lastXRef.current = e.clientX;
      lastTimeRef.current = now;
    },
    []
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDownRef.current) return;
      isDownRef.current = false;
      
      const duration = performance.now() - startTimeRef.current;
      const movement = totalMovementRef.current;
      
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture was already released
      }
      
      const currentCarousel = carouselRef.current;
      
      // Check if this was a tap (short duration, minimal movement)
      if (duration < TAP_MAX_DURATION && movement < TAP_MAX_MOVEMENT) {
        const clickX = e.clientX;
        const clickY = e.clientY;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        // Debug: log what we're working with
        console.log('[Carousel] Tap detected:', { duration, movement, clickX, clickY, itemCount: currentCarousel.itemStates.length });
        
        // Find the item closest to the click
        let closestItem: typeof currentCarousel.itemStates[0] | null = null;
        let closestDist = Infinity;
        
        for (const state of currentCarousel.itemStates) {
          // Item center position (relative to screen center)
          const itemX = centerX + state.x;
          const itemY = centerY;
          
          // Check if click is within reasonable bounds of item
          const dx = Math.abs(clickX - itemX);
          const dy = Math.abs(clickY - itemY);
          
          // Only consider items within card bounds (half width/height)
          if (dx < 180 && dy < 240) {
            const dist = dx + dy;
            if (dist < closestDist) {
              closestDist = dist;
              closestItem = state;
            }
          }
        }
        
        if (closestItem) {
          console.log('[Carousel] Item found:', closestItem.item.id);
          currentCarousel.handleItemTap(closestItem.item.id, clickX, clickY);
          return;
        } else {
          console.log('[Carousel] No item found at click position');
        }
      }
      
      // Otherwise end drag if we were dragging
      if (isDraggingRef.current) {
        carouselRef.current.handleDragEnd(velocityRef.current);
      }
      
      isDraggingRef.current = false;
    },
    []
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      carouselRef.current.handleWheel(e.deltaY);
    },
    []
  );

  // Stable handlers that don't change
  return useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave: onPointerUp,
      onWheel,
    }),
    [onPointerDown, onPointerMove, onPointerUp, onWheel]
  );
}
