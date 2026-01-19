import { Engine, InteractionMode } from '@scene/core';
import { Surface, SurfaceRegistry, LayoutTracker } from '@scene/surfaces';
import { InputManager } from '@scene/input';
import { A11yManager } from '@scene/a11y';
import { TransitionCoordinator } from '@scene/navigation';
import { WebGPUContext, ShaderLibrary, CarouselRenderer } from '@scene/renderer';
import { TransitionEffect, registerTransitionShaders } from '@scene/screen';

const CARD_DATA = [
  {
    id: 'card-aurora',
    title: 'Aurora Drift',
    subtitle: 'Polar light study',
    body: 'A cinematic pass that reacts to drag velocity. The center card floats forward as the arc stabilizes.',
    image: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=800&fit=crop'
  },
  {
    id: 'card-ember',
    title: 'Ember Field',
    subtitle: 'Heat shimmer',
    body: 'Tracked surfaces map directly to DOM elements. Motion values drive distortion without owning timelines.',
    image: 'https://images.unsplash.com/photo-1518173946687-a4c036bc3c95?w=600&h=800&fit=crop'
  },
  {
    id: 'card-orbit',
    title: 'Orbit Lattice',
    subtitle: 'Parallax grid',
    body: 'Picking uses CPU intersection for now, keeping GPU dedicated to visual effects only.',
    image: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=600&h=800&fit=crop'
  },
  {
    id: 'card-chorus',
    title: 'Chorus Fold',
    subtitle: 'Dissolve transition',
    body: 'TransitionCoordinator clones ghost surfaces so visuals can persist across view changes.',
    image: 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=600&h=800&fit=crop'
  },
  {
    id: 'card-surge',
    title: 'Surge Bloom',
    subtitle: 'Vignette pulse',
    body: 'Screen effects stack is ready for post-processing passes, gated behind WebGPU availability.',
    image: 'https://images.unsplash.com/photo-1501630834273-4b5604d2ee31?w=600&h=800&fit=crop'
  },
  {
    id: 'card-drift',
    title: 'Driftline',
    subtitle: 'Glide inertia',
    body: 'Inertia continues rotation after drag end. The carousel settles with reduced-motion support.',
    image: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&h=800&fit=crop'
  },
  {
    id: 'card-veil',
    title: 'Veil Echo',
    subtitle: 'Focus sync',
    body: 'A11y mirrors stay in sync with selection and activation, keeping keyboard navigation intact.',
    image: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=600&h=800&fit=crop'
  },
  {
    id: 'card-prism',
    title: 'Prism Shift',
    subtitle: 'Light refraction',
    body: 'Chromatic aberration splits color channels at the edges, creating a holographic dispersion effect.',
    image: 'https://images.unsplash.com/photo-1550684376-efcbd6e3f031?w=600&h=800&fit=crop'
  },
  {
    id: 'card-nebula',
    title: 'Nebula Core',
    subtitle: 'Cosmic dust',
    body: 'Particle systems rendered in compute shaders simulate billions of dust motes in real-time.',
    image: 'https://images.unsplash.com/photo-1462332420958-a05d1e002413?w=600&h=800&fit=crop'
  },
  {
    id: 'card-glacier',
    title: 'Glacier Pulse',
    subtitle: 'Ice formation',
    body: 'Procedural crystalline growth patterns emerge from Voronoi tessellation algorithms.',
    image: 'https://images.unsplash.com/photo-1489549132488-d00b7eee80f1?w=600&h=800&fit=crop'
  },
  {
    id: 'card-cipher',
    title: 'Cipher Grid',
    subtitle: 'Data matrix',
    body: 'ASCII rain cascades through the viewport, each character a node in the neural mesh.',
    image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&h=800&fit=crop'
  },
  {
    id: 'card-flux',
    title: 'Flux Ribbon',
    subtitle: 'Magnetic field',
    body: 'Vector fields visualize invisible forces, bending light along curved spacetime paths.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=800&fit=crop'
  },
  {
    id: 'card-void',
    title: 'Void Passage',
    subtitle: 'Event horizon',
    body: 'Gravitational lensing warps the background as objects approach the singularity threshold.',
    image: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600&h=800&fit=crop'
  },
  {
    id: 'card-terra',
    title: 'Terra Form',
    subtitle: 'Erosion sim',
    body: 'Hydraulic erosion carves valleys through height maps, simulating geological time scales.',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=800&fit=crop'
  },
  {
    id: 'card-synth',
    title: 'Synth Wave',
    subtitle: 'Audio reactive',
    body: 'Frequency bands drive vertex displacement, turning sound into sculptural geometry.',
    image: 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=600&h=800&fit=crop'
  },
  {
    id: 'card-helix',
    title: 'Helix Strand',
    subtitle: 'DNA spiral',
    body: 'Double helix structures twist through 3D space, base pairs encoded as color gradients.',
    image: 'https://images.unsplash.com/photo-1530973428-5bf2db2e4d71?w=600&h=800&fit=crop'
  },
  {
    id: 'card-aether',
    title: 'Aether Bloom',
    subtitle: 'Ethereal glow',
    body: 'Volumetric fog scatters light rays, creating atmospheric depth and god ray effects.',
    image: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=600&h=800&fit=crop'
  }
];

