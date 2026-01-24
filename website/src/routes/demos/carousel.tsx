/**
 * Carousel Demo - Using Library Primitives
 *
 * Demonstrates how to build a 3D carousel using @scene primitives:
 * - FabricWaveRenderer for GPU rendering with fabric wave effects
 * - Scrollable controller for scroll/drag interaction
 * - useMotion for spring animations
 * - Drag-to-dismiss gesture with threshold for expanded cards
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { A11yManager } from '@scene/a11y';
import { registerTransitionShaders } from '@scene/screen';
import { lerp, clamp } from '@scene/core';
import {
  SceneProvider,
  useSceneContext,
  useReducedMotion,
  useMotion,
  useGPU,
  useRenderLoop,
  useFrameRate,
  springs,
} from '@scene/react';
import { Scrollable } from '@scene/controllers';
import { StatusPanel } from '../../components/StatusPanel';
import {
  // Data
  CARD_DATA,
  // Utils
  calculateSnapPoints,
  calculateBounds,
  findCenterIndex,
  useResponsiveConfig,
  // Hooks
  useDismissGesture,
  useRippleAnimations,
  // Rendering
  CardTextureRenderer,
  FabricWaveRenderer,
  type FabricCardState,
  // UI
  LoadingOverlay,
} from '../../lib/carousel';

// ============================================
// Route Export
// ============================================

export const Route = createFileRoute('/demos/carousel')({
  component: CarouselPage,
});

function CarouselPage() {
  return (
    <SceneProvider mode="canvas-interactive" trackFPS>
      <CarouselDemo />
    </SceneProvider>
  );
}

// ============================================
// Animation State
// ============================================

interface AnimationState {
  lastOffset: number;
  centerIndex: number;
  lastExpandedIndex: number;
  pendingTextureReset: number;
  introStarted: boolean;
  introStartOffset: number;
  introTargetOffset: number;
  currentVisualOffset: number;
  /** Track last rendered expand progress per card for delta-based updates */
  lastTextureThreshold: Map<string, number>;
  /** Track last canvas dimensions to avoid redundant resizes */
  lastCanvasDims: { width: number; height: number };
  /** Post-drag: ignore wheel momentum after pointer drag */
  postDragEndTime: number;
}

function createInitialAnimState(): AnimationState {
  return {
    lastOffset: 0,
    centerIndex: Math.floor((CARD_DATA.length - 1) / 2),
    lastExpandedIndex: -1,
    pendingTextureReset: -1,
    introStarted: false,
    introStartOffset: 0,
    introTargetOffset: 0,
    currentVisualOffset: 0,
    lastTextureThreshold: new Map(),
    lastCanvasDims: { width: 0, height: 0 },
    postDragEndTime: 0,
  };
}

// ============================================
// Main Component
// ============================================

