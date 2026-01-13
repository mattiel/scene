# Phase 5: Input System - COMPLETE

**Date:** January 12, 2026  
**Author:** Claude (AI Assistant)

## Summary

Implemented the `@scene/input` package providing unified pointer handling, inertia, and surface picking for Canvas-Interactive mode.

## Deliverables

### Core Components

1. **PointerManager** (`src/PointerManager.ts`)
   - Normalizes mouse, touch, and pen events into unified interface
   - Tracks multiple pointers for multi-touch support
   - Uses pointer capture for reliable drag tracking
   - Calculates deltas and provides gesture state
   - Supports configurable drag threshold

2. **Inertia** (`src/Inertia.ts`)
   - Momentum and deceleration for drag gestures
   - Velocity calculation from recent movement samples
   - Configurable friction and minimum velocity
   - Optional bounds with bounce effect
   - RAF-based animation loop

3. **Picking** (`src/Picking.ts`)
   - CPU-based surface hit testing (rect intersection)
   - Returns all surfaces at point sorted by z-index
   - Hover tracking with enter/leave callbacks
   - Works with any registry implementing `PickableRegistry` interface

4. **InputManager** (`src/InputManager.ts`)
   - High-level coordinator tying all components together
   - Integrates with Engine's mode system (DOM vs Canvas interactive)
   - Intent-based event system (tap, drag, hover)
   - Automatic picking enable/disable based on mode

### Test Page

- `tests/basic/input-demo.html` - Interactive demo with dragging, inertia, and picking

## Build Output

```
@scene/input@0.0.1
├── dist/index.js     20.75 kB (5.08 kB gzipped)
└── dist/index.d.ts   TypeScript declarations
```

## API Overview

### InputManager (High-Level)

```typescript
const input = new InputManager(engine, { registry });
input.initialize();

input.onIntent('tap', ({ surfaceId, x, y }) => {
  console.log('Tapped', surfaceId);
});

input.onIntent('drag', ({ deltaX, deltaY }) => {
  console.log('Dragging', deltaX, deltaY);
});

input.onIntent('inertia', ({ x, y, isActive }) => {
  console.log('Inertia update', x, y);
});
```

### PointerManager (Low-Level)

```typescript
const pointer = new PointerManager(element, {
  onPointerDown: (p) => console.log('Down', p.x, p.y),
  onDragStart: (gesture, p) => console.log('Drag start'),
  onDrag: (gesture, p) => console.log('Delta', p.deltaX, p.deltaY),
  onDragEnd: (gesture, p) => console.log('Drag end'),
});
pointer.attach();
```

### Inertia

```typescript
const inertia = new Inertia({ friction: 0.92 });
inertia.setCallback((state) => updatePosition(state.x, state.y));

// On drag start
inertia.startTracking(x, y);
// During drag
inertia.addSample(x, y);
// On drag end
inertia.release();
```

### Picking

```typescript
const picking = new Picking({
  onEnter: (surface) => surface.element.classList.add('hovered'),
  onLeave: (surface) => surface.element.classList.remove('hovered'),
});
picking.setRegistry(surfaceRegistry);

const topHit = picking.pickTop(x, y);
```

## Files Created

```
packages/input/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── src/
│   ├── index.ts
│   ├── PointerManager.ts
│   ├── Inertia.ts
│   ├── Picking.ts
│   └── InputManager.ts
└── tests/
    └── basic/
        └── input-demo.html
```

## Integration with Engine

The InputManager integrates with the Engine's existing mode system:

- **DOM-Interactive mode** (default): Canvas has `pointer-events: none`, picking disabled
- **Canvas-Interactive mode**: Canvas has `pointer-events: auto`, picking enabled

Mode changes are automatically detected via the EventBus `mode:changed` event.

## Intent Events

InputManager emits high-level intents instead of raw pointer events:

| Intent | Payload | Description |
|--------|---------|-------------|
| `tap` | `{ surfaceId, x, y }` | Click/tap without drag |
| `dragStart` | `{ surfaceId, x, y }` | Drag gesture started |
| `drag` | `{ surfaceId, deltaX, deltaY, totalDeltaX, totalDeltaY }` | During drag |
| `dragEnd` | `{ surfaceId, velocityX, velocityY }` | Drag gesture ended |
| `hoverEnter` | `{ surfaceId }` | Pointer entered surface |
| `hoverLeave` | `{ surfaceId }` | Pointer left surface |
| `inertia` | `InertiaState` | Inertia animation update |

## Validation

- [x] Build successful
- [x] TypeScript declarations generated
- [x] TypeCheck passes
- [x] Test page created

## Design Decisions

1. **Intent-based events**: InputManager emits semantic intents (tap, drag) rather than raw pointer events, making it easier for consumers to handle user actions without tracking state.

2. **Decoupled picking**: Picking uses a `PickableRegistry` interface rather than directly depending on `@scene/surfaces`, allowing flexibility in what can be picked.

3. **Existing mode system**: Rather than creating a new ModeManager, the InputManager integrates with Engine's existing `mode` property and `mode:changed` event.

4. **Velocity sampling**: Inertia uses weighted velocity calculation from recent samples for smoother momentum animation.