const CARD_THEMES = [
  { primary: '#1d4ed8', secondary: '#0f172a' },
  { primary: '#9333ea', secondary: '#111827' },
  { primary: '#0ea5e9', secondary: '#0b1120' },
  { primary: '#14b8a6', secondary: '#0f172a' },
  { primary: '#f97316', secondary: '#1f2937' },
  { primary: '#22c55e', secondary: '#0f172a' },
  { primary: '#e879f9', secondary: '#111827' },
  { primary: '#ec4899', secondary: '#1f1f2e' },
  { primary: '#6366f1', secondary: '#0f0f1a' },
  { primary: '#84cc16', secondary: '#141f0f' },
  { primary: '#06b6d4', secondary: '#0a1a1f' },
  { primary: '#f43f5e', secondary: '#1a0f12' },
  { primary: '#8b5cf6', secondary: '#150f1f' },
  { primary: '#10b981', secondary: '#0f1f17' },
  { primary: '#fbbf24', secondary: '#1f1a0f' },
  { primary: '#3b82f6', secondary: '#0f1428' },
  { primary: '#a855f7', secondary: '#1a0f20' }
];

const state = {
  offset: 0,           // Horizontal offset in pixels
  velocity: 0,         // Horizontal velocity
  isDragging: false,
  hoveredId: null,
  centerId: null,
  expandedId: null,    // Currently expanded card (null = none)
  expandProgress: 0,   // 0 = collapsed, 1 = fully expanded
  expandTarget: 0,     // Target for expandProgress
  dragBendTarget: 0,
  bend: 0,
  cardPop: new Map()   // Track smooth pop value per card
};

const config = {
  cardSpacing: 500,      // Horizontal spacing between cards (increased for larger cards)
  popZ: 100,
  cardWidth: 480,        // 1.5x larger (was 240)
  cardHeight: 640,       // 1.5x larger (was 320)
  dragSensitivity: 1.2,
  wheelSensitivity: 0.3,
  velocitySensitivity: 0.6,
  bendScale: 3.0,        // Stronger curl from inertia
  bendClamp: 1.2,        // Higher curl limit
  dragBendScale: 0.35    // More responsive curl during drag
};

// Scroll limits: first card centered = max offset, last card centered = min offset
function getScrollLimits() {
  const cardCount = CARD_DATA.length;
  const midIndex = (cardCount - 1) / 2;
  const maxOffset = midIndex * config.cardSpacing;      // First card centered
  const minOffset = -midIndex * config.cardSpacing;     // Last card centered
  return { minOffset, maxOffset };
}

function clampOffset(offset) {
  const { minOffset, maxOffset } = getScrollLimits();
  return clamp(offset, minOffset, maxOffset);
}

const rendererConfig = {
  cameraZ: 1200
};

const canvas = document.getElementById('scene-canvas');
const track = document.getElementById('carousel-track');
const statusEl = document.getElementById('status');
const centerTitleEl = document.getElementById('center-title');
const carouselView = document.getElementById('carousel');
const mirrorRoot = document.getElementById('mirror-root');
const transitionFallback = document.getElementById('transition-fallback');

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Image cache for Unsplash photos
const imageCache = new Map();

