import { useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Engine, InteractionMode } from '@scene/core';
import { Surface, SurfaceRegistry, LayoutTracker } from '@scene/surfaces';
import { InputManager } from '@scene/input';
import { A11yManager } from '@scene/a11y';
import { TransitionCoordinator } from '@scene/navigation';
import { CarouselRenderer, ShaderLibrary, WebGPUContext } from '@scene/renderer';
import { registerTransitionShaders } from '@scene/screen';
import { StatusPanel } from '../../components/StatusPanel';

interface CardData {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  image: string;
}

interface CardTexture {
  id: string;
  width: number;
  height: number;
  source: HTMLCanvasElement;
}

interface CardState {
  id: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  width: number;
  height: number;
  bend: number;
  opacity: number;
}

export const Route = createFileRoute('/demos/carousel')({
  component: CarouselDemo,
});

const CARD_DATA: CardData[] = [
  {
    id: 'card-aurora',
    title: 'Aurora Drift',
    subtitle: 'Polar light study',
    body: 'A cinematic pass that reacts to drag velocity. The center card floats forward as the arc stabilizes.',
    image: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=800&fit=crop',
  },
  {
    id: 'card-ember',
    title: 'Ember Field',
    subtitle: 'Heat shimmer',
    body: 'Tracked surfaces map directly to DOM elements. Motion values drive distortion without owning timelines.',
    image: 'https://images.unsplash.com/photo-1518173946687-a4c036bc3c95?w=600&h=800&fit=crop',
  },
  {
    id: 'card-orbit',
    title: 'Orbit Lattice',
    subtitle: 'Parallax grid',
    body: 'Picking uses CPU intersection for now, keeping GPU dedicated to visual effects only.',
    image: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=600&h=800&fit=crop',
  },
  {
    id: 'card-chorus',
    title: 'Chorus Fold',
    subtitle: 'Dissolve transition',
    body: 'TransitionCoordinator clones ghost surfaces so visuals can persist across view changes.',
    image: 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=600&h=800&fit=crop',
  },
  {
    id: 'card-surge',
    title: 'Surge Bloom',
    subtitle: 'Vignette pulse',
    body: 'Screen effects stack is ready for post-processing passes, gated behind WebGPU availability.',
    image: 'https://images.unsplash.com/photo-1501630834273-4b5604d2ee31?w=600&h=800&fit=crop',
  },
  {
    id: 'card-drift',
    title: 'Driftline',
    subtitle: 'Glide inertia',
    body: 'Inertia continues rotation after drag end. The carousel settles with reduced-motion support.',
    image: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&h=800&fit=crop',
  },
  {
    id: 'card-veil',
    title: 'Veil Echo',
    subtitle: 'Focus sync',
    body: 'A11y mirrors stay in sync with selection and activation, keeping keyboard navigation intact.',
    image: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=600&h=800&fit=crop',
  },
];

const CARD_THEMES = [
  { primary: '#111111', secondary: '#1f1f1f' },
  { primary: '#1a1a1a', secondary: '#0f0f0f' },
  { primary: '#222222', secondary: '#141414' },
  { primary: '#191919', secondary: '#101010' },
];

