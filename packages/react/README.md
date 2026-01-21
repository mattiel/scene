# @scene/react

React bindings for the Scene engine. Provides hooks and components for declarative Scene integration in React applications.

## Installation

```bash
npm install @scene/react @scene/core @scene/surfaces @scene/motion @scene/controllers @scene/renderer
```

## Quick Start

```tsx
import {
  SceneProvider,
  useScene,
  useSurface,
  useCarousel,
  useMotion,
} from '@scene/react';

function App() {
  return (
    <SceneProvider mode="canvas-interactive">
      <Canvas />
      <CarouselDemo />
    </SceneProvider>
  );
}

function CarouselDemo() {
  const { isReady, fps } = useScene();
  const carousel = useCarousel({
    items: CARDS,
    itemSpacing: 320,
    onCenterChange: ({ item }) => console.log('Center:', item.id),
  });

  return (
    <div>
      <p>FPS: {fps}</p>
      {carousel.itemStates.map(state => (
        <Card key={state.item.id} item={state.item} x={state.x} />
      ))}
    </div>
  );
}
```

## API Reference

### SceneProvider

The root provider that creates and manages the Scene engine, surface registry, and layout tracking.

```tsx
<SceneProvider
  mode="dom-interactive" // or "canvas-interactive"
  trackFPS={true}
  autoStart={true}
  onReady={() => console.log('Engine ready')}
  onModeChange={(mode) => console.log('Mode:', mode)}
>
  {children}
</SceneProvider>
```

### useScene

Access the Scene engine and common operations.

```tsx
const {
  engine,      // Engine instance
  isReady,     // Whether GPU is initialized
  isGPUEnabled,// Whether WebGPU is available
  mode,        // Current interaction mode
  setMode,     // Change interaction mode
  fps,         // Current FPS
  isRunning,   // Whether render loop is running
  start,       // Start render loop
  stop,        // Stop render loop
  pause,       // Pause render loop
  resume,      // Resume render loop
} = useScene();
```

### useSurface

Register a DOM element as a Scene surface.

```tsx
function Card({ id, title }) {
  const { ref, surface, rect, isVisible } = useSurface(id, {
    label: title,
    onLayoutChange: (rect) => console.log('Layout:', rect),
    onVisibilityChange: (visible) => console.log('Visible:', visible),
  });

  return <div ref={ref}>{title}</div>;
}
```

### useMotion

Create animated values with spring physics.

```tsx
const { value, animateTo, isAnimating } = useMotion(0);

// Animate with spring
animateTo(100, springs.snappy);

// Use value in JSX
<div style={{ transform: `translateX(${value}px)` }} />
```

### useMotion2D

Create 2D animated values.

```tsx
const { x, y, animateTo, set } = useMotion2D(0, 0);

animateTo(100, 200, springs.bouncy);
```

### useCarousel

Full carousel controller with state and handlers.

```tsx
const {
  // State
  offset,
  velocity,
  isDragging,
  centerIndex,
  centerItem,
  expandedIndex,
  itemStates,

  // Navigation
  next,
  previous,
  scrollToIndex,
  scrollToItem,
  expandItem,
  collapseItem,

  // Input handlers
  handleDragStart,
  handleDrag,
  handleDragEnd,
  handleWheel,
  handleItemTap,

  // Instance
  carousel,
} = useCarousel({
  items: CARDS,
  itemSpacing: 320,
  centerSnap: true,
  onCenterChange: ({ item, index }) => {},
  onOffsetChange: ({ offset, velocity }) => {},
  onItemTap: ({ item, x, y }) => {},
});
```

### useCarouselPointerEvents

Convenient handler binding for pointer events.

```tsx
const carousel = useCarousel({ items });
const handlers = useCarouselPointerEvents(carousel);

<div {...handlers}>
  {/* carousel items */}
</div>
```

### useMaterial

Create and manage shader materials.

```tsx
const { material, isInitialized, setUniform, setTexture } = useMaterial({
  name: 'CardMaterial',
  vertexShader: VERTEX_SHADER,
  fragmentShader: FRAGMENT_SHADER,
  uniforms: {
    uOpacity: { type: 'f32', default: 1.0 },
    uBend: { type: 'f32', default: 0.0 },
  },
});

// Update uniforms
setUniform('uBend', bendAmount);
```

### useSceneEvent

Subscribe to engine events.

```tsx
useSceneEvent('render', ({ deltaTime }) => {
  // Called every frame
});

useSceneEvent('resize', ({ width, height }) => {
  // Called on canvas resize
});
```

## Hooks Summary

| Hook | Purpose |
|------|---------|
| `useSceneContext` | Access raw context (engine, registry, etc.) |
| `useScene` | Engine state and controls |
| `useSceneEvent` | Subscribe to engine events |
| `useSurface` | Register element as surface |
| `useSurfaceById` | Get existing surface by ID |
| `useSurfaces` | Get all surfaces |
| `useMotion` | Single animated value |
| `useMotion2D` | 2D animated values |
| `useMotionBinding` | Bind SceneValue to material uniform |
| `useCarousel` | Full carousel controller |
| `useCarouselPointerEvents` | Pointer event handlers for carousel |
| `useMaterial` | Create/manage shader material |
| `useMaterialUniform` | Update single uniform |
| `useMaterialUniforms` | Update multiple uniforms |
| `useDeformableMaterial` | Material with animated deformations |

## Example: Complete Carousel

```tsx
import {
  SceneProvider,
  useScene,
  useSurface,
  useCarousel,
  useCarouselPointerEvents,
  useMotion,
  springs,
} from '@scene/react';

const CARDS = [
  { id: 'card-1', label: 'First Card' },
  { id: 'card-2', label: 'Second Card' },
  { id: 'card-3', label: 'Third Card' },
];

function CarouselDemo() {
  return (
    <SceneProvider mode="canvas-interactive">
      <Canvas />
      <Carousel />
    </SceneProvider>
  );
}

function Carousel() {
  const carousel = useCarousel({
    items: CARDS,
    itemSpacing: 320,
    centerSnap: true,
  });
  const handlers = useCarouselPointerEvents(carousel);

  return (
    <div className="carousel" {...handlers}>
      {carousel.itemStates.map(state => (
        <Card
          key={state.item.id}
          item={state.item}
          state={state}
        />
      ))}
    </div>
  );
}

function Card({ item, state }) {
  const { ref } = useSurface(item.id, { label: item.label });
  const { value: scale, animateTo } = useMotion(1);

  return (
    <article
      ref={ref}
      style={{
        transform: `translateX(${state.x}px) scale(${scale})`,
        opacity: state.isCenter ? 1 : 0.7,
      }}
      onMouseEnter={() => animateTo(1.05, springs.snappy)}
      onMouseLeave={() => animateTo(1, springs.snappy)}
    >
      {item.label}
    </article>
  );
}
```

## Peer Dependencies

- `react` >= 18.0.0
- `@scene/core`
- `@scene/surfaces`
- `@scene/motion`
- `@scene/controllers`
- `@scene/renderer`