const cardMap = new Map(CARD_DATA.map((card) => [card.id, card]));
const cardElements = createCards(track, CARD_DATA);
let cardTextures = createCardTextures();

const registry = new SurfaceRegistry();
const layoutTracker = new LayoutTracker(registry);
const surfaceMap = new Map();

cardElements.forEach((cardEl) => {
  const surfaceId = cardEl.dataset.surfaceId;
  const surface = new Surface(surfaceId, cardEl);
  registry.add(surface);
  surfaceMap.set(surfaceId, surface);
});

layoutTracker.start();

const engine = new Engine({
  canvas,
  mode: InteractionMode.CANVAS_INTERACTIVE,
  trackFPS: true
});

const input = new InputManager(engine, {
  target: canvas,
  registry: {
    all: () => registry.regular()
  },
  inertiaOptions: {
    friction: prefersReducedMotion ? 0.75 : 0.92,
    minVelocity: prefersReducedMotion ? 0.2 : 0.08
  }
});
input.initialize(canvas);

const a11y = new A11yManager(engine, {
  registry,
  container: mirrorRoot,
  navigationAxis: 'horizontal',
  wrapNavigation: true,
  skipGhosts: true
});

CARD_DATA.forEach((card) => {
  a11y.configure(card.id, {
    label: card.title,
    description: card.subtitle
  });
});

const transitionCoordinator = new TransitionCoordinator(engine, {
  surfaceRegistry: registry,
  defaultTimeoutMs: 5000
});

const gpu = {
  context: new WebGPUContext(),
  shaderLibrary: null,
  transition: null,
  carousel: null,
  textures: {
    carousel: null,
    detail: null
  },
  ready: false
};

initializeGPU();
resizeCanvas();
applyCarouselTransforms();
setStatus('Canvas mode ready. Drag to rotate.');

input.onIntent('dragStart', () => {
  state.isDragging = true;
  state.velocity = 0;
  state.dragBendTarget = 0;
});

input.onIntent('drag', ({ deltaX }) => {
  state.offset = clampOffset(state.offset + deltaX * config.dragSensitivity);
  state.velocity = 0;
  // Smooth target for drag bend - will be lerped in render loop
  state.dragBendTarget = clamp(deltaX * config.dragBendScale, -config.bendClamp, config.bendClamp);
  applyCarouselTransforms();
});

input.onIntent('dragEnd', () => {
  state.isDragging = false;
  // Let bend decay naturally via lerp, don't snap to 0
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

input.onIntent('tap', ({ surfaceId }) => {
  if (!surfaceId) return;
  activateCard(surfaceId);
});

input.onIntent('inertia', (inertiaState) => {
  if (state.isDragging) return;
  state.velocity = inertiaState.isActive
    ? inertiaState.velocityX * config.velocitySensitivity
    : 0;
});

engine.events.on('render', ({ deltaTime }) => {
  // Compute target bend from drag or inertia (only when not expanded)
  const targetBend = state.expandedId 
    ? 0 
    : state.isDragging
      ? state.dragBendTarget
      : clamp(state.velocity * config.bendScale * 0.01, -config.bendClamp, config.bendClamp);
  
  // Smooth easing: fast approach with very gradual tail
  const distance = Math.abs(state.bend - targetBend);
  const maxDistance = config.bendClamp;
  const t = Math.min(distance / maxDistance, 1);
  
  // Very gradual ease-out curve
  const easedT = Math.pow(t, 0.25);
  const baseFactor = prefersReducedMotion ? 0.12 : 0.10;
  const tailFactor = 0.008; // Very slow tail for gradual finish
  const lerpFactor = tailFactor + (baseFactor - tailFactor) * easedT;
  
  state.bend = lerp(state.bend, targetBend, lerpFactor);
  
  // Very low threshold for smooth finish
  if (Math.abs(state.bend) < 0.0003) state.bend = 0;

  // Animate expand progress
  const expandLerp = prefersReducedMotion ? 0.15 : 0.1;
  state.expandProgress = lerp(state.expandProgress, state.expandTarget, expandLerp);
  if (Math.abs(state.expandProgress - state.expandTarget) < 0.001) {
    state.expandProgress = state.expandTarget;
  }

  // Update offset from inertia (linear movement) - only when not expanded
  if (!state.isDragging && !state.expandedId && Math.abs(state.velocity) > 0.1) {
    const newOffset = clampOffset(state.offset + state.velocity * deltaTime);
    // Stop velocity if we hit the limit
    if (newOffset === state.offset) {
      state.velocity = 0;
    }
    state.offset = newOffset;
  }
  
  // Always update transforms for smooth animations
  applyCarouselTransforms();

  if (gpu.ready && gpu.carousel) {
    gpu.carousel.render([0, 0, 0, 0]);
  }
});

engine.events.on('a11y:select', ({ surfaceId }) => {
  if (!surfaceId) return;
  snapToCard(surfaceId);
});

engine.events.on('a11y:activate', ({ surfaceId }) => {
  if (!surfaceId) return;
  activateCard(surfaceId);
});

canvas.addEventListener(
  'wheel',
  (event) => {
    // Collapse any expanded card on scroll
    if (state.expandedId) {
      state.expandedId = null;
      state.expandTarget = 0;
      return;
    }
    event.preventDefault();
    state.offset = clampOffset(state.offset - event.deltaY * config.wheelSensitivity);
    state.velocity = 0;
    applyCarouselTransforms();
  },
  { passive: false }
);

// Collapse on Escape key
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.expandedId) {
    state.expandedId = null;
    state.expandTarget = 0;
  }
});

