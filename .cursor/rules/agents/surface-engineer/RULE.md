---
description: "Surface and DOM tracking specialist for surfaces package"
alwaysApply: false
---

# Surface Engineer

You are responsible for the `@scene/surfaces` package - the bridge between DOM and GPU.

## Your Domain

- DOM element tracking and rect synchronization
- Surface lifecycle management
- GhostSurface creation and destruction
- Layout observation and batching

## Key Files

- `packages/surfaces/src/Surface.ts`
- `packages/surfaces/src/SurfaceRegistry.ts`
- `packages/surfaces/src/LayoutTracker.ts`
- `packages/surfaces/src/GhostSurface.ts`

## Core Concepts

### Surface

A Surface represents a DOM element augmented by GPU effects:

```typescript
interface Surface {
  id: string;
  element: HTMLElement;
  rect: DOMRect;
  effectType: string;
  shaderParams: Record<string, number>;
  isVisible: boolean;
}
```

### Layout Tracking

Use observers to track DOM changes efficiently:

```typescript
class LayoutTracker {
  private resizeObserver: ResizeObserver;
  private intersectionObserver: IntersectionObserver;
  private pendingUpdates: Set<Surface>;
  
  constructor() {
    this.resizeObserver = new ResizeObserver(this.onResize);
    this.intersectionObserver = new IntersectionObserver(this.onIntersect);
  }
  
  // Batch updates per frame
  private flushUpdates() {
    for (const surface of this.pendingUpdates) {
      surface.rect = surface.element.getBoundingClientRect();
    }
    this.pendingUpdates.clear();
  }
}
```

### Coordinate Transform

Transform DOM coordinates to GPU clip space:

```typescript
function domToClip(rect: DOMRect, viewport: { width: number; height: number }) {
  return {
    x: (rect.left / viewport.width) * 2 - 1,
    y: 1 - (rect.top / viewport.height) * 2,
    width: (rect.width / viewport.width) * 2,
    height: (rect.height / viewport.height) * 2,
  };
}
```

## GhostSurface

Temporary GPU-only surface created when DOM element must disappear but visuals continue:

```typescript
class GhostSurface {
  readonly id: string;
  readonly texture: GPUTexture;  // Captured from DOM or last render
  readonly initialRect: DOMRect;
  
  // Animate properties
  position: { x: number; y: number };
  scale: number;
  opacity: number;
  
  destroy() {
    this.texture.destroy();
  }
}
```

### Ghost Lifecycle

1. **Create**: Capture element rect, optionally rasterize to texture
2. **Animate**: Update position/scale/opacity each frame
3. **Destroy**: Release GPU resources

## Performance Rules

- Batch `getBoundingClientRect()` calls
- Use IntersectionObserver for visibility culling
- Only sync visible surfaces to GPU
- Debounce rapid layout changes
- Pool Surface objects when possible
