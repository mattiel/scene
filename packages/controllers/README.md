# @scene/controllers

High-level interaction controllers for Scene engine. Composes input, motion, and constraints into reusable behaviors.

## Installation

```bash
pnpm add @scene/controllers
```

## Controllers

### Scrollable

1D scroll controller with bounds, snap points, inertia, and wheel support.

```typescript
import { Scrollable } from '@scene/controllers';

const scroll = new Scrollable({
  minOffset: -500,
  maxOffset: 500,
  snapPoints: [-320, 0, 320],
  autoSnap: true,
  wheelSensitivity: 0.025,
});

// Handle input
scroll.handleDragStart();
scroll.handleDrag(deltaX);
scroll.handleDragEnd(velocityX);
scroll.handleWheel(-event.deltaY);

// Events
scroll.on('change', ({ offset, velocity }) => {
  material.setUniform('offset', offset);
});

scroll.on('snapEnd', ({ offset }) => {
  console.log('Snapped to:', offset);
});

// Direct control
scroll.snapTo(320);
scroll.setOffset(0);
```

### Draggable

2D drag controller with bounds, axis constraints, and inertia.

```typescript
import { Draggable } from '@scene/controllers';

const drag = new Draggable({
  bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 },
  axis: 'both', // or 'x' | 'y'
  enableInertia: true,
});

// Handle input
drag.handleDragStart();
drag.handleDrag(deltaX, deltaY);
drag.handleDragEnd(velocityX, velocityY);

// Events
drag.on('change', ({ position, velocity }) => {
  element.style.transform = `translate(${position.x}px, ${position.y}px)`;
});

drag.on('boundReached', ({ bounds }) => {
  console.log('Hit bounds:', bounds);
});

// Direct control
drag.setPosition({ x: 100, y: 100 });
drag.moveBy({ x: 10, y: 0 });
```

### Carousel

Item-based carousel controller built on Scrollable. Manages layout, center detection, and expand/collapse states.

```typescript
import { Carousel } from '@scene/controllers';

const carousel = new Carousel({
  items: [
    { id: 'card-1', label: 'Card 1' },
    { id: 'card-2', label: 'Card 2' },
    { id: 'card-3', label: 'Card 3' },
  ],
  itemSpacing: 320,
  centerSnap: true,
  allowExpand: true,
});

// Handle input
carousel.handleDragStart();
carousel.handleDrag(deltaX);
carousel.handleDragEnd(velocityX);
carousel.handleWheel(-event.deltaY);
carousel.handleItemTap('card-2', x, y);

// Events
carousel.on('centerChange', ({ item, index }) => {
  console.log('Center:', item.label);
});

carousel.on('offsetChange', ({ offset, velocity }) => {
  material.setUniform('globalBend', velocity * 0.01);
});

carousel.on('itemExpand', ({ item }) => {
  console.log('Expanded:', item.label);
});

// Navigation
carousel.next();
carousel.previous();
carousel.scrollToIndex(2);
carousel.scrollToItem('card-2');

// Expand/collapse
carousel.expandItem(1);
carousel.collapseItem();

// Layout computation
const states = carousel.computeItemStates();
states.forEach(({ item, x, distance, isCenter, isExpanded }) => {
  // Use for rendering
});
```

## Integration with InputManager

Controllers are designed to work with `@scene/input`:

```typescript
import { InputManager } from '@scene/input';
import { Carousel } from '@scene/controllers';

const carousel = new Carousel({ items, itemSpacing: 320 });

input.onIntent('dragStart', () => carousel.handleDragStart());
input.onIntent('drag', ({ deltaX }) => carousel.handleDrag(deltaX));
input.onIntent('dragEnd', ({ velocityX }) => carousel.handleDragEnd(velocityX));
input.onIntent('tap', ({ surfaceId, x, y }) => {
  if (surfaceId) carousel.handleItemTap(surfaceId, x, y);
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  carousel.handleWheel(-e.deltaY);
});
```

## Integration with Motion

Bind controller values to SceneValue for GPU uniform sync:

```typescript
import { SceneValue } from '@scene/motion';
import { Scrollable } from '@scene/controllers';

const offsetValue = new SceneValue(0);
offsetValue.bindTo(material, 'offset');

const scroll = new Scrollable({
  sceneValue: offsetValue,
});

// Offset automatically syncs to material uniform
scroll.handleDrag(100);
```

## Configuration Options

### Scrollable

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialOffset` | `number` | `0` | Starting offset |
| `minOffset` | `number` | `-Infinity` | Minimum bound |
| `maxOffset` | `number` | `Infinity` | Maximum bound |
| `snapPoints` | `number[]` | `[]` | Positions to snap to |
| `autoSnap` | `boolean` | `false` | Snap on release |
| `snapThreshold` | `number` | `50` | Distance to trigger snap |
| `dragSensitivity` | `number` | `1` | Drag multiplier |
| `wheelSensitivity` | `number` | `0.025` | Wheel multiplier |
| `friction` | `number` | `0.92` | Inertia friction |
| `reducedMotion` | `boolean` | `false` | Respect prefers-reduced-motion |

### Draggable

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialPosition` | `Position` | `{x:0, y:0}` | Starting position |
| `bounds` | `DraggableBounds` | `{}` | Movement constraints |
| `axis` | `'x' \| 'y' \| 'both'` | `'both'` | Axis constraint |
| `sensitivity` | `number` | `1` | Drag multiplier |
| `enableInertia` | `boolean` | `true` | Enable momentum |
| `bounce` | `number` | `0` | Bounce on bounds (0-1) |

### Carousel

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `items` | `CarouselItem[]` | `[]` | Carousel items |
| `itemSpacing` | `number` | `320` | Space between items |
| `centerSnap` | `boolean` | `true` | Snap to center item |
| `initialIndex` | `number` | middle | Starting center index |
| `allowExpand` | `boolean` | `true` | Allow tap to expand |
| `collapseOnScroll` | `boolean` | `true` | Collapse on scroll/drag |

## License

MIT