window.addEventListener('resize', () => {
  resizeCanvas();
  layoutTracker.forceUpdate();
});

function createCards(container, cards) {
  container.innerHTML = '';
  return cards.map((card, index) => {
    const cardEl = document.createElement('article');
    cardEl.className = 'carousel-card';
    cardEl.dataset.surfaceId = card.id;
    cardEl.setAttribute('aria-hidden', 'true');
    cardEl.setAttribute('role', 'presentation');
    cardEl.innerHTML = `
      <div class="card-image" style="background-image: url('${card.image}')"></div>
      <div class="card-content">
        <h3>${card.title}</h3>
        <p class="subtitle">${card.subtitle}</p>
        <p class="body">${card.body}</p>
      </div>
    `;
    container.appendChild(cardEl);
    return cardEl;
  });
}

async function loadImage(url) {
  if (imageCache.has(url)) return imageCache.get(url);
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

async function preloadImages() {
  const promises = CARD_DATA.map(card => loadImage(card.image).catch(() => null));
  await Promise.all(promises);
}

function createCardTextures() {
  const dpr = window.devicePixelRatio || 1;

  return CARD_DATA.map((card, index) => {
    const canvasEl = document.createElement('canvas');
    canvasEl.width = Math.floor(config.cardWidth * dpr);
    canvasEl.height = Math.floor(config.cardHeight * dpr);
    const ctx = canvasEl.getContext('2d');

    ctx.scale(dpr, dpr);
    ctx.textBaseline = 'top';

    // Draw image if loaded, otherwise fallback to gradient
    const img = imageCache.get(card.image);
    if (img) {
      // Cover-fit the image
      const imgRatio = img.width / img.height;
      const cardRatio = config.cardWidth / config.cardHeight;
      let drawWidth, drawHeight, drawX, drawY;
      
      if (imgRatio > cardRatio) {
        drawHeight = config.cardHeight;
        drawWidth = drawHeight * imgRatio;
        drawX = -(drawWidth - config.cardWidth) / 2;
        drawY = 0;
      } else {
        drawWidth = config.cardWidth;
        drawHeight = drawWidth / imgRatio;
        drawX = 0;
        drawY = -(drawHeight - config.cardHeight) / 2;
      }
      
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      
      // Dark overlay gradient for text readability
      const overlay = ctx.createLinearGradient(0, config.cardHeight * 0.4, 0, config.cardHeight);
      overlay.addColorStop(0, 'rgba(0, 0, 0, 0)');
      overlay.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, config.cardWidth, config.cardHeight);
    } else {
      // Fallback gradient
      const theme = CARD_THEMES[index % CARD_THEMES.length];
      const gradient = ctx.createLinearGradient(0, 0, config.cardWidth, config.cardHeight);
      gradient.addColorStop(0, theme.primary);
      gradient.addColorStop(1, theme.secondary);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, config.cardWidth, config.cardHeight);
    }

    // Title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = '600 20px Inter, system-ui, sans-serif';
    ctx.fillText(card.title, 16, config.cardHeight - 60);

    // Subtitle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.fillText(card.subtitle, 16, config.cardHeight - 36);

    return {
      id: card.id,
      width: canvasEl.width,
      height: canvasEl.height,
      source: canvasEl
    };
  });
}

