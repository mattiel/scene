# Scene Engine

A DOM-first cinematic effects engine for the web, powered by WebGPU.

Scene augments real HTML with GPU-powered visual effects while keeping DOM as the source of truth. It provides **primitives** for building custom interactions—not pre-built components.

## Features

- **DOM-first** - Content lives in the DOM. Accessibility and SEO work without Scene.
- **GPU visual layer** - WebGPU for distortion, blur, transitions, post-processing
- **Composable primitives** - Build carousels, sliders, galleries from `Scrollable`, `Draggable`, `SceneValue`
- **Motion integration** - Spring physics, derived values, velocity tracking
- **Graceful degradation** - Falls back to DOM-only when WebGPU unavailable

## Quick Start

```bash
npm install @scene/react @scene/core @scene/motion @scene/controllers
```

```tsx
import { SceneProvider, useScrollable, useMotion } from '@scene/react';
import { springs } from '@scene/motion';

function App() {
  return (
    <SceneProvider mode="dom-interactive">
      <Slider />
    </SceneProvider>
  );
}

function Slider() {
  const { offset, handleDragStart, handleDrag, handleDragEnd } = useScrollable({
    bounds: { min: 0, max: 500 },
    snap: { points: [0, 100, 200, 300, 400, 500] },
  });
  
  const { value: scale, animateTo } = useMotion(1);
  
  return (
    <div
      onPointerDown={handleDragStart}
      onPointerMove={(e) => handleDrag(e.movementX)}
      onPointerUp={handleDragEnd}
      onMouseEnter={() => animateTo(1.05, springs.snappy)}
      onMouseLeave={() => animateTo(1, springs.snappy)}
      style={{ transform: `translateX(${offset}px) scale(${scale})` }}
    >
      Drag me
    </div>
  );
}
```

---

## TanStack Router Integration

Scene works seamlessly with TanStack Router. The project demos use this setup.

### Basic Setup

Wrap your app with `SceneProvider` at the root:

```tsx
// src/routes/__root.tsx
import { Outlet, createRootRoute } from '@tanstack/react-router';
import { SceneProvider } from '@scene/react';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <SceneProvider mode="dom-interactive">
      <Outlet />
    </SceneProvider>
  );
}
```

### Page Transitions

Use `useTransition` with TanStack's navigation:

```tsx
// src/routes/index.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTransition } from '@scene/react';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { startExit, startEnter, progress, state } = useTransition({
    type: 'dissolve',
    duration: 400,
  });

  const handleNavigate = async (to: string) => {
    await startExit();           // Run exit animation
    await navigate({ to });      // TanStack navigation
    startEnter();                // Run enter animation
  };

  return (
    <div style={{ opacity: state === 'exiting' ? 1 - progress : 1 }}>
      <button onClick={() => handleNavigate('/about')}>
        Go to About
      </button>
    </div>
  );
}
```

### With View Transitions API

Combine Scene transitions with TanStack's View Transitions support:

```tsx
// src/router.tsx
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export const router = createRouter({
  routeTree,
  defaultViewTransition: true, // Enable native View Transitions
});
```

```tsx
// In your component - coordinate both systems
const { startExit, startEnter } = useTransition({ type: 'dissolve' });

const handleNavigate = async (to: string) => {
  await startExit();
  await navigate({ to, viewTransition: true });
  startEnter();
};
```

### Canvas-Interactive Mode

For 3D carousels or GPU-driven interactions, use canvas-interactive mode:

```tsx
<SceneProvider mode="canvas-interactive">
  <canvas style={{ pointerEvents: 'auto' }} />
  {/* Scene handles input on canvas */}
</SceneProvider>
```

---

## Packages

| Package | Description |
|---------|-------------|
| [@scene/core](./packages/core) | Engine, EventBus, RAFScheduler |
| [@scene/renderer](./packages/renderer) | WebGPU context, Geometry, Materials, Mesh, Deformations |
| [@scene/surfaces](./packages/surfaces) | DOM element tracking, GhostSurface, layout sync |
| [@scene/screen](./packages/screen) | Post-processing effects, transitions |
| [@scene/input](./packages/input) | Pointer handling, gestures, multi-touch, picking |
| [@scene/motion](./packages/motion) | SceneValue, spring presets, derived values |
| [@scene/controllers](./packages/controllers) | Scrollable, Draggable primitives |
| [@scene/navigation](./packages/navigation) | TransitionCoordinator |
| [@scene/a11y](./packages/a11y) | DOMMirror, FocusSync, LiveAnnouncer |
| [@scene/react](./packages/react) | React hooks and SceneProvider |

---

## Common Patterns

### Scroll-Linked Effects

