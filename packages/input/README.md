# @scene/input

Input system for the Scene engine. Provides unified pointer handling, inertia, and surface picking.

## Features

- **PointerManager**: Normalizes mouse, touch, and pen events into a unified interface
- **Inertia**: Momentum and deceleration for drag gestures
- **Picking**: CPU-based surface hit testing
- **InputManager**: High-level coordinator that integrates with the Engine

## Installation

```bash
pnpm add @scene/input
```

## Usage

### Basic Setup

```typescript
import { Engine } from '@scene/core';
import { InputManager } from '@scene/input';

const engine = new Engine({ canvas: '#canvas' });
const input = new InputManager(engine);
input.initialize();

// Listen for intents
input.onIntent('tap', ({ surfaceId, x, y }) => {
  console.log('Tap at', x, y, 'on surface', surfaceId);
});

input.onIntent('drag', ({ deltaX, deltaY }) => {
  console.log('Dragging', deltaX, deltaY);
});

input.onIntent('inertia', ({ x, y, velocityX, velocityY }) => {
  console.log('Inertia update', x, y);
});
```

### With Surface Picking

```typescript
import { SurfaceRegistry } from '@scene/surfaces';
import { InputManager } from '@scene/input';

const registry = new SurfaceRegistry();
// ... add surfaces to registry

const input = new InputManager(engine, {
  registry,
  enablePicking: true,
});
input.initialize();

input.onIntent('hoverEnter', ({ surfaceId }) => {
  console.log('Hovering over', surfaceId);
});
```

### Low-Level API

Use the individual components directly for more control:

```typescript
import { PointerManager, Inertia, Picking } from '@scene/input';

// Pointer handling
const pointer = new PointerManager(element, {
  onPointerDown: (p) => console.log('Down', p.x, p.y),
  onDragStart: (gesture) => console.log('Drag started'),
  onDrag: (gesture, p) => console.log('Dragging', p.deltaX, p.deltaY),
  onDragEnd: (gesture, p) => console.log('Drag ended'),
});
pointer.attach();

// Inertia
const inertia = new Inertia({
  friction: 0.92,
  bounds: { minX: 0, maxX: 1000 },
});
inertia.setCallback((state) => {
  updatePosition(state.x, state.y);
});

// On drag start
inertia.startTracking(startX, startY);
// During drag
inertia.addSample(currentX, currentY);
// On drag end
inertia.release(); // Starts momentum animation

// Picking
const picking = new Picking({
  onEnter: (surface) => console.log('Entered', surface.id),
  onLeave: (surface) => console.log('Left', surface.id),
});
picking.setRegistry(surfaceRegistry);

// Manual picking
const hits = picking.pick(x, y);
const topHit = picking.pickTop(x, y);
```

## API Reference

### InputManager

High-level input coordinator.

| Method | Description |
|--------|-------------|
| `initialize(target?)` | Initialize with target element |
| `setRegistry(registry)` | Set surface registry for picking |
| `onIntent(intent, callback)` | Subscribe to an intent |
| `destroy()` | Clean up resources |

**Intents:**
- `tap` - Tap/click without drag
- `drag` - During drag motion
- `dragStart` - Drag gesture started
- `dragEnd` - Drag gesture ended
- `hoverEnter` - Pointer entered a surface
- `hoverLeave` - Pointer left a surface
- `inertia` - Inertia animation update

### PointerManager

Low-level pointer event handling.

| Method | Description |
|--------|-------------|
| `attach()` | Start listening for events |
| `detach()` | Stop listening for events |
| `getPointers()` | Get all active pointers |
| `getGesture()` | Get current gesture state |

### Inertia

Momentum and deceleration.

| Method | Description |
|--------|-------------|
| `startTracking(x, y)` | Begin tracking (drag start) |
| `addSample(x, y)` | Add position sample (during drag) |
| `release()` | Start inertia animation (drag end) |
| `stop()` | Stop inertia animation |
| `setBounds(bounds)` | Set motion bounds |
| `getState()` | Get current state |

### Picking

Surface hit testing.

| Method | Description |
|--------|-------------|
| `setRegistry(registry)` | Set pickable surface registry |
| `pick(x, y)` | Get all surfaces at point |
| `pickTop(x, y)` | Get topmost surface at point |
| `handlePointerMove(pointer)` | Process pointer move for hover |
| `getHovered()` | Get currently hovered surface IDs |

## Integration with Engine Modes

InputManager automatically responds to Engine mode changes:

- **DOM-Interactive mode**: Picking disabled, DOM handles events
- **Canvas-Interactive mode**: Picking enabled, surfaces receive events

```typescript
// Switch to canvas mode to enable picking
engine.mode = InteractionMode.CANVAS_INTERACTIVE;
```

## Dependencies

- `@scene/core` - Engine and EventBus
