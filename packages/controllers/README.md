# @scene/controllers

Composable interaction primitives for Scene engine. Build custom interactions by combining `Scrollable` and `Draggable` with constraints, snap points, and inertia.

**Philosophy**: Scene provides primitives, not implementations. Carousels, sliders, and galleries are composed from these building blocks in user code.

## Installation

```bash
npm install @scene/controllers
```

## Primitives

### Scrollable

1D scroll/drag controller with bounds, snap points, inertia, and wheel support.

```typescript
import { Scrollable } from '@scene/controllers';

const scroll = new Scrollable({
  bounds: { min: -500, max: 500 },
  snap: {
    points: [-320, 0, 320],
    threshold: 50,
  },
  inertia: {
    friction: 0.92,
    minVelocity: 0.1,
  },
  wheelSensitivity: 0.025,
});

// Handle input
scroll.handleDragStart();
scroll.handleDrag(deltaX);
scroll.handleDragEnd(velocityX);
scroll.handleWheel(-event.deltaY);

// Events
scroll.on('change', ({ offset, velocity }) => {
  element.style.transform = `translateX(${offset}px)`;
});

scroll.on('snapEnd', ({ offset }) => {
  console.log('Snapped to:', offset);
});

// Direct control
scroll.snapTo(320);
scroll.setOffset(0);
scroll.getState(); // { offset, velocity, isDragging }
```

### Draggable

2D drag controller with bounds, axis constraints, grid snapping, and inertia.

```typescript
import { Draggable } from '@scene/controllers';

const drag = new Draggable({
  bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 },
  axis: 'both', // 'x' | 'y' | 'both'
  inertia: {
    enabled: true,
    friction: 0.92,
  },
  grid: { x: 50, y: 50 }, // Optional grid snapping
});

// Handle input
drag.handleDragStart();
drag.handleDrag(deltaX, deltaY);
drag.handleDragEnd(velocityX, velocityY);

// Events
drag.on('change', ({ position, velocity }) => {
  element.style.transform = `translate(${position.x}px, ${position.y}px)`;
});

drag.on('boundReached', ({ axis, bound }) => {
  console.log(`Hit ${bound} on ${axis} axis`);
});

// Direct control
drag.setPosition({ x: 100, y: 100 });
drag.moveBy({ x: 10, y: 0 });
drag.getState(); // { position, velocity, isDragging }
```

---

## Composing a Carousel

Carousels are user-level code built from `Scrollable`:

```typescript
import { Scrollable } from '@scene/controllers';

// Your carousel is just Scrollable + item positions
const items = ['card-1', 'card-2', 'card-3', 'card-4', 'card-5'];
const ITEM_WIDTH = 320;

const carousel = new Scrollable({
  bounds: { 
    min: -(items.length - 1) * ITEM_WIDTH, 
    max: 0 
  },
  snap: {
    points: items.map((_, i) => -i * ITEM_WIDTH),
    threshold: ITEM_WIDTH / 3,
  },
  inertia: { friction: 0.92 },
});

// Compute item positions from offset
function getItemStates(offset: number) {
  return items.map((id, i) => ({
    id,
    x: offset + i * ITEM_WIDTH,
    isCenter: Math.abs(offset + i * ITEM_WIDTH) < ITEM_WIDTH / 2,
  }));
}

carousel.on('change', ({ offset }) => {
  const states = getItemStates(offset);
  // Render items at computed positions
});

// Navigation helpers
function next() {
  const currentIndex = Math.round(-carousel.offset / ITEM_WIDTH);
  const nextIndex = Math.min(currentIndex + 1, items.length - 1);
  carousel.snapTo(-nextIndex * ITEM_WIDTH);
}

function previous() {
  const currentIndex = Math.round(-carousel.offset / ITEM_WIDTH);
  const prevIndex = Math.max(currentIndex - 1, 0);
  carousel.snapTo(-prevIndex * ITEM_WIDTH);
}
```

---

## Integration with InputManager

```typescript
import { InputManager } from '@scene/input';
import { Scrollable } from '@scene/controllers';

const scroll = new Scrollable({ /* config */ });

input.onIntent('dragStart', () => scroll.handleDragStart());
input.onIntent('drag', ({ deltaX }) => scroll.handleDrag(deltaX));
input.onIntent('dragEnd', ({ velocityX }) => scroll.handleDragEnd(velocityX));

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  scroll.handleWheel(-e.deltaY);
});
```

---

## Integration with SceneValue

Bind controller offset to GPU uniforms:

```typescript
import { SceneValue } from '@scene/motion';
import { Scrollable } from '@scene/controllers';

const offsetValue = new SceneValue(0);
offsetValue.bindTo(material, 'uOffset');

const scroll = new Scrollable({
  bounds: { min: -1000, max: 0 },
});

scroll.on('change', ({ offset }) => {
  offsetValue.set(offset);
});
```

---

## Configuration Reference

### Scrollable

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialOffset` | `number` | `0` | Starting offset |
| `bounds.min` | `number` | `-Infinity` | Minimum bound |
| `bounds.max` | `number` | `Infinity` | Maximum bound |
| `snap.points` | `number[]` | `[]` | Positions to snap to |
| `snap.threshold` | `number` | `50` | Distance to trigger snap |
| `snap.spring` | `SpringConfig` | `springs.snappy` | Spring for snap animation |
| `inertia.friction` | `number` | `0.92` | Velocity decay per frame |
| `inertia.minVelocity` | `number` | `0.1` | Stop threshold |
| `wheelSensitivity` | `number` | `0.025` | Wheel delta multiplier |
| `dragSensitivity` | `number` | `1` | Drag delta multiplier |
| `rubberband` | `boolean` | `false` | Allow overscroll with resistance |
| `rubberbandFactor` | `number` | `0.5` | Overscroll resistance (0-1) |
| `direction` | `'horizontal' \| 'vertical'` | `'horizontal'` | A11y hint |
| `reducedMotion` | `boolean` | auto | Respect prefers-reduced-motion |

### Draggable

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialPosition` | `{x, y}` | `{x:0, y:0}` | Starting position |
| `bounds.minX/maxX` | `number` | `±Infinity` | X constraints |
| `bounds.minY/maxY` | `number` | `±Infinity` | Y constraints |
| `axis` | `'x' \| 'y' \| 'both'` | `'both'` | Lock to axis |
| `inertia.enabled` | `boolean` | `true` | Enable momentum |
| `inertia.friction` | `number` | `0.92` | Velocity decay |
| `grid.x/y` | `number` | - | Snap to grid |
| `gridSnapMode` | `'drag' \| 'release'` | `'release'` | When to snap |
| `sensitivity` | `number` | `1` | Drag multiplier |

---

## Utilities

```typescript
import { prefersReducedMotion, onReducedMotionChange } from '@scene/controllers';

// Check current preference
if (prefersReducedMotion()) {
  // Disable animations
}

// React to changes
const unsubscribe = onReducedMotionChange((prefers) => {
  scroll.setReducedMotion(prefers);
});
```

---

## Exports

```typescript
// Primitives
export { Scrollable } from './Scrollable';
export { Draggable } from './Draggable';

// Types
export type { 
  ScrollableConfig, 
  DraggableConfig,
  State1D,
  State2D,
  Point,
  Bounds1D,
  Bounds2D,
  SnapConfig,
  InertiaConfig,
} from './types';

// Utilities
export { prefersReducedMotion, onReducedMotionChange } from './utils';
```

## License

MIT
