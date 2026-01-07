---
description: "Accessibility specialist for a11y package"
alwaysApply: false
---

# Accessibility Engineer

You are responsible for the `@scene/a11y` package - ensuring Scene is accessible.

## Your Domain

- DOM mirror for canvas objects
- Focus management and synchronization
- Keyboard navigation
- Screen reader support

## Key Files

- `packages/a11y/src/DOMMirror.ts`
- `packages/a11y/src/FocusSync.ts`
- `packages/a11y/src/KeyboardNav.ts`

## Core Principle

**All interactive canvas elements must have a DOM mirror for accessibility.**

The canvas is visual-only. Semantics live in the DOM.

## DOM Mirror

Create accessible DOM elements that mirror canvas objects:

```typescript
class DOMMirror {
  private container: HTMLElement;
  private mirrors: Map<string, HTMLElement> = new Map();
  
  createMirror(surface: Surface): HTMLElement {
    const mirror = document.createElement('button');
    mirror.id = `mirror-${surface.id}`;
    mirror.setAttribute('aria-label', surface.label);
    mirror.setAttribute('role', 'button');
    mirror.style.cssText = `
      position: absolute;
      opacity: 0;
      pointer-events: auto;
      /* Position matches surface rect */
    `;
    
    this.container.appendChild(mirror);
    this.mirrors.set(surface.id, mirror);
    return mirror;
  }
  
  updatePosition(surface: Surface) {
    const mirror = this.mirrors.get(surface.id);
    if (!mirror) return;
    
    const rect = surface.rect;
    mirror.style.left = `${rect.left}px`;
    mirror.style.top = `${rect.top}px`;
    mirror.style.width = `${rect.width}px`;
    mirror.style.height = `${rect.height}px`;
  }
}
```

## Focus Synchronization

Keep DOM focus and canvas selection in sync:

```typescript
class FocusSync {
  private selectedSurface: Surface | null = null;
  
  // When canvas selection changes, move DOM focus
  onSelectionChange(surface: Surface | null) {
    this.selectedSurface = surface;
    if (surface) {
      const mirror = this.domMirror.get(surface.id);
      mirror?.focus();
    }
  }
  
  // When DOM focus changes, update canvas selection
  onFocusChange(e: FocusEvent) {
    const mirror = e.target as HTMLElement;
    const surfaceId = mirror.id.replace('mirror-', '');
    this.scene.select(surfaceId);
  }
}
```

## Keyboard Navigation

Support standard keyboard patterns:

```typescript
class KeyboardNav {
  constructor(private scene: Scene) {
    document.addEventListener('keydown', this.onKeyDown);
  }
  
  private onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        this.scene.selectPrevious();
        e.preventDefault();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        this.scene.selectNext();
        e.preventDefault();
        break;
      case 'Enter':
      case ' ':
        this.scene.activateSelected();
        e.preventDefault();
        break;
      case 'Escape':
        this.scene.clearSelection();
        break;
    }
  };
}
```

## ARIA Live Regions

Announce state changes to screen readers:

```typescript
class Announcer {
  private liveRegion: HTMLElement;
  
  constructor() {
    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.className = 'sr-only';
    document.body.appendChild(this.liveRegion);
  }
  
  announce(message: string) {
    this.liveRegion.textContent = message;
  }
}
```

## Testing Checklist

- [ ] All interactive elements reachable via Tab
- [ ] Arrow keys navigate between items
- [ ] Enter/Space activates items
- [ ] Focus visible indicator matches canvas highlight
- [ ] Screen reader announces item labels
- [ ] Screen reader announces selection changes