function CarouselDemo() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const fallbackRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const bodyRefs = useRef<Map<string, HTMLParagraphElement>>(new Map());
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  const [centerTitle, setCenterTitle] = useState('--');
  const [gpuReady, setGpuReady] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const statusItems = useMemo(
    () => [
      { id: 'status', message: statusMessage, tone: 'info' as const },
      ...debugLogs.map((log, i) => { 
        const tone: 'error' | 'info' = log.includes('failed') || log.includes('null') ? 'error' : 'info';
        return { id: `debug-${i}`, message: log, tone };
      }),
    ],
    [statusMessage, debugLogs]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const track = trackRef.current;
    const mirrorRoot = mirrorRef.current;
    const fallback = fallbackRef.current;
    const root = rootRef.current;
    if (!canvas || !track || !mirrorRoot || !fallback || !root) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const imageCache = new Map<string, HTMLImageElement>();

    const state = {
      offset: 0,
      velocity: 0,
      isDragging: false,
      hoveredId: null as string | null,
      centerId: null as string | null,
      expandedId: null as string | null,
      expandProgress: 0,
      expandTarget: 0,
      dragBendTarget: 0,
      bend: 0,
      cardPop: new Map<string, number>(),
      // Ripple effect state per card
      ripples: new Map<string, { originX: number; originY: number; progress: number }>(),
      // Scroll ripple state (global, world-space)
      scrollRippleOriginX: 0,
      scrollRippleIntensity: 0,
      scrollRippleDirection: 0,
      scrollRipplePeak: 0,        // Peak intensity for easeOutExpo decay
      scrollRippleDecayT: 0,      // Decay progress (0 = peak, 1 = done)
      lastDragX: 0,  // Track drag position for direction
      // Wheel inertia state
      lastWheelTime: 0,
      wheelDecayActive: false,
      wheelDecayStartTime: 0,
      wheelInitialVelocity: 0,
    };

    const config = {
      cardSpacing: 320,
      popZ: 0,
      cardWidth: 300,
      cardHeight: 420,
      dragSensitivity: 1,
      wheelSensitivity: 1,
      velocitySensitivity: 1,
      bendScale: 3.0,
      bendClamp: 1.2,
      dragBendScale: 0.35,
    };

    const rendererConfig = { cameraZ: 1200 };

    const cardMap = new Map(CARD_DATA.map((card) => [card.id, card]));
    const cardElements = CARD_DATA.map((card) => cardRefs.current.get(card.id)).filter(
      (el): el is HTMLElement => el !== undefined
    );
    const cardBodyMap = bodyRefs.current;

    let cardTextures: CardTexture[] = createCardTextures();
    const registry = new SurfaceRegistry();
    const layoutTracker = new LayoutTracker(registry);
    const surfaceMap = new Map<string, Surface>();

    cardElements.forEach((cardEl) => {
      const surfaceId = cardEl.dataset.surfaceId ?? '';
      const surface = new Surface(surfaceId, cardEl);
      registry.add(surface);
      surfaceMap.set(surfaceId, surface);
    });

    layoutTracker.start();

    const engine = new Engine({
      canvas,
      mode: InteractionMode.CANVAS_INTERACTIVE,
      trackFPS: true,
    });

    const input = new InputManager(engine, {
      target: canvas,
      registry: {
        all: () => registry.regular(),
      },
      inertiaOptions: {
        friction: prefersReducedMotion ? 0.75 : 0.92,
        minVelocity: prefersReducedMotion ? 0.3 : 0.15,
      },
    });
    input.initialize(canvas);

    const a11y = new A11yManager(engine, {
      registry,
      container: mirrorRoot,
      navigationAxis: 'horizontal',
      wrapNavigation: true,
      skipGhosts: true,
    });

    CARD_DATA.forEach((card) => {
      a11y.configure(card.id, {
        label: card.title,
        description: card.subtitle,
      });
    });

    const transitionCoordinator = new TransitionCoordinator(engine, {
      surfaceRegistry: registry,
      defaultTimeoutMs: 5000,
    });

    const gpu = {
      context: new WebGPUContext(),
      shaderLibrary: null as ShaderLibrary | null,
      carousel: null as CarouselRenderer | null,
      ready: false,
      textures: {
        carousel: null as GPUTexture | null,
        detail: null as GPUTexture | null,
      },
    };

    const getScrollLimits = (): { minOffset: number; maxOffset: number } => {
      const cardCount = CARD_DATA.length;
      const midIndex = (cardCount - 1) / 2;
      const maxOffset = midIndex * config.cardSpacing;
      const minOffset = -midIndex * config.cardSpacing;
      return { minOffset, maxOffset };
    };

    const clamp = (value: number, min: number, max: number): number => {
      return Math.max(min, Math.min(max, value));
    };

    const clampOffset = (offset: number): number => {
      const { minOffset, maxOffset } = getScrollLimits();
      return clamp(offset, minOffset, maxOffset);
    };

    const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
    
    // EaseOutExpo: starts fast, decelerates smoothly to a gentle stop
    const easeOutExpo = (t: number): number => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);

    const setStatus = (message: string): void => {
      setStatusMessage(message);
    };

    const setHoverState = (surfaceId: string, isHovered: boolean): void => {
      const cardEl = cardElements.find((el) => el.dataset.surfaceId === surfaceId);
      if (!cardEl) return;
      cardEl.style.outline = isHovered ? '1px solid hsl(var(--foreground))' : 'none';
      cardEl.style.outlineOffset = '2px';
    };

    const updateGhostDom = (cardEl: HTMLElement, x: number, z: number): void => {
      const cameraZ = rendererConfig.cameraZ;
      const perspective = cameraZ / (cameraZ - z);
      const projectedX = x * perspective;
      const scale = perspective;
      cardEl.style.transform = `translate(-50%, -50%) translate(${projectedX}px, 0px) scale(${scale})`;
      cardEl.style.zIndex = String(Math.round(z));
    };

    const applyDomTransforms = (): void => {
      const cardCount = cardElements.length;
      const midIndex = (cardCount - 1) / 2;

      const frame = cardElements.map((cardEl, index) => {
        const baseX = (index - midIndex) * config.cardSpacing;
        const x = baseX + state.offset;
        const distance = Math.abs(x);
        return { cardEl, x, distance };
      });

      const closest = frame.reduce(
        (best, entry) => (entry.distance < best.distance ? entry : best),
        frame[0]
      );

      frame.forEach(({ cardEl, x }) => {
        const isCenter = cardEl === closest.cardEl;
        const popZ = isCenter ? config.popZ : 0;
        cardEl.style.transform = `translate(-50%, -50%) translate3d(${x}px, 0px, ${popZ}px)`;
        cardEl.style.zIndex = String(Math.round(popZ));
        const surface = surfaceMap.get(cardEl.dataset.surfaceId ?? '');
        if (surface) {
          surface.zIndex = Math.round(popZ);
        }
      });

      if (closest?.cardEl?.dataset?.surfaceId) {
        const closestId = closest.cardEl.dataset.surfaceId;
        if (closestId !== state.centerId) {
          state.centerId = closestId;
          const card = cardMap.get(closestId);
          setCenterTitle(card ? card.title : '--');
        }
      }

      layoutTracker.forceUpdate();
    };

    const applyCarouselTransforms = (): void => {
      if (!gpu.ready || !gpu.carousel) {
        applyDomTransforms();
        return;
      }

      const cardCount = cardElements.length;
      const midIndex = (cardCount - 1) / 2;
      const bendBase = state.bend;

      const frame = cardElements.map((cardEl, index) => {
        const baseX = (index - midIndex) * config.cardSpacing;
        const x = baseX + state.offset;
        const distance = Math.abs(x);
        return { cardEl, x, distance };
      });

      const closest = frame.reduce(
        (best, entry) => (entry.distance < best.distance ? entry : best),
        frame[0]
      );

      const expandProgress = state.expandProgress;
      const expandedId = state.expandedId;

      const cardStates: CardState[] = frame.map(({ cardEl, x, distance }) => {
        const cardId = cardEl.dataset.surfaceId ?? '';
        const isCenter = cardEl === closest.cardEl;
        const isExpanded = cardId === expandedId;

        const targetPop = isCenter && !expandedId ? config.popZ : 0;
        const currentPop = state.cardPop.get(cardId) ?? 0;
        const smoothPop = lerp(currentPop, targetPop, 0.12);
        state.cardPop.set(cardId, smoothPop);

        let finalX = x;
        let finalZ = smoothPop;
        let scale = 1;
        let opacity = 1;

        if (expandProgress > 0) {
          if (isExpanded) {
            scale = 1 + expandProgress * 0.6;
            finalZ = smoothPop + expandProgress * 300;
            finalX = lerp(x, 0, expandProgress);
          } else {
            opacity = 1 - expandProgress * 0.85;
            finalZ = smoothPop - expandProgress * 100;
          }
        }

        // Subtle per-card rotation based on bend (uniform fabric effect is handled globally)
        const rotationY = -bendBase * 0.08 * (1 - expandProgress);
        
        // Slight speed shift for parallax effect during drag
        const speedShift = bendBase * 30 * (1 - expandProgress);
        finalX += speedShift;

        updateGhostDom(cardEl, finalX, finalZ);

        const body = cardBodyMap.get(cardId);
        if (body) {
          const isVisible = isExpanded && expandProgress > 0.5;
          body.style.maxHeight = isVisible ? '200px' : '0px';
          body.style.opacity = isVisible ? '1' : '0';
        }

        const surface = surfaceMap.get(cardId);
        if (surface) {
          surface.zIndex = Math.round(finalZ);
        }

        // Get ripple state for this card
        const ripple = state.ripples.get(cardId);

        return {
          id: cardId,
          x: finalX,
          y: 0,
          z: finalZ,
          rotationY,
          width: config.cardWidth * scale,
          height: config.cardHeight * scale,
          bend: 0, // Per-card bend is 0; uniform fabric effect uses globalBend
          opacity,
          rippleOrigin: ripple ? { x: ripple.originX, y: ripple.originY } : undefined,
          rippleProgress: ripple?.progress ?? 0,
        };
      });

      if (closest?.cardEl?.dataset?.surfaceId) {
        const closestId = closest.cardEl.dataset.surfaceId;
        if (closestId !== state.centerId) {
          state.centerId = closestId;
          const card = cardMap.get(closestId);
          setCenterTitle(card ? card.title : '--');
        }
      }

      const sorted = [...cardStates].sort((a, b) => a.z - b.z);
      gpu.carousel.updateCards(sorted);
      layoutTracker.forceUpdate();
    };

    const snapToCard = (surfaceId: string): void => {
      const cardIndex = cardElements.findIndex((el) => el.dataset.surfaceId === surfaceId);
      if (cardIndex === -1) return;
      const midIndex = (cardElements.length - 1) / 2;
      const targetOffset = -(cardIndex - midIndex) * config.cardSpacing;
      state.offset = targetOffset;
      state.velocity = 0;
      applyCarouselTransforms();
    };

    const activateCard = (surfaceId: string): void => {
      if (state.expandedId === surfaceId) {
        state.expandedId = null;
        state.expandTarget = 0;
        return;
      }

      snapToCard(surfaceId);
      state.expandedId = surfaceId;
      state.expandTarget = 1;
    };

    const triggerRipple = (surfaceId: string, normalizedX: number, normalizedY: number): void => {
      state.ripples.set(surfaceId, {
        originX: normalizedX,
        originY: normalizedY,
        progress: 0.001, // Start just above 0 to trigger animation
      });
    };

    const loadImage = async (url: string): Promise<HTMLImageElement | null> => {
      if (imageCache.has(url)) {
        return imageCache.get(url) ?? null;
      }

      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          imageCache.set(url, img);
          resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
    };

    const preloadImages = async (): Promise<void> => {
      await Promise.all(CARD_DATA.map((card) => loadImage(card.image)));
    };

    function createCardTextures(): CardTexture[] {
      const dpr = window.devicePixelRatio || 1;
      return CARD_DATA.map((card, index) => {
        const canvasEl = document.createElement('canvas');
        canvasEl.width = Math.floor(config.cardWidth * dpr);
        canvasEl.height = Math.floor(config.cardHeight * dpr);
        const ctx = canvasEl.getContext('2d');
        if (!ctx) {
          return {
            id: card.id,
            width: canvasEl.width,
            height: canvasEl.height,
            source: canvasEl,
          };
        }

        ctx.scale(dpr, dpr);
        ctx.textBaseline = 'top';

        const img = imageCache.get(card.image);
        if (img) {
          const imgRatio = img.width / img.height;
          const cardRatio = config.cardWidth / config.cardHeight;
          let drawWidth = config.cardWidth;
          let drawHeight = config.cardHeight;
          let drawX = 0;
          let drawY = 0;

          if (imgRatio > cardRatio) {
            drawHeight = config.cardHeight;
            drawWidth = drawHeight * imgRatio;
            drawX = -(drawWidth - config.cardWidth) / 2;
          } else {
            drawWidth = config.cardWidth;
            drawHeight = drawWidth / imgRatio;
            drawY = -(drawHeight - config.cardHeight) / 2;
          }

          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(0, 0, config.cardWidth, config.cardHeight);
        } else {
          const theme = CARD_THEMES[index % CARD_THEMES.length];
          const gradient = ctx.createLinearGradient(0, 0, config.cardWidth, config.cardHeight);
          gradient.addColorStop(0, theme.primary);
          gradient.addColorStop(1, theme.secondary);
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, config.cardWidth, config.cardHeight);
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '600 18px Inter, system-ui, sans-serif';
        ctx.fillText(card.title, 14, config.cardHeight - 50);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '13px Inter, system-ui, sans-serif';
        ctx.fillText(card.subtitle, 14, config.cardHeight - 30);

        return {
          id: card.id,
          width: canvasEl.width,
          height: canvasEl.height,
          source: canvasEl,
        };
      });
    }

    const initializeGPU = async (): Promise<void> => {
      setStatus('Loading images...');
      await preloadImages();

      // Capture WebGPU logs for on-screen display
      const logs: string[] = [];
      const originalInfo = console.info;
      const originalWarn = console.warn;
      const originalError = console.error;
      
      console.info = (...args: unknown[]) => {
        const msg = args.map(a => String(a)).join(' ');
        if (msg.includes('[WebGPU]')) {
          logs.push(msg.replace('[WebGPU] ', ''));
          setDebugLogs([...logs]);
        }
        originalInfo.apply(console, args);
      };
      console.warn = (...args: unknown[]) => {
        const msg = args.map(a => String(a)).join(' ');
        if (msg.includes('[WebGPU]')) {
          logs.push(msg.replace('[WebGPU] ', ''));
          setDebugLogs([...logs]);
        }
        originalWarn.apply(console, args);
      };
      console.error = (...args: unknown[]) => {
        const msg = args.map(a => String(a)).join(' ');
        if (msg.includes('[WebGPU]')) {
          logs.push(msg.replace('[WebGPU] ', ''));
          setDebugLogs([...logs]);
        }
        originalError.apply(console, args);
      };

      const initialized = await gpu.context.initialize({
        canvas,
        powerPreference: 'high-performance',
        alphaMode: 'premultiplied',
      });
      
      // Restore original console methods
      console.info = originalInfo;
      console.warn = originalWarn;
      console.error = originalError;

      if (!initialized) {
        // Get detailed support info for better user messaging
        const browserInfo = gpu.context.browserInfo;
        
        let message = 'WebGPU unavailable. Running in DOM-only mode.';
        if (browserInfo.isIOSSafari) {
          if (browserInfo.iosVersion && browserInfo.iosVersion.major < 17) {
            message = `iOS ${browserInfo.iosVersion.major} doesn't support WebGPU. Update to iOS 17+ for GPU effects.`;
          } else if (browserInfo.iosVersion && browserInfo.iosVersion.major === 17 && browserInfo.iosVersion.minor < 4) {
            message = `WebGPU disabled. Enable in Settings → Safari → Advanced → Feature Flags → WebGPU`;
          } else if (!navigator.gpu) {
            // iOS 17.4+ but navigator.gpu missing - likely Lockdown Mode or Private Browsing
            message = `WebGPU blocked. Check: Lockdown Mode off? Not in Private Browsing? Feature Flags → WebGPU on?`;
          } else {
            message = `WebGPU adapter unavailable. Try restarting Safari.`;
          }
        }
        
        setStatus(message);
        gpu.ready = false;
        setGpuReady(false);
        engine.mode = InteractionMode.DOM_INTERACTIVE;
        canvas.style.opacity = '0';
        root.classList.add('dom-fallback');
        return;
      }

      if (!gpu.context.device) {
        setStatus('GPU device unavailable');
        return;
      }

      gpu.shaderLibrary = new ShaderLibrary();
      gpu.shaderLibrary.setDevice(gpu.context.device);
      gpu.shaderLibrary.registerDefaults();
      registerTransitionShaders(gpu.shaderLibrary);

      gpu.carousel = new CarouselRenderer(gpu.context, gpu.shaderLibrary, {
        cameraZ: rendererConfig.cameraZ,
      });
      gpu.carousel.initialize();

      cardTextures = createCardTextures();
      gpu.carousel.setCards(cardTextures);
      gpu.ready = true;
      setGpuReady(true);
      // Use logical (CSS) pixels for viewport to match DOM/mirror coordinate system
      const initRect = canvas.getBoundingClientRect();
      gpu.carousel.setViewport(initRect.width || window.innerWidth, initRect.height || window.innerHeight);
      setStatus('Ready. Click a card to expand.');
      canvas.style.opacity = '1';
      root.classList.remove('dom-fallback');
    };

    const resizeCanvas = (): void => {
      const rect = canvas.getBoundingClientRect();
      // Fallback to window dimensions if rect is empty
      const width = rect.width || window.innerWidth;
      const height = rect.height || window.innerHeight;
      if (width === 0 || height === 0) return;
      
      const dpr = window.devicePixelRatio || 1;
      const scaledWidth = Math.floor(width * dpr);
      const scaledHeight = Math.floor(height * dpr);
      
      // Canvas dimensions use physical pixels for rendering resolution
      if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
      }
      
      if (gpu.ready && gpu.carousel) {
        gpu.context.resize(width, height, dpr);
        cardTextures = createCardTextures();
        gpu.carousel.setCards(cardTextures);
        // Use logical (CSS) pixels for viewport to match DOM/mirror coordinate system
        gpu.carousel.setViewport(width, height);
      }
    };

    const wheelDecayDuration = prefersReducedMotion ? 400 : 800;  // ms
    
    const handleWheel = (event: WheelEvent): void => {
      if (state.expandedId) {
        state.expandedId = null;
        state.expandTarget = 0;
        return;
      }
      event.preventDefault();
      
      // Stop any active wheel decay when user resumes wheeling
      state.wheelDecayActive = false;
      
      const delta = -event.deltaY * 0.025;
      state.offset = clampOffset(state.offset + delta);
      
      // Set velocity for bend effect (same as drag)
      state.velocity = delta * 10;
      state.lastWheelTime = performance.now();

      // Trigger scroll ripple on wheel to match drag feedback
      const wheelSpeed = Math.abs(delta);
      const normalizedSpeed = Math.min(Math.pow(wheelSpeed, 0.75) * 0.8, 0.9);
      if (normalizedSpeed > state.scrollRippleIntensity) {
        state.scrollRippleIntensity = normalizedSpeed;
        state.scrollRipplePeak = normalizedSpeed;
        state.scrollRippleDecayT = 0;
      }
      state.scrollRippleDirection = delta > 0 ? 1 : delta < 0 ? -1 : state.scrollRippleDirection;
      
      applyCarouselTransforms();
    };

    const handleKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && state.expandedId) {
        state.expandedId = null;
        state.expandTarget = 0;
      }
    };

    const handleResize = (): void => {
      resizeCanvas();
      layoutTracker.forceUpdate();
    };

    input.onIntent('dragStart', ({ x }) => {
      state.isDragging = true;
      state.velocity = 0;
      state.dragBendTarget = 0;
      
      // Convert screen X to world X for scroll ripple origin
      // The canvas is centered, so screen center = world 0
      const rect = canvas.getBoundingClientRect();
      const screenCenterX = rect.width / 2;
      const worldX = (x - screenCenterX) - state.offset;  // Account for current scroll
      state.scrollRippleOriginX = worldX;
      state.lastDragX = x;
    });

    input.onIntent('drag', ({ deltaX }) => {
      state.offset = clampOffset(state.offset + deltaX * config.dragSensitivity);
      state.velocity = 0;
      state.dragBendTarget = clamp(
        deltaX * config.dragBendScale,
        -config.bendClamp,
        config.bendClamp
      );
      
      // Update scroll ripple intensity based on drag speed (very gentle)
      const dragSpeed = Math.abs(deltaX);
      const normalizedSpeed = Math.min(dragSpeed / 60, 0.4);  // Max 0.4, gentle ramp
      if (normalizedSpeed > state.scrollRippleIntensity) {
        state.scrollRippleIntensity = normalizedSpeed;
        state.scrollRipplePeak = normalizedSpeed;
        state.scrollRippleDecayT = 0;  // Reset decay
      }
      
      // Track direction (positive = dragging right = scrolling left)
      state.scrollRippleDirection = deltaX > 0 ? 1 : deltaX < 0 ? -1 : state.scrollRippleDirection;
      state.lastDragX += deltaX;  // Track cumulative position
      
      applyCarouselTransforms();
    });

    input.onIntent('dragEnd', () => {
      state.isDragging = false;
      state.dragBendTarget = 0;
    });

    input.onIntent('hoverEnter', ({ surfaceId }) => {
      state.hoveredId = surfaceId;
      setHoverState(surfaceId, true);
    });

    input.onIntent('hoverLeave', ({ surfaceId }) => {
      setHoverState(surfaceId, false);
      if (state.hoveredId === surfaceId) {
        state.hoveredId = null;
      }
    });

    input.onIntent('tap', ({ surfaceId, x, y }) => {
      if (!surfaceId) return;
      
      // Trigger ripple effect at click position
      const surface = surfaceMap.get(surfaceId);
      if (surface) {
        const rect = surface.rect;
        // Calculate normalized coordinates (0-1) within the card
        const normalizedX = Math.max(0, Math.min(1, (x - rect.x) / rect.width));
        const normalizedY = Math.max(0, Math.min(1, (y - rect.y) / rect.height));
        triggerRipple(surfaceId, normalizedX, normalizedY);
      }
      
      activateCard(surfaceId);
    });

    input.onIntent('inertia', (inertiaState) => {
      if (state.isDragging) return;
      state.velocity = inertiaState.isActive
        ? inertiaState.velocityX * config.velocitySensitivity
        : 0;
      
      // Gentle scroll ripple during inertia
      if (inertiaState.isActive && Math.abs(inertiaState.velocityX) > 10) {
        const inertiaSpeed = Math.abs(inertiaState.velocityX);
        const normalizedSpeed = Math.min(inertiaSpeed / 1200, 0.3);  // Cap at 0.3 for inertia
        if (normalizedSpeed > state.scrollRippleIntensity) {
          state.scrollRippleIntensity = normalizedSpeed;
          state.scrollRipplePeak = normalizedSpeed;
          state.scrollRippleDecayT = 0;  // Reset decay
        }
        state.scrollRippleDirection = inertiaState.velocityX > 0 ? 1 : -1;
      }
    });

    const unsubRender = engine.events.on('render', ({ deltaTime }) => {
      const targetBend = state.expandedId
        ? 0
        : state.isDragging
          ? state.dragBendTarget
          : clamp(state.velocity * config.bendScale * 0.01, -config.bendClamp, config.bendClamp);

      const distance = Math.abs(state.bend - targetBend);
      const maxDistance = config.bendClamp;
      const t = Math.min(distance / maxDistance, 1);
      const easedT = Math.pow(t, 0.25);
      const baseFactor = prefersReducedMotion ? 0.12 : 0.1;
      const tailFactor = 0.008;
      const lerpFactor = tailFactor + (baseFactor - tailFactor) * easedT;

      state.bend = lerp(state.bend, targetBend, lerpFactor);
      if (Math.abs(state.bend) < 0.0003) state.bend = 0;

      // Decay scroll ripple intensity with easeOutExpo
      if (state.scrollRipplePeak > 0 && state.scrollRippleDecayT < 1) {
        // Advance decay progress based on time
        const decaySpeed = prefersReducedMotion ? 0.0012 : 0.0006;  // Speed of decay (per ms)
        state.scrollRippleDecayT = Math.min(1, state.scrollRippleDecayT + deltaTime * decaySpeed);
        
        const rippleEase = easeOutExpo(state.scrollRippleDecayT);
        state.scrollRippleIntensity = state.scrollRipplePeak * (1 - rippleEase);
        
        if (state.scrollRippleIntensity < 0.001) {
          state.scrollRippleIntensity = 0;
          state.scrollRipplePeak = 0;
        }
      }
      
      // Update global state for uniform fabric effect
      if (gpu.ready && gpu.carousel) {
        gpu.carousel.setGlobalState({
          globalBend: state.bend,
          wavePhaseOffset: state.offset * 0.001, // Phase offset based on scroll position
          scrollRippleOriginX: state.scrollRippleOriginX,
          scrollRippleIntensity: state.scrollRippleIntensity,
          scrollRippleDirection: state.scrollRippleDirection,
        });
      }

      const expandLerp = prefersReducedMotion ? 0.15 : 0.1;
      state.expandProgress = lerp(state.expandProgress, state.expandTarget, expandLerp);
      if (Math.abs(state.expandProgress - state.expandTarget) < 0.001) {
        state.expandProgress = state.expandTarget;
      }

      // Apply velocity from drag inertia
      if (!state.isDragging && !state.expandedId && Math.abs(state.velocity) > 0.1) {
        const newOffset = clampOffset(state.offset + state.velocity * deltaTime);
        if (newOffset === state.offset) {
          state.velocity = 0;
        }
        state.offset = newOffset;
      }
      
      // Wheel inertia with easeOutExpo decay
      const now = performance.now();
      const timeSinceWheel = now - state.lastWheelTime;
      
      // Start decay after 80ms of no wheel events
      if (timeSinceWheel > 80 && !state.wheelDecayActive && Math.abs(state.velocity) > 0.1 && !state.isDragging) {
        state.wheelDecayActive = true;
        state.wheelDecayStartTime = now;
        state.wheelInitialVelocity = state.velocity;
      }
      
      // Apply easeOutExpo decay
      if (state.wheelDecayActive) {
        const elapsed = now - state.wheelDecayStartTime;
        const t = Math.min(elapsed / wheelDecayDuration, 1);
        
        // Velocity decays as 2^(-10*t) - same as drag inertia
        const velocityMultiplier = Math.pow(2, -10 * t);
        state.velocity = state.wheelInitialVelocity * velocityMultiplier;
        
        if (t >= 1 || Math.abs(state.velocity) < 0.1) {
          state.wheelDecayActive = false;
          state.velocity = 0;
        }
      }

      // Animate fabric billow - 2 second duration
      const rippleSpeed = prefersReducedMotion ? 0.7 : 0.5;
      for (const [cardId, ripple] of state.ripples) {
        ripple.progress += deltaTime * rippleSpeed * 0.001;
        if (ripple.progress >= 1) {
          state.ripples.delete(cardId);
        }
      }

      applyCarouselTransforms();

      if (gpu.ready && gpu.carousel) {
        gpu.carousel.render([0, 0, 0, 0]);
      }
    });

    const unsubSelect = engine.events.on('a11y:select', ({ surfaceId }) => {
      if (!surfaceId) return;
      snapToCard(surfaceId);
    });

    const unsubActivate = engine.events.on('a11y:activate', ({ surfaceId }) => {
      if (!surfaceId) return;
      activateCard(surfaceId);
    });

    // Initialize GPU and set up rendering
    initializeGPU().then(() => {
      // Ensure viewport is set after GPU init completes
      resizeCanvas();
      applyCarouselTransforms();
    });
    
    // Also do initial resize for DOM fallback case
    resizeCanvas();
    applyCarouselTransforms();

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', handleResize);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('resize', handleResize);
      unsubRender();
      unsubSelect();
      unsubActivate();
      layoutTracker.destroy();
      registry.clear();
      input.destroy();
      a11y.destroy();
      transitionCoordinator.destroy();
      engine.destroy();
      gpu.carousel?.destroy();
      gpu.context.destroy();
    };
  }, []);

  return (
    <div ref={rootRef} className="dark min-h-screen bg-black text-foreground overflow-hidden">
      {/* Canvas layer - renders WebGPU content */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 h-full w-full touch-none z-0"
        aria-hidden="true"
      />
      
      {/* DOM cards track - hidden when WebGPU active, visible for fallback */}
      <div 
        className="fixed inset-0 flex items-center justify-center z-0 pointer-events-none"
        style={{ perspective: '1600px' }}
      >
        <div
          ref={trackRef}
          className="relative w-full h-full"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {CARD_DATA.map((card) => (
            <article
              key={card.id}
              ref={(el) => {
                if (el) cardRefs.current.set(card.id, el);
                else cardRefs.current.delete(card.id);
              }}
              data-surface-id={card.id}
              className="absolute left-1/2 top-1/2 h-[420px] w-[300px] overflow-hidden bg-neutral-900 text-white"
              style={{
                opacity: gpuReady ? 0 : 1,
                pointerEvents: gpuReady ? 'none' : 'auto',
              }}
              aria-hidden="true"
              role="presentation"
            >
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url('${card.image}')` }}
              />
              <div className="absolute inset-0 flex flex-col justify-end p-5 bg-black/60">
                <h3 className="text-xl mb-1.5">{card.title}</h3>
                <p className="opacity-70 text-sm">{card.subtitle}</p>
                <p
                  ref={(el) => {
                    if (el) bodyRefs.current.set(card.id, el);
                    else bodyRefs.current.delete(card.id);
                  }}
                  data-card-body="true"
                  className="mt-3 text-[13px] leading-relaxed transition-all duration-300 ease-out"
                  style={{ maxHeight: 0, opacity: 0 }}
                >
                  {card.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
      
      {/* A11y mirror layer */}
      <div ref={mirrorRef} className="fixed inset-0 z-10 pointer-events-none" />
      
      {/* UI overlay - positioned above canvas but doesn't block interaction */}
      <div className="fixed inset-x-0 top-0 z-20 pointer-events-none">
        <div className="mx-auto max-w-6xl px-6 py-6 pointer-events-auto">
          <header className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Scene Demo
            </p>
            <h1 className="text-2xl font-semibold">Scene 3D Carousel</h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Drag or scroll to browse. Click a card to expand. Press Escape or scroll to collapse.
            </p>
          </header>
        </div>
      </div>
      
      {/* Status sidebar */}
      <div className="fixed right-6 top-6 z-20 w-72 pointer-events-auto">
        <StatusPanel items={statusItems} />
      </div>
      
      {/* Bottom info */}
      <div className="fixed bottom-6 left-6 z-20 flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">Centered:</span>
        <span className="font-semibold text-foreground">{centerTitle}</span>
      </div>
      
      {/* Fallback overlay */}
      <div
        ref={fallbackRef}
        className="fixed inset-0 z-30 bg-black opacity-0 transition-opacity pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}

