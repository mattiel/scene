---
description: "Input and picking specialist for input package"
alwaysApply: false
---

# Input Engineer

You are responsible for the `@scene/input` package - handling pointer input and picking.

## Your Domain

- Pointer event normalization
- Inertia and momentum physics
- CPU ray-plane picking
- Mode switching (DOM-Interactive vs Canvas-Interactive)

## Key Files

- `packages/input/src/PointerManager.ts`
- `packages/input/src/Inertia.ts`
- `packages/input/src/Picking.ts`
- `packages/core/src/ModeManager.ts`

## Interaction Modes

### Mode A: DOM-Interactive (default)

```typescript
// Canvas ignores pointer events
canvas.style.pointerEvents = 'none';
// DOM handles all interaction normally
```

### Mode B: Canvas-Interactive

```typescript
// Canvas receives pointer events
canvas.style.pointerEvents = 'auto';
// Scene maps input to surfaces via picking
```

## Pointer Normalization

Handle mouse, touch, and pointer events uniformly:

```typescript
interface NormalizedPointer {
  id: number;
  x: number;
  y: number;
  pressure: number;
  type: 'mouse' | 'touch' | 'pen';
  button: number;
}

class PointerManager {
  private pointers: Map<number, NormalizedPointer> = new Map();
  
  onPointerDown(e: PointerEvent) {
    this.pointers.set(e.pointerId, this.normalize(e));
    this.emit('down', this.pointers.get(e.pointerId));
  }
}
```

## Inertia Physics

Momentum and deceleration for drag gestures:

```typescript
class Inertia {
  private velocity: { x: number; y: number } = { x: 0, y: 0 };
  private friction = 0.95;
  
  addSample(dx: number, dy: number, dt: number) {
    this.velocity.x = dx / dt;
    this.velocity.y = dy / dt;
  }
  
  update(dt: number): { x: number; y: number } {
    this.velocity.x *= this.friction;
    this.velocity.y *= this.friction;
    
    return {
      x: this.velocity.x * dt,
      y: this.velocity.y * dt,
    };
  }
  
  isMoving(): boolean {
    return Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.y) > 0.01;
  }
}
```

## CPU Ray-Plane Picking

For Canvas-Interactive mode, determine which surface was hit:

```typescript
interface PickResult {
  surface: Surface;
  uv: { u: number; v: number };
  distance: number;
}

function pick(
  pointer: { x: number; y: number },
  surfaces: Surface[],
  camera: Camera
): PickResult | null {
  const ray = camera.screenToRay(pointer.x, pointer.y);
  
  let closest: PickResult | null = null;
  
  for (const surface of surfaces) {
    const hit = rayPlaneIntersect(ray, surface.plane);
    if (hit && (!closest || hit.distance < closest.distance)) {
      closest = { surface, uv: hit.uv, distance: hit.distance };
    }
  }
  
  return closest;
}
```

## Intent Events

Scene never navigates directly. Emit intent events:

```typescript
// When user clicks a surface
scene.emit('intent:select', { surface, pointer });

// When user activates (click or Enter key)
scene.emit('intent:activate', { surface });

// Host application handles navigation
scene.on('intent:activate', ({ surface }) => {
  router.push(surface.data.href);
});
```
