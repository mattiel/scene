# @scene/react

React bindings for the Scene engine. Provides hooks for declarative Scene integration.

## Installation

```bash
npm install @scene/react @scene/core @scene/surfaces @scene/motion @scene/controllers
```

## Quick Start

```tsx
import { SceneProvider, useScene, useScrollable, useMotion, springs } from '@scene/react';

function App() {
  return (
    <SceneProvider mode="dom-interactive">
      <SliderDemo />
    </SceneProvider>
  );
}

function SliderDemo() {
  const { isGPUEnabled } = useScene();
  const { offset, handleDragStart, handleDrag, handleDragEnd } = useScrollable({
    bounds: { min: 0, max: 400 },
    snap: { points: [0, 100, 200, 300, 400] },
  });

  return (
    <div
      onPointerDown={handleDragStart}
      onPointerMove={(e) => handleDrag(e.movementX)}
      onPointerUp={handleDragEnd}
      style={{ transform: `translateX(${offset}px)` }}
    >
      {isGPUEnabled ? 'GPU Active' : 'DOM Only'}
    </div>
  );
}
```

---

## Core Hooks

### SceneProvider

Root provider that creates the Scene engine, surface registry, and layout tracking.

```tsx
<SceneProvider
  mode="dom-interactive"    // 'dom-interactive' | 'canvas-interactive'
  trackFPS={true}           // Enable FPS tracking
  autoStart={true}          // Auto-start render loop
  onReady={() => {}}        // Called when GPU initialized
  onModeChange={(mode) => {}}
>
  {children}
</SceneProvider>
```

### useScene

Access engine state and controls.

```tsx
const {
  engine,       // Engine instance
  isReady,      // GPU initialized
  isGPUEnabled, // WebGPU available
  mode,         // Current mode
  setMode,      // Change mode
  fps,          // Current FPS (if trackFPS)
  isRunning,    // Render loop active
  start,        // Start loop
  stop,         // Stop loop
} = useScene();
```

### useSceneEvent

Subscribe to engine events.

```tsx
useSceneEvent('render', ({ deltaTime }) => {
  // Every frame
});

useSceneEvent('resize', ({ width, height }) => {
  // Canvas resized
});
```

---

## Surface Hooks

### useSurface

Register a DOM element as a tracked surface.

```tsx
function Card({ id }) {
  const { ref, surface, rect, isVisible } = useSurface(id, {
    label: 'Card',
    onLayoutChange: (rect) => console.log('Moved:', rect),
  });

  return <div ref={ref}>Content</div>;
}
```

### useSurfaceEffect

Apply GPU effects to a surface.

```tsx
function BlurCard({ id }) {
  const { ref } = useSurface(id);
  const { enable, disable, isEnabled } = useSurfaceEffect(id, 'blur', {
    strength: 5,
  });

  return (
    <div ref={ref} onMouseEnter={enable} onMouseLeave={disable}>
      Hover for blur
    </div>
  );
}
```

Available effects: `'blur'`, `'glow'`, `'distort'`, `'refract'`, `'ripple'`, `'pixelate'`

---

## Controller Hooks

### useScrollable

React hook wrapping `Scrollable` from @scene/controllers.

```tsx
const {
  offset,           // Current offset
  velocity,         // Current velocity
  isDragging,       // Drag active
  handleDragStart,  // Pointer down
  handleDrag,       // Pointer move (pass deltaX)
  handleDragEnd,    // Pointer up
  handleWheel,      // Wheel event (pass deltaY)
  snapTo,           // Snap to position
  setOffset,        // Set directly
  scrollable,       // Raw Scrollable instance
} = useScrollable({
  bounds: { min: -500, max: 0 },
  snap: { points: [0, -200, -400], threshold: 50 },
  inertia: { friction: 0.92 },
  wheelSensitivity: 0.5,
  onSnapEnd: ({ offset }) => console.log('Snapped to', offset),
});
```

### useDraggable

React hook wrapping `Draggable` from @scene/controllers.

```tsx
const {
  position,         // { x, y }
  velocity,         // { x, y }
  isDragging,
  handleDragStart,
  handleDrag,       // Pass (deltaX, deltaY)
  handleDragEnd,
  setPosition,
  draggable,        // Raw Draggable instance
} = useDraggable({
  bounds: { minX: 0, maxX: 500, minY: 0, maxY: 300 },
  axis: 'both',
  inertia: { friction: 0.92 },
  grid: { x: 50, y: 50 },
  onBoundReached: ({ axis, bound }) => console.log(`Hit ${bound}`),
});
```

---

## Motion Hooks

### useMotion

Single animated value with spring physics.

```tsx
const { value, animateTo, animateBy, set, stop, isAnimating } = useMotion(0);

// Animate with spring
animateTo(100, springs.snappy);

// Use in style
<div style={{ transform: `translateX(${value}px)` }} />
```

### useMotion2D

Two animated values (x, y).

```tsx
const { x, y, animateTo, set } = useMotion2D(0, 0);

animateTo(100, 200, springs.bouncy);
```

### useMotionBridge

Sync SceneValue with Motion's MotionValue for hybrid animations.

```tsx
import { motion } from 'motion/react';

function BridgedComponent({ sceneValue }) {
  const motionValue = useMotionBridge(sceneValue);
  
  return <motion.div style={{ x: motionValue }} />;
}
```

### useMotionBridgeMany

Bridge multiple SceneValues at once.

```tsx
const { x, y, scale } = useMotionBridgeMany({
  x: offsetX,
  y: offsetY,
  scale: zoom,
});
```

---

## Effect Hooks

### useScreenEffect

Add screen-wide post-processing effects.