function CarouselDemo() {
  const { engine, registry, layoutTracker } = useSceneContext();
  const config = useResponsiveConfig();
  const prefersReducedMotion = useReducedMotion();

  // Check for ?fallback=true URL param for testing
  const forceFallback =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('fallback') === 'true';

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const scrollableRef = useRef<Scrollable | null>(null);
  const rendererRef = useRef<FabricWaveRenderer | null>(null);
  const rendererInitRef = useRef(0);
  const textureRendererRef = useRef<CardTextureRenderer | null>(null);
  const animStateRef = useRef<AnimationState>(createInitialAnimState());

  // State
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  const [centerTitle, setCenterTitle] = useState('--');
  const [expandedIndex, setExpandedIndex] = useState(-1);
  const [rendererReady, setRendererReady] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);

  // Motion values
  const bendMotion = useMotion(0);
  const expandMotion = useMotion(0);
  const introMotion = useMotion(0);

  // FPS tracking
  const { fps, tick: tickFps } = useFrameRate({ sampleSize: 60, updateInterval: 200 });

  // Ripple animations
  const ripples = useRippleAnimations({ prefersReducedMotion });

  // GPU initialization
  const gpu = useGPU(canvasRef, {
    powerPreference: 'high-performance',
    forceFallback,
    onRegisterShaders: (library) => registerTransitionShaders(library),
    onReady: () => setStatusMessage('GPU ready. Preparing carousel...'),
    onFallback: (reason: string) => {
      setStatusMessage(reason);
      setRendererReady(false);
    },
  });

  // Ensure render loop is running
  useEffect(() => {
    engine.stop();
    engine.start();
  }, [engine]);

  // Initialize texture renderer
  useEffect(() => {
    textureRendererRef.current = new CardTextureRenderer();
    return () => {
      textureRendererRef.current?.destroy();
      textureRendererRef.current = null;
    };
  }, []);

  // Initialize Scrollable
  useEffect(() => {
    const snapPoints = calculateSnapPoints(CARD_DATA.length, config.cardSpacing);
    const bounds = calculateBounds(CARD_DATA.length, config.cardSpacing);
    const initialIndex = Math.floor((CARD_DATA.length - 1) / 2);
    const targetOffset = snapPoints[initialIndex];
    const introStartOffset = targetOffset - window.innerWidth - config.cardSpacing * 2;

    const anim = animStateRef.current;
    anim.introTargetOffset = targetOffset;
    anim.introStartOffset = introStartOffset;
    anim.currentVisualOffset = anim.introStarted ? targetOffset : introStartOffset;

    const scrollable = new Scrollable({
      initialOffset: targetOffset,
      snapPoints,
      minOffset: bounds.min,
      maxOffset: bounds.max,
      autoSnap: false,
      snapThreshold: .1,
      useSpringSnap: true,
      snapSpring: springs.settle,
      wheelSensitivity: .68,
      dragSensitivity: 1,
      dragDecayDuration: 2000,
      friction: prefersReducedMotion ? 0.75 : 0.85,
      minVelocity: 0.05,
      velocityMultiplier: 0.2, // Reduce inertia acceleration
      direction: 'horizontal',
      rubberband: true,
      rubberbandFactor: 1,
      rubberbandDimension: config.cardWidth,
    });

    scrollableRef.current = scrollable;
    anim.lastOffset = anim.currentVisualOffset;

    scrollable.on('change', ({ offset }) => {
      const newCenter = findCenterIndex(offset, CARD_DATA.length, config.cardSpacing);
      if (newCenter !== anim.centerIndex) {
        anim.centerIndex = newCenter;
        setCenterTitle(CARD_DATA[newCenter].title);
      }
    });

    return () => {
      scrollable.destroy();
      scrollableRef.current = null;
    };
  }, [prefersReducedMotion, config]);

  // Initialize FabricWaveRenderer
  useEffect(() => {
    if (!gpu.isReady || !gpu.context || !textureRendererRef.current) return;

    let cancelled = false;
    const initId = ++rendererInitRef.current;
    const textureRenderer = textureRendererRef.current;

    const initRenderer = async () => {
      try {
        setStatusMessage('Preparing carousel...');
        setRendererReady(false);
        if (cancelled || initId !== rendererInitRef.current) return;

        const renderer = new FabricWaveRenderer(gpu.context!, { 
          cameraZ: config.cameraZ,
          segments: config.segments,
        });
        const initialized = await renderer.initialize();
        if (!initialized) {
          renderer.destroy();
          throw new Error('Renderer initialization failed.');
        }

        // Create initial textures
        const textures = CARD_DATA.map((card, index) => {
          const canvas = textureRenderer.render(card, index, config, 0);
          return { id: card.id, width: canvas.width, height: canvas.height, source: canvas };
        });

        await renderer.setCards(textures);
        if (cancelled || initId !== rendererInitRef.current) {
          renderer.destroy();
          return;
        }

        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          renderer.setViewport(rect.width || window.innerWidth, rect.height || window.innerHeight);
        }

        rendererRef.current?.destroy();
        rendererRef.current = renderer;
        setRendererReady(true);
        setStatusMessage('Ready. Click a card to expand.');

        // Load images in background
        for (const [index, card] of CARD_DATA.entries()) {
          textureRenderer.loadImage(card.image).then((img) => {
            if (img && rendererRef.current) {
              const updatedCanvas = textureRenderer.render(card, index, config, 0);
              rendererRef.current.updateCardTexture(card.id, updatedCanvas);
            }
          });
        }
      } catch (error: unknown) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setRendererReady(false);
        setStatusMessage(`Renderer error: ${message}`);
      }
    };

    initRenderer();

    return () => {
      cancelled = true;
      rendererInitRef.current += 1;
      setRendererReady(false);
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [gpu.isReady, gpu.context, config]);

  // Trigger intro animation
  useEffect(() => {
    if (!rendererReady) return;
    const anim = animStateRef.current;
    if (anim.introStarted) return;

    anim.introStarted = true;
    // Initialize scroll ripple direction for intro
    ripples.updateScrollRipple(0, 1, 1);

    introMotion.animateTo(1, {
      type: 'spring',
      stiffness: prefersReducedMotion ? 20 : 7,
      damping: prefersReducedMotion ? 8 : 5,
    });
  }, [rendererReady, prefersReducedMotion, ripples]);

  // A11y setup
  useEffect(() => {
    const mirrorRoot = mirrorRef.current;
    if (!mirrorRoot) return;

    const a11yManager = new A11yManager(engine, {
      registry,
      container: mirrorRoot,
      navigationAxis: 'horizontal',
      wrapNavigation: true,
      skipGhosts: true,
    });

    CARD_DATA.forEach((card) => {
      a11yManager.configure(card.id, { label: card.title, description: card.subtitle });
    });

    const unsubSelect = engine.events.on('a11y:select', ({ surfaceId }: { surfaceId: string | null }) => {
      if (surfaceId && scrollableRef.current) {
        const index = CARD_DATA.findIndex((c) => c.id === surfaceId);
        if (index >= 0) {
          const snapPoints = calculateSnapPoints(CARD_DATA.length, config.cardSpacing);
          scrollableRef.current.snapTo(snapPoints[index]);
        }
      }
    });

    const unsubActivate = engine.events.on('a11y:activate', ({ surfaceId }: { surfaceId: string | null }) => {
      if (surfaceId) {
        const index = CARD_DATA.findIndex((c) => c.id === surfaceId);
        if (index >= 0) {
          setExpandedIndex(index);
          animStateRef.current.lastExpandedIndex = index;
          expandMotion.animateTo(1, springs.settle);
        }
      }
    });

    return () => {
      unsubSelect();
      unsubActivate();
      a11yManager.destroy();
    };
  }, [engine, registry, config]);

  // Dismiss gesture hook
  const dismiss = useDismissGesture({
    cardWidth: config.cardWidth,
    cardHeight: config.cardHeight,
    onDismiss: useCallback(() => {
      if (expandedIndex < 0) return;
      const collapsingCard = CARD_DATA[expandedIndex];
      ripples.addCollapseRipple(collapsingCard.id);
      setExpandedIndex(-1);
      expandMotion.animateTo(0, springs.settle);
    }, [expandedIndex, ripples, expandMotion]),
  });

  // Helper to dismiss expanded card (wraps dismiss hook)
  const dismissExpandedCard = useCallback(() => {
    if (expandedIndex < 0) return;
    const collapsingCard = CARD_DATA[expandedIndex];
    ripples.addCollapseRipple(collapsingCard.id);
    dismiss.reset();
    setExpandedIndex(-1);
    expandMotion.animateTo(0, springs.settle);
  }, [expandedIndex, ripples, dismiss, expandMotion]);

  // Keyboard and wheel handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && expandedIndex >= 0) {
        dismissExpandedCard();
      }
    };

    const handleWheel = (e: WheelEvent): void => {
      e.preventDefault();
      
      if (expandedIndex >= 0) {
        // Use dismiss hook for wheel handling when expanded
        const deltaMagnitude = Math.sqrt(e.deltaX ** 2 + e.deltaY ** 2);
        
        // Ignore small deltas (trackpad inertia)
        if (deltaMagnitude < 3) return;
        
        // Calculate velocity for flick detection
        const velocity = deltaMagnitude / 16; // Approximate px/ms
        
        // handleWheel returns true if dismiss was triggered
        dismiss.handleWheel(e.deltaX, e.deltaY, velocity);
        return;
      }
      
      // When not expanded, scroll carousel
      const anim = animStateRef.current;
      const now = performance.now();
      
      // After pointer drag, ignore wheel momentum for 400ms
      const POST_DRAG_IGNORE_DURATION = 400;
      if (anim.postDragEndTime > 0 && now - anim.postDragEndTime < POST_DRAG_IGNORE_DURATION) {
        return;
      }
      
      // Use whichever axis has larger movement
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY;
      scrollableRef.current?.handleWheel(delta);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeydown);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [expandedIndex, dismissExpandedCard, dismiss]);

  // Tap handler
  const handleTap = useCallback(
    (clickX: number, clickY: number) => {
      const scrollable = scrollableRef.current;
      if (!scrollable) return;

      const anim = animStateRef.current;
      const isIntroing = introMotion.value < 0.99;
      const offset = anim.currentVisualOffset;

      if (isIntroing) {
        scrollable.setOffset(offset, false);
        introMotion.set(1);
        setIntroComplete(true);
      }

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const midIndex = (CARD_DATA.length - 1) / 2;

      // Find clicked card
      let closestIndex = -1;
      
      // Use expandedIndex directly - don't rely on motion value which can be stale in callback
      // If expandedIndex >= 0, a card is expanded and should get priority hit detection
      const visuallyExpandedIndex = expandedIndex;

      // PRIORITY: Check expanded card FIRST - it's visually in front
      // If click is within its bounds, it wins regardless of other cards
      if (visuallyExpandedIndex >= 0) {
        const i = visuallyExpandedIndex;
        
        // For the expanded card, use a generous hit zone (80% of screen)
        // The card dominates the screen when expanded
        const expandedHitWidth = window.innerWidth * 0.8;
        const expandedHitHeight = window.innerHeight * 0.8;
        
        // Expanded card is centered on screen
        const dx = Math.abs(clickX - centerX);
        const dy = Math.abs(clickY - centerY);

        // If click is within expanded card, it takes priority
        if (dx < expandedHitWidth / 2 && dy < expandedHitHeight / 2) {
          closestIndex = i;
        }
      }

      // Only check other cards if expanded card wasn't hit
      if (closestIndex < 0) {
        let closestDist = Infinity;
        for (let i = 0; i < CARD_DATA.length; i++) {
          // Skip the expanded card (already checked above)
          if (i === visuallyExpandedIndex) continue;
          
          const baseX = (i - midIndex) * config.cardSpacing + offset;
          const itemX = centerX + baseX;
          const hitWidth = config.cardWidth;
          const hitHeight = config.cardHeight;
          
          const dx = Math.abs(clickX - itemX);
          const dy = Math.abs(clickY - centerY);

          if (dx < hitWidth / 2 + 30 && dy < hitHeight / 2 + 30) {
            const dist = dx + dy;
            if (dist < closestDist) {
              closestDist = dist;
              closestIndex = i;
            }
          }
        }
      }

      if (closestIndex >= 0) {
        const card = CARD_DATA[closestIndex];
        const baseCardX = (closestIndex - midIndex) * config.cardSpacing + offset;
        
        // Use expanded position and size for ripple origin calculation
        const isVisuallyExpandedCard = closestIndex === visuallyExpandedIndex;
        let cardCenterX: number;
        let cardWidth: number;
        let cardHeight: number;
        
        if (isVisuallyExpandedCard) {
          // Expanded card is centered with larger visual size
          cardCenterX = centerX;
          // Use approximate visual size for ripple origin
          cardWidth = config.cardWidth * 2;
          cardHeight = config.cardHeight * 2;
        } else {
          cardCenterX = centerX + baseCardX;
          cardWidth = config.cardWidth;
          cardHeight = config.cardHeight;
        }
        const cardCenterY = centerY;

        const relativeX = (clickX - cardCenterX) / cardWidth + 0.5;
        const relativeY = (clickY - cardCenterY) / cardHeight + 0.5;

        // Add expand ripple
        ripples.addRipple(
          card.id,
          clamp(relativeX, 0, 1),
          1 - clamp(relativeY, 0, 1)
        );

        if (expandedIndex === closestIndex) {
          // Tapping the expanded card dismisses it (ripple already set above)
          ripples.addCollapseRipple(card.id);
          dismissExpandedCard();
        } else {
          if (expandedIndex >= 0) {
            anim.pendingTextureReset = expandedIndex;
          }
          const snapPoints = calculateSnapPoints(CARD_DATA.length, config.cardSpacing);
          scrollable.snapTo(snapPoints[closestIndex]);
          setExpandedIndex(closestIndex);
          anim.lastExpandedIndex = closestIndex;
          expandMotion.animateTo(1, springs.settle);
        }
      }
    },
    [expandedIndex, config, dismissExpandedCard]
  );

  // Drag start handler
  const handleDragStart = useCallback((startX: number, startY: number) => {
    const anim = animStateRef.current;
    const isIntroing = introMotion.value < 0.99;
    
    // Clear post-drag ignore state since user is starting a new drag
    anim.postDragEndTime = 0;

    if (isIntroing) {
      scrollableRef.current?.setOffset(anim.currentVisualOffset, false);
      introMotion.set(1);
      setIntroComplete(true);
    }

    if (expandedIndex >= 0) {
      // Use dismiss hook for gesture tracking
      dismiss.startDrag(startX, startY);
      return; // Don't start carousel scroll
    }
    scrollableRef.current?.handleDragStart();
  }, [expandedIndex, dismiss]);

  // Drag move handler for dismiss gesture
  const handleDragMove = useCallback((currentX: number, currentY: number) => {
    if (dismiss.isDragging() && expandedIndex >= 0) {
      dismiss.moveDrag(currentX, currentY);
    }
  }, [expandedIndex, dismiss]);

  // Drag end handler for dismiss gesture
  const handleDragEnd = useCallback(() => {
    if (dismiss.isDragging() && expandedIndex >= 0) {
      dismiss.endDrag();
    }
  }, [expandedIndex, dismiss]);

  // Custom pointer event handling with dismiss gesture support
  const pointerStateRef = useRef({
    isDown: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    totalMovement: 0,
    isDragging: false,
    startTime: 0,
  });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const state = pointerStateRef.current;
    state.isDown = true;
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    state.totalMovement = 0;
    state.isDragging = false;
    state.startTime = performance.now();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const state = pointerStateRef.current;
    if (!state.isDown) return;
    
    const dx = e.clientX - state.lastX;
    
    state.totalMovement += Math.sqrt(dx * dx + (e.clientY - state.lastY) ** 2);
    
    // Start drag if moved beyond threshold
    if (!state.isDragging && state.totalMovement > 8) {
      state.isDragging = true;
      handleDragStart(state.startX, state.startY);
    }
    
    if (state.isDragging) {
      if (dismiss.isDragging()) {
        // Handle dismiss gesture
        handleDragMove(e.clientX, e.clientY);
      } else {
        // Handle normal carousel scroll
        scrollableRef.current?.handleDrag(dx);
      }
    }
    
    state.lastX = e.clientX;
    state.lastY = e.clientY;
  }, [handleDragStart, handleDragMove, dismiss]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const state = pointerStateRef.current;
    if (!state.isDown) return;
    state.isDown = false;
    
    const duration = performance.now() - state.startTime;
    
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    
    // Check if this was a tap
    if (duration < 300 && state.totalMovement < 8) {
      handleTap(e.clientX, e.clientY);
    } else if (state.isDragging) {
      if (dismiss.isDragging()) {
        handleDragEnd();
      } else {
        scrollableRef.current?.handleDragEnd();
        // Mark time to ignore trackpad momentum wheel events
        animStateRef.current.postDragEndTime = performance.now();
      }
    }
    
    state.isDragging = false;
  }, [handleTap, handleDragEnd, dismiss]);

  const pointerEvents = useMemo(() => ({
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave: onPointerUp,
  }), [onPointerDown, onPointerMove, onPointerUp]);

  // Status items
  const statusItems = useMemo(
    () => [
      {
        id: 'fps',
        message: `FPS: ${fps}`,
        tone: fps >= 55 ? ('success' as const) : fps >= 30 ? ('warning' as const) : ('error' as const),
      },
      { id: 'status', message: statusMessage, tone: 'info' as const },
    ],
    [fps, statusMessage]
  );

  // Render loop
  useRenderLoop(
    ({ deltaTime }: { deltaTime: number }) => {
      tickFps();

      const anim = animStateRef.current;
      const scrollable = scrollableRef.current;
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;
      const textureRenderer = textureRendererRef.current;

      // Ensure viewport is set (only resize when dimensions actually change)
      if (canvas && renderer) {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.round(rect.width * dpr);
        const height = Math.round(rect.height * dpr);
        if (width > 0 && height > 0) {
          // Only update canvas dimensions when they actually change
          // Setting canvas.width/height triggers buffer reallocation
          if (anim.lastCanvasDims.width !== width || anim.lastCanvasDims.height !== height) {
            canvas.width = width;
            canvas.height = height;
            anim.lastCanvasDims = { width, height };
          }
          renderer.setViewport(rect.width, rect.height);
        }
      }

      if (!scrollable) return;

      // Intro animation
      const introProgress = introMotion.value;
      const isIntroing = introProgress < 0.99;

      if (!isIntroing && !introComplete && anim.introStarted) {
        setIntroComplete(true);
      }

      // Calculate current offset
      let offset: number;
      if (isIntroing) {
        const eased = 1 - Math.pow(1 - introProgress, 3);
        offset = lerp(anim.introStartOffset, anim.introTargetOffset, eased);
        anim.currentVisualOffset = offset;
      } else {
        offset = scrollable.offset;
        anim.currentVisualOffset = offset;
      }

      const velocity = isIntroing ? 0 : scrollable.velocity;
      const expandProgress = expandMotion.value;

      // Animate bend
      const targetBend =
        expandedIndex >= 0
          ? 0
          : clamp(velocity * config.bendScale * 0.00001, -config.bendClamp, config.bendClamp);

      if (Math.abs(targetBend - bendMotion.value) > 0.01) {
        bendMotion.animateTo(targetBend, {
          type: 'spring',
          stiffness: prefersReducedMotion ? 200 : 150,
          damping: prefersReducedMotion ? 30 : 25,
        });
      }

      const currentBend = bendMotion.value;
      const deltaMs = Math.max(deltaTime, 1);
      const deltaOffset = offset - anim.lastOffset;
      const frameVelocity = deltaOffset / deltaMs;

      // Scroll ripple
      let targetRipple: number;
      let scrollRippleDir: number;
      if (isIntroing) {
        targetRipple = Math.sin(introProgress * Math.PI) * 0.85;
        scrollRippleDir = 1;
      } else {
        const speed = Math.abs(frameVelocity) * 0.08;
        targetRipple = Math.min(Math.pow(speed, 0.45) * 1.5, 1.0);
        scrollRippleDir = deltaOffset !== 0 ? (deltaOffset > 0 ? 1 : -1) : ripples.getScrollRipple().direction;
      }

      const smoothing = Math.min(deltaMs * 0.02, 1);
      ripples.updateScrollRipple(targetRipple, scrollRippleDir, smoothing);
      anim.lastOffset = offset;

      // Animate ripples
      ripples.tick(deltaTime);

      // Handle pending texture reset
      if (anim.pendingTextureReset >= 0 && rendererReady && renderer && textureRenderer) {
        const resetCard = CARD_DATA[anim.pendingTextureReset];
        const updatedCanvas = textureRenderer.render(resetCard, anim.pendingTextureReset, config, 0);
        renderer.updateCardTexture(resetCard.id, updatedCanvas);
        anim.pendingTextureReset = -1;
      }

      // Get dismiss offset values for visual feedback
      const currentDismissX = dismiss.offsetX.value;
      const currentDismissY = dismiss.offsetY.value;

      // Compute card states
      const midIndex = (CARD_DATA.length - 1) / 2;
      const cardStates: FabricCardState[] = CARD_DATA.map((card, index) => {
        const baseX = (index - midIndex) * config.cardSpacing;
        const x = baseX + offset;
        const ripple = ripples.getRipple(card.id);
        const collapseRipple = ripples.getCollapseRipple(card.id);

        let finalX = x;
        let finalY = 0;
        let finalZ = 0;
        let opacity = 1;
        let scale = 1;

        const isCollapsing =
          expandedIndex === -1 && index === anim.lastExpandedIndex && expandProgress > 0.01;
        const isActiveCard = index === expandedIndex || isCollapsing;
        const isCollapseComplete =
          expandedIndex === -1 &&
          index === anim.lastExpandedIndex &&
          anim.lastExpandedIndex >= 0 &&
          expandProgress <= 0.01;

        if (expandProgress > 0) {
          if (isActiveCard) {
            scale = 1 + expandProgress * config.expandScale;
            // Z depth proportional to cameraZ for consistent perspective effect across devices
            // 0.15 factor gives ~1.18x perspective boost (cameraZ / (cameraZ - 0.15*cameraZ) = 1/0.85)
            finalZ = expandProgress * config.cameraZ * 0.15;
            finalX = lerp(x, 0, expandProgress);
            
            // Apply dismiss offset to expanded card for visual feedback
            // Note: Y is negated because screen Y (down positive) is opposite to 3D Y (up positive)
            // Apply during both expansion AND collapse so dismiss gesture animates smoothly
            finalX += currentDismissX;
            finalY = -currentDismissY;
          } else {
            opacity = 1 - expandProgress * 0.85;
            finalZ = -expandProgress * 100;
          }
        }

        // Update DOM fallback position
        const el = cardRefs.current.get(card.id);
        if (el && gpu.isFallback) {
          const perspective = config.cameraZ / (config.cameraZ - finalZ);
          const projectedX = finalX * perspective;
          const projectedY = finalY * perspective;
          const totalScale = perspective * scale;
          el.style.transform = `translate(-50%, -50%) translate(${projectedX}px, ${projectedY}px) scale(${totalScale})`;
          el.style.zIndex = String(Math.round(finalZ));
          el.style.opacity = String(opacity);
        }

        // Update card texture with delta-based throttling for smooth animation
        // Desktop: update frequently (delta 0.02 = ~50 updates per animation)
        // Mobile: update less often (delta 0.04 = ~25 updates) since texture is smaller
        const cardExpandProgress = isActiveCard ? expandProgress : 0;
        if (rendererReady && renderer && textureRenderer && (isActiveCard || isCollapseComplete)) {
          const targetProgress = isCollapseComplete ? 0 : cardExpandProgress;
          const lastProgress = anim.lastTextureThreshold.get(card.id) ?? -1;
          
          // Use larger delta on mobile for better performance
          const isMobile = window.innerWidth < 640;
          const minDelta = isMobile ? 0.04 : 0.02;
          
          // Update when: first render, progress changed significantly, or animation complete
          const shouldUpdate = 
            lastProgress < 0 || 
            Math.abs(targetProgress - lastProgress) >= minDelta ||
            targetProgress === 0 || 
            targetProgress >= 0.99;
          
          if (shouldUpdate) {
            anim.lastTextureThreshold.set(card.id, targetProgress);
            const updatedCanvas = textureRenderer.render(card, index, config, targetProgress);
            renderer.updateCardTexture(card.id, updatedCanvas);
          }
        }

        if (isCollapseComplete) {
          anim.lastExpandedIndex = -1;
        }

        return {
          id: card.id,
          x: finalX,
          y: finalY,
          z: finalZ,
          rotationY: -currentBend * 0.08 * (1 - expandProgress),
          width: config.cardWidth * scale,
          height: config.cardHeight * scale,
          opacity,
          rippleOrigin: ripple ? { x: ripple.originX, y: ripple.originY } : undefined,
          rippleProgress: ripple?.progress ?? 0,
          collapseProgress: collapseRipple?.progress ?? 0,
        };
      }).sort((a, b) => a.z - b.z);

      // Update GPU state and render
      if (rendererReady && renderer) {
        const scrollRipple = ripples.getScrollRipple();
        renderer.setGlobalState({
          globalBend: currentBend,
          wavePhaseOffset: offset * 0.001,
          scrollRipplePhase: offset * 0.001,
          scrollRippleIntensity: scrollRipple.intensity,
          scrollRippleDirection: scrollRipple.direction,
        });

        renderer.updateCards(cardStates);
        renderer.render([0.02, 0.02, 0.05, 1]);
      }

      // Only update layout tracker when not mid-animation (reduces DOM queries)
      if (expandProgress < 0.01 || expandProgress > 0.99) {
        layoutTracker.forceUpdate();
      }
    },
    { enabled: true }
  );

  return (
    <div ref={rootRef} className="dark min-h-screen bg-black text-foreground overflow-hidden">
      {/* Canvas layer */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 h-full w-full touch-none"
        style={{ zIndex: rendererReady ? 5 : -1, opacity: rendererReady ? 1 : 0 }}
        aria-hidden="true"
        {...(rendererReady ? pointerEvents : {})}
      />

      {/* DOM cards track - only shown when GPU initialization has FAILED */}
      {gpu.isFallback && (
        <DOMFallbackCards cardRefs={cardRefs} trackRef={trackRef} config={config} pointerEvents={pointerEvents} />
      )}

      {/* A11y mirror layer */}
      <div ref={mirrorRef} className="fixed inset-0 z-10 pointer-events-none" />

      {/* UI overlay */}
      <UIOverlay centerTitle={centerTitle} statusItems={statusItems} />

      {/* Loading overlay */}
      {!gpu.isFallback && !rendererReady && (
        <LoadingOverlay progress={gpu.progress.percent} message={gpu.progress.message} />
      )}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

interface DOMFallbackCardsProps {
  cardRefs: React.RefObject<Map<string, HTMLElement> | null>;
  trackRef: React.RefObject<HTMLDivElement | null>;
  config: ReturnType<typeof useResponsiveConfig>;
  pointerEvents: Record<string, unknown>;
}

function DOMFallbackCards({ cardRefs, trackRef, config, pointerEvents }: DOMFallbackCardsProps) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ perspective: '1600px', pointerEvents: 'auto', zIndex: 10 }}
      {...pointerEvents}
    >
      <div ref={trackRef} className="relative w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
        {CARD_DATA.map((card) => (
          <article
            key={card.id}
            ref={(el) => {
              if (el) cardRefs.current?.set(card.id, el);
              else cardRefs.current?.delete(card.id);
            }}
            data-surface-id={card.id}
            className="absolute left-1/2 top-1/2 text-white rounded-lg shadow-2xl overflow-hidden"
            style={{
              width: config.cardWidth,
              height: config.cardHeight,
              pointerEvents: 'none',
              transition: 'box-shadow 0.2s',
              backgroundColor: '#171717',
            }}
            aria-hidden="true"
            role="presentation"
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('${card.image}')` }}
            />
            <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-5 bg-black/60">
              <h3 className="text-lg sm:text-xl mb-1.5">{card.title}</h3>
              <p className="opacity-70 text-xs sm:text-sm">{card.subtitle}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

interface UIOverlayProps {
  centerTitle: string;
  statusItems: Array<{ id: string; message: string; tone: 'success' | 'warning' | 'error' | 'info' }>;
}

function UIOverlay({ centerTitle, statusItems }: UIOverlayProps) {
  return (
    <>
      {/* Header */}
      <div className="fixed inset-x-0 top-0 z-20 pointer-events-none">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6 pointer-events-auto">
          <header className="flex flex-col gap-1 sm:gap-2">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Scene Demo
            </p>
            <h1 className="text-lg sm:text-2xl font-semibold">Scene 3D Carousel</h1>
            <p className="max-w-xl text-xs sm:text-sm text-muted-foreground hidden sm:block">
              Drag or scroll to browse. Click a card to expand. Press Escape or scroll to collapse.
            </p>
          </header>
        </div>
      </div>

      {/* Status sidebar */}
      <div className="fixed right-4 top-4 sm:right-6 sm:top-6 z-20 w-auto sm:w-72 pointer-events-auto hidden sm:block">
        <StatusPanel items={statusItems} />
      </div>

      {/* Bottom info */}
      <div className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-20 flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
        <span className="text-muted-foreground">Centered:</span>
        <span className="font-semibold text-foreground">{centerTitle}</span>
      </div>
    </>
  );
}