function applyCarouselTransforms() {
  if (!gpu.ready || !gpu.carousel) {
    applyDomTransforms();
    return;
  }

  const cardCount = cardElements.length;
  const midIndex = (cardCount - 1) / 2;
  
  // Always use smoothed bend for fluid animation
  const bendBase = state.bend;

  // Linear layout: cards are spaced horizontally, offset moves them
  const frame = cardElements.map((cardEl, index) => {
    const baseX = (index - midIndex) * config.cardSpacing;
    const x = baseX + state.offset;
    const distance = Math.abs(x); // Distance from center in pixels
    return { cardEl, x, distance };
  });

  const closest = frame.reduce(
    (best, entry) => (entry.distance < best.distance ? entry : best),
    frame[0]
  );

  const expandProgress = state.expandProgress;
  const expandedId = state.expandedId;
  
  const cardStates = frame.map(({ cardEl, x, distance }) => {
    const cardId = cardEl.dataset.surfaceId;
    const isCenter = cardEl === closest.cardEl;
    const isExpanded = cardId === expandedId;
    
    // Smooth pop: lerp toward target (120 if center, 0 otherwise)
    const targetPop = isCenter && !expandedId ? config.popZ : 0;
    const currentPop = state.cardPop.get(cardId) ?? 0;
    const smoothPop = lerp(currentPop, targetPop, 0.12);
    state.cardPop.set(cardId, smoothPop);
    
    // Expand transforms
    let finalX = x;
    let finalZ = smoothPop;
    let scale = 1;
    let opacity = 1;
    
    if (expandProgress > 0) {
      if (isExpanded) {
        // Expanded card: scale up, move forward, center horizontally
        scale = 1 + expandProgress * 0.8; // Scale to 1.8x
        finalZ = smoothPop + expandProgress * 400; // Move forward
        finalX = lerp(x, 0, expandProgress); // Center horizontally
      } else {
        // Other cards: fade out and push back
        opacity = 1 - expandProgress * 0.85;
        finalZ = smoothPop - expandProgress * 100; // Push back
      }
    }
    
    // Cascade effect: cards on the leading side (opposite to scroll) get more curl/tilt
    // When scrolling right (positive bend), left cards curl more
    // When scrolling left (negative bend), right cards curl more
    const cardPosition = x / config.cardSpacing; // Normalized position: negative = left, positive = right
    const bendSign = Math.sign(bendBase) || 1;
    const cascadeWeight = Math.max(0, -cardPosition * bendSign + 0.5); // 0 at trailing edge, increases toward leading edge
    const cascadeMultiplier = 0.3 + cascadeWeight * 0.7; // Range: 0.3x to 1x based on position (more subtle)
    
    const bend = bendBase * cascadeMultiplier * 0.4 * (1 - expandProgress); // Reduced curl intensity

    // Y-rotation cascades similarly - leading cards tilt more
    const rotationY = -bendBase * 0.12 * cascadeMultiplier * (1 - expandProgress); // Reduced tilt

    // X shift also cascades - leading cards shift more
    const speedShift = bendBase * 150 * cascadeMultiplier * (1 - expandProgress);
    finalX += speedShift;

    updateGhostDom(cardEl, finalX, finalZ, rotationY);
    cardEl.classList.toggle('is-center', isCenter);
    cardEl.classList.toggle('is-expanded', isExpanded && expandProgress > 0.5);

    const surface = surfaceMap.get(cardId);
    if (surface) {
      surface.zIndex = Math.round(finalZ);
    }

    return {
      id: cardId,
      x: finalX,
      y: 0,
      z: finalZ,
      rotationY,
      width: config.cardWidth * scale,
      height: config.cardHeight * scale,
      bend,
      opacity
    };
  });

  if (closest?.cardEl?.dataset?.surfaceId) {
    const closestId = closest.cardEl.dataset.surfaceId;
    if (closestId !== state.centerId) {
      state.centerId = closestId;
      const card = cardMap.get(closestId);
      centerTitleEl.textContent = card ? card.title : '--';
    }
  }

  const sorted = [...cardStates].sort((a, b) => a.z - b.z);
  gpu.carousel.updateCards(sorted);
  layoutTracker.forceUpdate();
}