```tsx
import { SceneValue, springs } from '@scene/motion';

const scrollY = new SceneValue(0);

// Derive multiple effects from scroll position
const parallax = scrollY.derive(v => v * 0.5);
const fade = scrollY.interpolate({
  inputRange: [0, 300],
  outputRange: [1, 0],
  clamp: true,
});

// Bind to GPU uniforms
parallax.bindTo(material, 'uParallax');
fade.bindTo(material, 'uFade');

// Update on scroll
window.addEventListener('scroll', () => scrollY.set(window.scrollY));
```

### Building a Carousel

Carousels are composed from primitives—not provided as a component:

```tsx
import { useScrollable, useSurface } from '@scene/react';

function Carousel({ items }) {
  const { offset, handleDrag, handleDragEnd, snapTo } = useScrollable({
    bounds: { min: -items.length * 320, max: 0 },
    snap: { 
      points: items.map((_, i) => -i * 320),
      spring: springs.snappy,
    },
  });

  return (
    <div onPointerMove={e => handleDrag(e.movementX)} onPointerUp={handleDragEnd}>
      {items.map((item, i) => (
        <Card key={item.id} x={offset + i * 320} />
      ))}
    </div>
  );
}
```

### Gesture-Driven Effects

```tsx
import { useDraggable } from '@scene/react';

function DraggableCard() {
  const { position, velocity, handleDrag, handleDragEnd } = useDraggable({
    bounds: { minX: 0, maxX: 500, minY: 0, maxY: 300 },
    inertia: { friction: 0.92 },
  });

  // Use velocity for tilt effect
  const tilt = Math.max(-15, Math.min(15, velocity.x * 0.1));

  return (
    <div
      onPointerMove={e => handleDrag(e.movementX, e.movementY)}
      onPointerUp={handleDragEnd}
      style={{
        transform: `translate(${position.x}px, ${position.y}px) rotateY(${tilt}deg)`,
      }}
    />
  );
}
```

### Surface Effects

```tsx
import { useSurface, useSurfaceEffect } from '@scene/react';

function Card({ id }) {
  const { ref } = useSurface(id);
  const { enable, disable } = useSurfaceEffect(id, 'blur', { strength: 5 });

  return (
    <div
      ref={ref}
      onMouseEnter={enable}
      onMouseLeave={disable}
    >
      Hover for blur
    </div>
  );
}
```

### Reduced Motion Support

```tsx
import { prefersReducedMotion, onReducedMotionChange } from '@scene/controllers';
import { springs } from '@scene/motion';

// Check at runtime
if (prefersReducedMotion()) {
  // Use instant transitions
}

// React to changes
onReducedMotionChange((prefers) => {
  // Update animation settings
});

// Scrollable respects it automatically
const scroll = useScrollable({
  reducedMotion: true, // Disables inertia, uses instant snaps
});
```

---

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Development mode (watch)
pnpm dev

# Type checking
pnpm typecheck

# Run demo site
cd website && pnpm dev
```

### Monorepo Structure

```
scene/
├─ packages/
│  ├─ core/          # Engine, EventBus, RAFScheduler
│  ├─ renderer/      # WebGPU, Geometry, Materials
│  ├─ surfaces/      # DOM tracking, GhostSurface
│  ├─ screen/        # Post-processing, transitions
│  ├─ input/         # Pointer, gestures, picking
│  ├─ motion/        # SceneValue, springs
│  ├─ controllers/   # Scrollable, Draggable
│  ├─ navigation/    # TransitionCoordinator
│  ├─ a11y/          # Accessibility layer
│  └─ react/         # React bindings
├─ website/          # Demo site (TanStack Router)
└─ demos/            # Standalone demos
```

---

## Browser Compatibility

Scene uses WebGPU for GPU-accelerated rendering. When WebGPU is not available, Scene gracefully degrades to DOM-only mode.

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 113+ | Full support |
| Edge | 113+ | Full support |
| Firefox | 121+ | Full support |
| Safari (macOS) | 17+ | Full support |
| Safari (iOS) | 17.4+ | Full support |
| Safari (iOS) | 17.0-17.3 | Requires Settings enable |
| Older browsers | - | DOM-only fallback |

### Graceful Degradation

```tsx
import { useScene } from '@scene/react';

function App() {
  const { isGPUEnabled } = useScene();
  
  return (
    <div>
      {!isGPUEnabled && <p>Running without GPU effects</p>}
      <Content />
    </div>
  );
}
```

---

## Requirements

- Node.js >= 18.0.0
- pnpm >= 8.0.0 (for development)
- React >= 18.0.0 (for @scene/react)

## License

MIT © Mattie Lee
