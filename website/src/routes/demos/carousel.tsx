/**
 * Carousel Demo - Refactored with @scene/react
 * 
 * Uses SceneProvider, useCarousel, and useSurface hooks
 * for declarative Scene integration.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { InteractionMode } from '@scene/core';
import { A11yManager } from '@scene/a11y';
import { ShaderLibrary, WebGPUContext } from '@scene/renderer';
import { registerTransitionShaders } from '@scene/screen';
import { SceneProvider, useSceneContext } from '@scene/react';
import { StatusPanel } from '../../components/StatusPanel';

// User-level carousel implementation (not part of Scene framework)
import {
  CarouselRenderer,
  useCarousel,
  useCarouselPointerEvents,
  type UseCarouselConfig,
  type CarouselItemState,
} from '../../lib/carousel';

// ============================================
// Types
// ============================================

interface CardData {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  image: string;
  label: string;
}

interface CardTexture {
  id: string;
  width: number;
  height: number;
  source: HTMLCanvasElement;
}

// ============================================
// Data
// ============================================

const CARD_DATA: CardData[] = [
  {
    id: 'card-aurora',
    title: 'Aurora Drift',
    subtitle: 'Polar light study',
    body: 'A cinematic pass that reacts to drag velocity. The center card floats forward as the arc stabilizes.',
    image: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=800&fit=crop',
    label: 'Aurora Drift',
  },
  {
    id: 'card-ember',
    title: 'Ember Field',
    subtitle: 'Heat shimmer',
    body: 'Tracked surfaces map directly to DOM elements. Motion values drive distortion without owning timelines.',
    image: 'https://images.unsplash.com/photo-1518173946687-a4c036bc3c95?w=600&h=800&fit=crop',
    label: 'Ember Field',
  },
  {
    id: 'card-orbit',
    title: 'Orbit Lattice',
    subtitle: 'Parallax grid',
    body: 'Picking uses CPU intersection for now, keeping GPU dedicated to visual effects only.',
    image: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=600&h=800&fit=crop',
    label: 'Orbit Lattice',
  },
  {
    id: 'card-chorus',
    title: 'Chorus Fold',
    subtitle: 'Dissolve transition',
    body: 'TransitionCoordinator clones ghost surfaces so visuals can persist across view changes.',
    image: 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=600&h=800&fit=crop',
    label: 'Chorus Fold',
  },
  {
    id: 'card-surge',
    title: 'Surge Bloom',
    subtitle: 'Vignette pulse',
    body: 'Screen effects stack is ready for post-processing passes, gated behind WebGPU availability.',
    image: 'https://images.unsplash.com/photo-1501630834273-4b5604d2ee31?w=600&h=800&fit=crop',
    label: 'Surge Bloom',
  },
  {
    id: 'card-drift',
    title: 'Driftline',
    subtitle: 'Glide inertia',
    body: 'Inertia continues rotation after drag end. The carousel settles with reduced-motion support.',
    image: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&h=800&fit=crop',
    label: 'Driftline',
  },
  {
    id: 'card-veil',
    title: 'Veil Echo',
    subtitle: 'Focus sync',
    body: 'A11y mirrors stay in sync with selection and activation, keeping keyboard navigation intact.',
    image: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=600&h=800&fit=crop',
    label: 'Veil Echo',
  },
];

const CARD_THEMES = [
  { primary: '#111111', secondary: '#1f1f1f' },
  { primary: '#1a1a1a', secondary: '#0f0f0f' },
  { primary: '#222222', secondary: '#141414' },
  { primary: '#191919', secondary: '#101010' },
];

const CONFIG = {
  cardSpacing: 320,
  cardWidth: 300,
  cardHeight: 420,
  cameraZ: 1200,
  bendScale: 3.0,
  bendClamp: 1.2,
};

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
// Main Component
// ============================================

function CarouselDemo() {
  const { engine, registry, layoutTracker } = useSceneContext();
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const bodyRefs = useRef<Map<string, HTMLParagraphElement>>(new Map());
  
  // Carousel ref - declared early so callbacks can access it
  const carouselRef = useRef<ReturnType<typeof useCarousel> | null>(null);
  
  // State
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  const [centerTitle, setCenterTitle] = useState('--');
  const [gpuReady, setGpuReady] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  
  // GPU resources ref
  const gpuRef = useRef<{
    context: WebGPUContext;
    shaderLibrary: ShaderLibrary | null;
    carousel: CarouselRenderer | null;
    ready: boolean;
  }>({
    context: new WebGPUContext(),
    shaderLibrary: null,
    carousel: null,
    ready: false,
  });
  
  // Animation state (for bend/ripple effects)
  const animStateRef = useRef({
    bend: 0,
    ripples: new Map<string, { originX: number; originY: number; progress: number }>(),
    scrollRippleIntensity: 0,
    scrollRipplePeak: 0,
    scrollRippleDecayT: 0,
    scrollRippleOriginX: 0,
    scrollRippleDirection: 0,
  });
  
  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
  
  // Carousel config - cast CARD_DATA to CarouselItem[] since it has id/label
  const carouselItems = useMemo(() => 
    CARD_DATA.map(card => ({ id: card.id, label: card.label, data: card })),
    []
  );
  
  const carouselConfig: UseCarouselConfig = useMemo(() => ({
    items: carouselItems,
    itemSpacing: CONFIG.cardSpacing,
    centerSnap: true,
    wheelSensitivity: 0.8,
    dragSensitivity: 2.5,
    friction: prefersReducedMotion ? 0.75 : 0.92,
    reducedMotion: prefersReducedMotion,
    onCenterChange: ({ item }) => {
      const card = item.data as CardData;
      setCenterTitle(card.title);
    },
    onItemTap: ({ item, x, y }) => {
      // Trigger ripple effect (expand/collapse is handled by Carousel.handleItemTap automatically)
      const card = item.data as CardData;
      const el = cardRefs.current.get(card.id);
      if (el) {
        const rect = el.getBoundingClientRect();
        const normalizedX = Math.max(0, Math.min(1, (x - rect.x) / rect.width));
        const normalizedY = Math.max(0, Math.min(1, (y - rect.y) / rect.height));
        animStateRef.current.ripples.set(card.id, {
          originX: normalizedX,
          originY: normalizedY,
          progress: 0.001,
        });
      }
    },
    onOffsetChange: ({ velocity }) => {
      // Update scroll ripple - unified fabric wave across all cards
      const speed = Math.abs(velocity) * 0.025;
      const normalizedSpeed = Math.min(Math.pow(speed, 0.55) * 1.0, 0.7);
      const anim = animStateRef.current;
      if (normalizedSpeed > anim.scrollRippleIntensity) {
        anim.scrollRippleIntensity = normalizedSpeed;
        anim.scrollRipplePeak = normalizedSpeed;
        anim.scrollRippleDecayT = 0;
      }
      anim.scrollRippleDirection = velocity > 0 ? 1 : velocity < 0 ? -1 : anim.scrollRippleDirection;
    },
  }), [prefersReducedMotion, carouselItems]);
  
  const carousel = useCarousel(carouselConfig);
  const pointerEvents = useCarouselPointerEvents(carousel);
  
  // Update carousel ref for use in callbacks and render loop
  carouselRef.current = carousel;
  
  // Direct click handler for tap detection
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('[Carousel Demo] Canvas clicked at:', e.clientX, e.clientY);
    
    const currentCarousel = carouselRef.current;
    if (!currentCarousel) return;
    
    const clickX = e.clientX;
    const clickY = e.clientY;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    // Find the item closest to the click (use live controller state)
    const itemStates = currentCarousel.carousel.computeItemStates();
    for (const state of itemStates) {
      const itemX = centerX + state.x;
      const dx = Math.abs(clickX - itemX);
      const dy = Math.abs(clickY - centerY);
      
      if (dx < 180 && dy < 240) {
        console.log('[Carousel Demo] Found item:', state.item.id);
        currentCarousel.handleItemTap(state.item.id, clickX, clickY);
        return;
      }
    }
    console.log('[Carousel Demo] No item at click position');
  }, []);
  
  // Status items for panel
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
  
  // Image preloading
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  
  const loadImage = useCallback(async (url: string): Promise<HTMLImageElement | null> => {
    if (imageCache.current.has(url)) {
      return imageCache.current.get(url) ?? null;
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache.current.set(url, img);
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }, []);
  
  // Create card textures for GPU rendering
  const createCardTextures = useCallback((): CardTexture[] => {
    const dpr = window.devicePixelRatio || 1;
    return CARD_DATA.map((card, index) => {
      const canvasEl = document.createElement('canvas');
      canvasEl.width = Math.floor(CONFIG.cardWidth * dpr);
      canvasEl.height = Math.floor(CONFIG.cardHeight * dpr);
      const ctx = canvasEl.getContext('2d');
      if (!ctx) {
        return { id: card.id, width: canvasEl.width, height: canvasEl.height, source: canvasEl };
      }
      
      ctx.scale(dpr, dpr);
      ctx.textBaseline = 'top';
      
      const img = imageCache.current.get(card.image);
      if (img) {
        const imgRatio = img.width / img.height;
        const cardRatio = CONFIG.cardWidth / CONFIG.cardHeight;
        let drawWidth = CONFIG.cardWidth, drawHeight = CONFIG.cardHeight, drawX = 0, drawY = 0;
        
        if (imgRatio > cardRatio) {
          drawHeight = CONFIG.cardHeight;
          drawWidth = drawHeight * imgRatio;
          drawX = -(drawWidth - CONFIG.cardWidth) / 2;
        } else {
          drawWidth = CONFIG.cardWidth;
          drawHeight = drawWidth / imgRatio;
          drawY = -(drawHeight - CONFIG.cardHeight) / 2;
        }
        
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, CONFIG.cardWidth, CONFIG.cardHeight);
      } else {
        const theme = CARD_THEMES[index % CARD_THEMES.length];
        const gradient = ctx.createLinearGradient(0, 0, CONFIG.cardWidth, CONFIG.cardHeight);
        gradient.addColorStop(0, theme.primary);
        gradient.addColorStop(1, theme.secondary);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CONFIG.cardWidth, CONFIG.cardHeight);
      }
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = '600 18px Inter, system-ui, sans-serif';
      ctx.fillText(card.title, 14, CONFIG.cardHeight - 50);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '13px Inter, system-ui, sans-serif';
      ctx.fillText(card.subtitle, 14, CONFIG.cardHeight - 30);
      
      return { id: card.id, width: canvasEl.width, height: canvasEl.height, source: canvasEl };
    });
  }, []);
  
  // GPU initialization
  useEffect(() => {
    const canvas = canvasRef.current;
    const mirrorRoot = mirrorRef.current;
    const root = rootRef.current;
    if (!canvas || !mirrorRoot || !root) return;
    
    const gpu = gpuRef.current;
    let a11yManager: A11yManager | null = null;
    
    const initializeGPU = async () => {
      setStatusMessage('Loading images...');
      await Promise.all(CARD_DATA.map((card) => loadImage(card.image)));
      
      // Capture WebGPU logs
      const logs: string[] = [];
      const originalInfo = console.info;
      console.info = (...args: unknown[]) => {
        const msg = args.map(a => String(a)).join(' ');
        if (msg.includes('[WebGPU]')) {
          logs.push(msg.replace('[WebGPU] ', ''));
          setDebugLogs([...logs]);
        }
        originalInfo.apply(console, args);
      };
      
      const initialized = await gpu.context.initialize({
        canvas,
        powerPreference: 'high-performance',
        alphaMode: 'premultiplied',
      });
      
      console.info = originalInfo;
      
      if (!initialized || !gpu.context.device) {
        const browserInfo = gpu.context.browserInfo;
        let message = 'WebGPU unavailable. Running in DOM-only mode.';
        if (browserInfo.isIOSSafari) {
          if (browserInfo.iosVersion && browserInfo.iosVersion.major < 17) {
            message = `iOS ${browserInfo.iosVersion.major} doesn't support WebGPU.`;
          } else if (browserInfo.iosVersion && browserInfo.iosVersion.major === 17 && browserInfo.iosVersion.minor < 4) {
            message = `WebGPU disabled. Enable in Settings → Safari → Advanced → Feature Flags`;
          }
        }
        setStatusMessage(message);
        gpu.ready = false;
        setGpuReady(false);
        engine.mode = InteractionMode.DOM_INTERACTIVE;
        canvas.style.opacity = '0';
        root.classList.add('dom-fallback');
        return;
      }
      
      gpu.shaderLibrary = new ShaderLibrary();
      gpu.shaderLibrary.setDevice(gpu.context.device);
      gpu.shaderLibrary.registerDefaults();
      registerTransitionShaders(gpu.shaderLibrary);
      
      gpu.carousel = new CarouselRenderer(gpu.context, gpu.shaderLibrary, { cameraZ: CONFIG.cameraZ });
      gpu.carousel.initialize();
      
      const textures = createCardTextures();
      gpu.carousel.setCards(textures);
      gpu.ready = true;
      setGpuReady(true);
      
      const rect = canvas.getBoundingClientRect();
      gpu.carousel.setViewport(rect.width || window.innerWidth, rect.height || window.innerHeight);
      setStatusMessage('Ready. Click a card to expand.');
      canvas.style.opacity = '1';
      root.classList.remove('dom-fallback');
    };
    
    // Set up A11y
    a11yManager = new A11yManager(engine, {
      registry,
      container: mirrorRoot,
      navigationAxis: 'horizontal',
      wrapNavigation: true,
      skipGhosts: true,
    });
    CARD_DATA.forEach((card) => {
      a11yManager!.configure(card.id, { label: card.title, description: card.subtitle });
    });
    
    // Note: Input handling is done via useCarouselPointerEvents hook
    // which is spread onto the canvas as {...pointerEvents}
    
    // Resize handling
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || window.innerWidth;
      const height = rect.height || window.innerHeight;
      if (width === 0 || height === 0) return;
      
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      
      if (gpu.ready && gpu.carousel) {
        gpu.context.resize(width, height, dpr);
        const textures = createCardTextures();
        gpu.carousel.setCards(textures);
        gpu.carousel.setViewport(width, height);
      }
    };
    
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && carouselRef.current?.hasExpanded) {
        carouselRef.current.collapseItem();
      }
    };
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      carouselRef.current?.handleWheel(e.deltaY);
    };
    
    // Animation loop
    const easeOutExpo = (t: number): number => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
    const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
    const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
    
    const unsubRender = engine.events.on('render', ({ deltaTime }: { deltaTime: number }) => {
      const anim = animStateRef.current;
      const currentCarousel = carouselRef.current;
      if (!currentCarousel) return;
      
      // Use live expandProgress from controller (not React state which lags)
      const expandProgress = currentCarousel.carousel.expandProgress;
      
      // Calculate target bend from velocity (use live controller values)
      const controller = currentCarousel.carousel;
      const targetBend = controller.hasExpanded
        ? 0
        : clamp(controller.velocity * CONFIG.bendScale * 0.00001, -CONFIG.bendClamp, CONFIG.bendClamp);
      
      // Smooth bend
      const distance = Math.abs(anim.bend - targetBend);
      const t = Math.min(distance / CONFIG.bendClamp, 1);
      const baseFactor = prefersReducedMotion ? 0.12 : 0.1;
      const lerpFactor = 0.008 + (baseFactor - 0.008) * Math.pow(t, 0.25);
      anim.bend = lerp(anim.bend, targetBend, lerpFactor);
      if (Math.abs(anim.bend) < 0.0003) anim.bend = 0;
      
      // Decay scroll ripple
      if (anim.scrollRipplePeak > 0 && anim.scrollRippleDecayT < 1) {
        const decaySpeed = prefersReducedMotion ? 0.0012 : 0.0006;
        anim.scrollRippleDecayT = Math.min(1, anim.scrollRippleDecayT + deltaTime * decaySpeed);
        anim.scrollRippleIntensity = anim.scrollRipplePeak * (1 - easeOutExpo(anim.scrollRippleDecayT));
        if (anim.scrollRippleIntensity < 0.001) {
          anim.scrollRippleIntensity = 0;
          anim.scrollRipplePeak = 0;
        }
      }
      
      // Animate ripples
      const rippleSpeed = prefersReducedMotion ? 0.7 : 0.5;
      for (const [cardId, ripple] of anim.ripples) {
        ripple.progress += deltaTime * rippleSpeed * 0.001;
        if (ripple.progress >= 1) anim.ripples.delete(cardId);
      }
      
      // Update GPU state and render
      const gpu = gpuRef.current;
      if (gpu.ready && gpu.carousel) {
        gpu.carousel.setGlobalState({
          globalBend: anim.bend,
          wavePhaseOffset: controller.offset * 0.001,
          scrollRippleOriginX: anim.scrollRippleOriginX,
          scrollRippleIntensity: anim.scrollRippleIntensity,
          scrollRippleDirection: anim.scrollRippleDirection,
        });
        
        // Build card states for GPU
        // Use live item states from controller
        const cardStates = controller.computeItemStates().map((state: CarouselItemState) => {
          const card = state.item.data as CardData;
          const ripple = anim.ripples.get(card.id);
          let finalX = state.x;
          let finalZ = state.isCenter ? 0 : 0;
          let opacity = 1;
          let scale = 1;
          
          if (expandProgress > 0) {
            if (state.isExpanded) {
              scale = 1 + expandProgress * 0.6;
              finalZ = expandProgress * 300;
              finalX = lerp(state.x, 0, expandProgress);
            } else {
              opacity = 1 - expandProgress * 0.85;
              finalZ = -expandProgress * 100;
            }
          }
          
          // Update DOM ghost position
          const el = cardRefs.current.get(card.id);
          if (el) {
            const perspective = CONFIG.cameraZ / (CONFIG.cameraZ - finalZ);
            const projectedX = finalX * perspective;
            el.style.transform = `translate(-50%, -50%) translate(${projectedX}px, 0px) scale(${perspective})`;
            el.style.zIndex = String(Math.round(finalZ));
          }
          
          // Update body visibility
          const body = bodyRefs.current.get(card.id);
          if (body) {
            const isVisible = state.isExpanded && expandProgress > 0.5;
            body.style.maxHeight = isVisible ? '200px' : '0px';
            body.style.opacity = isVisible ? '1' : '0';
          }
          
          return {
            id: card.id,
            x: finalX,
            y: 0,
            z: finalZ,
            rotationY: -anim.bend * 0.08 * (1 - expandProgress),
            width: CONFIG.cardWidth * scale,
            height: CONFIG.cardHeight * scale,
            bend: 0,
            opacity,
            rippleOrigin: ripple ? { x: ripple.originX, y: ripple.originY } : undefined,
            rippleProgress: ripple?.progress ?? 0,
          };
        }).sort((a: { z: number }, b: { z: number }) => a.z - b.z);
        
        gpu.carousel.updateCards(cardStates);
        gpu.carousel.render([0, 0, 0, 0]);
      }
      
      layoutTracker.forceUpdate();
    });
    
    // A11y events
    const unsubSelect = engine.events.on('a11y:select', ({ surfaceId }: { surfaceId: string | null }) => {
      if (surfaceId) carouselRef.current?.scrollToItem(surfaceId);
    });
    const unsubActivate = engine.events.on('a11y:activate', ({ surfaceId }: { surfaceId: string | null }) => {
      if (surfaceId) {
        const index = CARD_DATA.findIndex(c => c.id === surfaceId);
        if (index >= 0) carouselRef.current?.expandItem(index);
      }
    });
    
    initializeGPU().then(resizeCanvas);
    resizeCanvas();
    
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('resize', resizeCanvas);
      unsubRender();
      unsubSelect();
      unsubActivate();
      a11yManager?.destroy();
      gpu.carousel?.destroy();
      gpu.context.destroy();
    };
  // Note: carousel is accessed via carouselRef to avoid infinite re-initialization loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, registry, layoutTracker, loadImage, createCardTextures, prefersReducedMotion]);
  
  return (
    <div ref={rootRef} className="dark min-h-screen bg-black text-foreground overflow-hidden">
      {/* Canvas layer - z-5 to be above DOM cards but below UI */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 h-full w-full touch-none z-[5]"
        aria-hidden="true"
        onClick={handleCanvasClick}
        {...pointerEvents}
      />
      
      {/* DOM cards track */}
      <div 
        className="fixed inset-0 flex items-center justify-center z-0 pointer-events-none"
        style={{ perspective: '1600px' }}
      >
        <div ref={trackRef} className="relative w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
          {CARD_DATA.map((card) => (
            <article
              key={card.id}
              ref={(el) => {
                if (el) cardRefs.current.set(card.id, el);
                else cardRefs.current.delete(card.id);
              }}
              data-surface-id={card.id}
              className="absolute left-1/2 top-1/2 h-[420px] w-[300px] overflow-hidden bg-neutral-900 text-white"
              style={{ opacity: gpuReady ? 0 : 1, pointerEvents: gpuReady ? 'none' : 'auto' }}
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
      
      {/* UI overlay */}
      <div className="fixed inset-x-0 top-0 z-20 pointer-events-none">
        <div className="mx-auto max-w-6xl px-6 py-6 pointer-events-auto">
          <header className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Scene Demo</p>
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
    </div>
  );
}