function applyDomTransforms() {
  const cardCount = cardElements.length;
  const midIndex = (cardCount - 1) / 2;
  
  // Linear layout for DOM fallback
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
    cardEl.classList.toggle('is-center', isCenter);

    const surface = surfaceMap.get(cardEl.dataset.surfaceId);
    if (surface) {
      surface.zIndex = Math.round(popZ);
    }
  });

  if (closest?.cardEl?.dataset?.surfaceId) {
    const closestId = closest.cardEl.dataset.surfaceId;
    if (closestId !== state.centerId) {
      state.centerId = closestId;
      const card = cardMap.get(closestId);
      centerTitleEl.textContent = card ? card.title : '--';
    }
  }

  layoutTracker.forceUpdate();
}

function setHoverState(surfaceId, isHovered) {
  const cardEl = cardElements.find(
    (el) => el.dataset.surfaceId === surfaceId
  );
  if (!cardEl) return;
  cardEl.classList.toggle('is-hovered', isHovered);
}

function snapToCard(surfaceId) {
  const cardIndex = cardElements.findIndex(
    (el) => el.dataset.surfaceId === surfaceId
  );
  if (cardIndex === -1) return;
  const midIndex = (cardElements.length - 1) / 2;
  // Offset needed to center this card (negate its base position)
  const targetOffset = -(cardIndex - midIndex) * config.cardSpacing;
  state.offset = targetOffset;
  state.velocity = 0;
  applyCarouselTransforms();
}

function activateCard(surfaceId) {
  // If already expanded, collapse
  if (state.expandedId === surfaceId) {
    state.expandedId = null;
    state.expandTarget = 0;
    return;
  }
  
  // Snap to the card first, then expand
  snapToCard(surfaceId);
  state.expandedId = surfaceId;
  state.expandTarget = 1;
}


async function initializeGPU() {
  setStatus('Loading images...');
  await preloadImages();
  
  const initialized = await gpu.context.initialize({
    canvas,
    powerPreference: 'high-performance',
    alphaMode: 'premultiplied'
  });

  if (!initialized) {
    setStatus('WebGPU unavailable. Running in DOM-only mode.');
    gpu.ready = false;
    document.body.classList.add('dom-fallback');
    engine.mode = InteractionMode.DOM_INTERACTIVE;
    return;
  }

  gpu.shaderLibrary = new ShaderLibrary();
  gpu.shaderLibrary.setDevice(gpu.context.device);
  gpu.shaderLibrary.registerDefaults();
  registerTransitionShaders(gpu.shaderLibrary);

  gpu.carousel = new CarouselRenderer(gpu.context, gpu.shaderLibrary, {
    cameraZ: rendererConfig.cameraZ
  });
  gpu.carousel.initialize();
  
  // Recreate textures now that images are loaded
  cardTextures = createCardTextures();
  gpu.carousel.setCards(cardTextures);
  gpu.ready = true;
  gpu.carousel.setViewport(canvas.width, canvas.height);
  clearGPUCanvas();
  document.body.classList.add('gpu-mode');
  document.body.classList.remove('dom-fallback');
  setStatus('Ready. Click a card to expand.');
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  if (gpu.ready) {
    gpu.context.resize(rect.width, rect.height, window.devicePixelRatio);
    rebuildTransitionTextures();
    if (gpu.carousel) {
      cardTextures = createCardTextures();
      gpu.carousel.setCards(cardTextures);
      gpu.carousel.setViewport(canvas.width, canvas.height);
    }
  } else {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
  }
}