```tsx
const { enable, disable, toggle, isEnabled, setParams } = useScreenEffect('blur', {
  strength: 3,
});

// Update params
setParams({ strength: 5 });
```

### useScreenEffects

Batch multiple screen effects.

```tsx
const effects = useScreenEffects([
  { type: 'blur', params: { strength: 2 } },
  { type: 'vignette', params: { intensity: 0.5 } },
]);

effects.enableAll();
effects.get('blur').setParams({ strength: 5 });
```

---

## Transition Hooks

### useTransition

Manage page transitions with animation states.

```tsx
const {
  state,          // 'idle' | 'exiting' | 'entering' | 'complete'
  progress,       // 0-1
  isTransitioning,
  startExit,      // Returns Promise
  startEnter,     // Returns Promise
  skip,           // Cancel transition
} = useTransition({
  type: 'dissolve',
  duration: 400,
  onExitComplete: () => console.log('Exit done'),
});

// Use with navigation
const handleNav = async (to: string) => {
  await startExit();
  navigate(to);
  startEnter();
};
```

### useTransitionStyle

Get CSS styles based on transition state.

```tsx
const transition = useTransition({ type: 'slide' });
const style = useTransitionStyle(transition, {
  property: 'transform',
  exitValue: 'translateX(-100%)',
  enterValue: 'translateX(100%)',
  idleValue: 'translateX(0)',
});

return <div style={style}>Page</div>;
```

### useStaggeredTransition

Coordinate multi-element transitions with stagger.

```tsx
function ListItem({ index, total }) {
  const transition = useTransition();
  const { progress, isActive } = useStaggeredTransition(transition, index, total);
  
  return (
    <div style={{ 
      opacity: isActive ? 1 - progress : 1,
      transform: isActive ? `translateY(${progress * 20}px)` : 'none',
    }}>
      Item {index}
    </div>
  );
}
```

---

## Material Hooks

### useMaterial

Create and manage GPU shader materials.

```tsx
const { material, isInitialized, setUniform } = useMaterial({
  name: 'CustomMaterial',
  vertexShader: VERTEX_CODE,
  fragmentShader: FRAGMENT_CODE,
  uniforms: {
    uProgress: { type: 'f32', default: 0 },
  },
});

setUniform('uProgress', 0.5);
```

### useDeformableMaterial

Material with animated deformation support.

```tsx
const { material, setBend, setWave, setRipple } = useDeformableMaterial({
  deformations: ['bend', 'wave'],
});

setBend(0.3);
```

---

## Hooks Reference

| Hook | Purpose |
|------|---------|
| `useSceneContext` | Raw context access |
| `useScene` | Engine state and controls |
| `useSceneEvent` | Subscribe to events |
| `useSurface` | Register surface |
| `useSurfaceById` | Get surface by ID |
| `useSurfaces` | Get all surfaces |
| `useSurfaceEffect` | Per-surface GPU effect |
| `useSurfaceEffects` | Multiple surface effects |
| `useScrollable` | 1D scroll/drag controller |
| `useDraggable` | 2D drag controller |
| `useMotion` | Single animated value |
| `useMotion2D` | 2D animated values |
| `useMotionBinding` | Bind SceneValue to uniform |
| `useMotionBridge` | SceneValue ↔ MotionValue |
| `useMotionBridgeMany` | Multiple bridges |
| `useMotionBridgeWithState` | Bridge with React state |
| `useScreenEffect` | Screen-wide effect |
| `useScreenEffects` | Multiple screen effects |
| `useTransition` | Page transitions |
| `useTransitionStyle` | Transition CSS styles |
| `useStaggeredTransition` | Multi-element stagger |
| `useMaterial` | GPU material |
| `useMaterialUniform` | Single uniform update |
| `useMaterialUniforms` | Multiple uniform updates |
| `useDeformableMaterial` | Material with deformations |

---

## Example: Slider from Primitives

```tsx
import { SceneProvider, useScrollable, useSurface, useMotion, springs } from '@scene/react';

const ITEMS = ['A', 'B', 'C', 'D', 'E'];
const ITEM_WIDTH = 100;

function Slider() {
  const { offset, handleDragStart, handleDrag, handleDragEnd, handleWheel } = useScrollable({
    bounds: { min: -(ITEMS.length - 1) * ITEM_WIDTH, max: 0 },
    snap: { points: ITEMS.map((_, i) => -i * ITEM_WIDTH) },
  });

  return (
    <div
      onPointerDown={handleDragStart}
      onPointerMove={(e) => e.buttons && handleDrag(e.movementX)}
      onPointerUp={handleDragEnd}
      onWheel={(e) => handleWheel(e.deltaY)}
      style={{ overflow: 'hidden', width: ITEM_WIDTH }}
    >
      <div style={{ display: 'flex', transform: `translateX(${offset}px)` }}>
        {ITEMS.map((item, i) => (
          <SliderItem key={item} id={`item-${i}`} label={item} />
        ))}
      </div>
    </div>
  );
}

function SliderItem({ id, label }) {
  const { ref } = useSurface(id, { label });
  const { value: scale, animateTo } = useMotion(1);

  return (
    <div
      ref={ref}
      style={{ 
        width: ITEM_WIDTH, 
        transform: `scale(${scale})`,
        transition: 'none',
      }}
      onMouseEnter={() => animateTo(1.1, springs.snappy)}
      onMouseLeave={() => animateTo(1, springs.snappy)}
    >
      {label}
    </div>
  );
}

export default function App() {
  return (
    <SceneProvider mode="dom-interactive">
      <Slider />
    </SceneProvider>
  );
}
```

## License

MIT