function rebuildTransitionTextures() {
  if (!gpu.ready || !gpu.context.device) return;
  const size = getCanvasPixelSize();
  if (size.width === 0 || size.height === 0) return;

  destroyTexture(gpu.textures.carousel);
  destroyTexture(gpu.textures.detail);

  gpu.textures.carousel = createLabelTexture(
    'CAROUSEL',
    '#1d4ed8',
    '#0c0f17'
  );
  gpu.textures.detail = createLabelTexture(
    'DETAIL',
    '#22d3ee',
    '#0c0f17'
  );
}

function createLabelTexture(label, colorA, colorB) {
  const { width, height, dpr } = getCanvasPixelSize();
  const texture = gpu.context.device.createTexture({
    size: [width, height],
    format: gpu.context.format,
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT
  });

  const canvasEl = document.createElement('canvas');
  canvasEl.width = width;
  canvasEl.height = height;
  const ctx = canvasEl.getContext('2d');

  ctx.scale(dpr, dpr);
  const gradient = ctx.createLinearGradient(0, 0, width / dpr, height / dpr);
  gradient.addColorStop(0, colorA);
  gradient.addColorStop(1, colorB);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width / dpr, height / dpr);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '700 64px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, (width / dpr) * 0.5, (height / dpr) * 0.5);

  gpu.context.device.queue.copyExternalImageToTexture(
    { source: canvasEl },
    { texture },
    [width, height]
  );

  return texture;
}

function getCanvasPixelSize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return {
    width: Math.max(1, Math.floor(rect.width * dpr)),
    height: Math.max(1, Math.floor(rect.height * dpr)),
    dpr
  };
}

function destroyTexture(texture) {
  if (texture && texture.destroy) {
    texture.destroy();
  }
}

function clearGPUCanvas() {
  if (!gpu.ready || !gpu.context.device || !gpu.context.context) return;
  const encoder = gpu.context.device.createCommandEncoder();
  encoder.beginRenderPass({
    colorAttachments: [
      {
        view: gpu.context.context.getCurrentTexture().createView(),
        clearValue: [0, 0, 0, 0],
        loadOp: 'clear',
        storeOp: 'store'
      }
    ]
  }).end();
  gpu.context.device.queue.submit([encoder.finish()]);
}

function playTransition(fromView, toView, duration) {
  if (!gpu.ready || !gpu.transition) {
    return playFallbackTransition(duration);
  }

  const fromTexture =
    fromView === 'carousel' ? gpu.textures.carousel : gpu.textures.detail;
  const toTexture =
    toView === 'carousel' ? gpu.textures.carousel : gpu.textures.detail;

  if (!fromTexture || !toTexture) {
    return playFallbackTransition(duration);
  }

  state.renderPaused = true;
  canvas.style.opacity = '1';

  return new Promise((resolve) => {
    const start = performance.now();
    const animate = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(1, elapsed / duration);
      gpu.transition.setProgress(progress);

      const encoder = gpu.context.device.createCommandEncoder();
      gpu.transition.execute(encoder, fromTexture, toTexture);
      gpu.context.device.queue.submit([encoder.finish()]);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        clearGPUCanvas();
        canvas.style.opacity = '';
        resolve();
      }
    };
    requestAnimationFrame(animate);
  });
}

function playFallbackTransition(duration) {
  state.renderPaused = true;
  transitionFallback.style.transitionDuration = `${duration}ms`;
  transitionFallback.classList.add('is-active');
  return new Promise((resolve) => {
    setTimeout(() => {
      transitionFallback.classList.remove('is-active');
      resolve();
    }, duration);
  });
}

function updateGhostDom(cardEl, x, z, rotationY = 0) {
  const cameraZ = rendererConfig.cameraZ;
  const perspective = cameraZ / (cameraZ - z);
  const projectedX = x * perspective;
  const scale = perspective;
  // Don't apply rotateY to ghost DOM - it distorts the bounding rect for hit testing
  // GPU handles rotation visually, ghost just needs correct X position and scale
  cardEl.style.transform = `translate(-50%, -50%) translate(${projectedX}px, 0px) scale(${scale})`;
  cardEl.style.zIndex = String(Math.round(z));
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let lineY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) {
    ctx.fillText(line, x, lineY);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function normalizeAngle(angle) {
  let normalized = angle % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized < -180) normalized += 360;
  return normalized;
}

function setStatus(message) {
  statusEl.textContent = message;
}
