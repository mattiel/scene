# @scene/a11y

Accessibility layer for Scene - DOM mirrors, focus synchronization, and ARIA announcements for Canvas-Interactive mode.

## Overview

In Canvas-Interactive mode (Mode B), the canvas owns pointer events and Scene renders surfaces via WebGPU. However, screen readers and keyboard navigation require accessible DOM elements. This package provides:

- **DOMMirror** - Creates visually-hidden DOM elements positioned over canvas surfaces
- **FocusSync** - Synchronizes focus and keyboard navigation between mirrors and Scene
- **LiveAnnouncer** - Manages ARIA live regions for screen reader announcements
- **A11yManager** - High-level coordinator that integrates with Engine

## Installation

```bash
pnpm add @scene/a11y
```

## Quick Start

```typescript
import { Engine } from '@scene/core';
import { SurfaceRegistry } from '@scene/surfaces';
import { A11yManager } from '@scene/a11y';

const engine = new Engine({ mode: 'canvas-interactive' });
const registry = new SurfaceRegistry();

// Create A11yManager
const a11y = new A11yManager(engine, { registry });

// Configure accessibility for specific surfaces
a11y.configure('card-1', {
  label: 'Product Card',
  role: 'button',
});

// Listen for accessibility events
engine.on('a11y:select', ({ surfaceId }) => {
  console.log('Selected:', surfaceId);
});

engine.on('a11y:activate', ({ surfaceId }) => {
  console.log('Activated:', surfaceId);
});
```

## API Reference

### A11yManager

High-level coordinator that integrates accessibility with Scene.

```typescript
interface A11yManagerConfig {
  registry: SurfaceRegistry;      // Surface registry to track
  container?: HTMLElement;        // Container for mirrors (default: document.body)
  defaultRole?: string;           // Default ARIA role (default: 'button')
  navigationAxis?: NavigationAxis; // Arrow key axis (default: 'horizontal')
  wrapNavigation?: boolean;       // Wrap at ends (default: true)
  autoCreateMirrors?: boolean;    // Auto-create mirrors (default: true)
  skipGhosts?: boolean;           // Skip ghost surfaces (default: true)
}

class A11yManager {
  constructor(engine: Engine, config: A11yManagerConfig);
  
  // Configure a surface's accessibility
  configure(surfaceId: string, config: MirrorConfig): void;
  
  // Make an announcement
  announce(message: string, politeness?: 'polite' | 'assertive'): void;
  
  // Access underlying components
  get mirror(): DOMMirror;
  get focus(): FocusSync;
  get announcer(): LiveAnnouncer;
  
  // Check reduced motion preference
  get prefersReducedMotion(): boolean;
  
  destroy(): void;
}
```

### DOMMirror

Creates and manages accessible DOM elements that mirror canvas surfaces.

```typescript
interface MirrorConfig {
  role?: string;           // ARIA role (default: 'button')
  label?: string;          // Accessible name (aria-label)
  description?: string;    // Accessible description
  tabIndex?: number;       // Tab order (default: 0)
  ariaAttributes?: Record<string, string>; // Additional ARIA attributes
}

class DOMMirror {
  constructor(config?: { container?: HTMLElement });
  
  // Create a mirror for a surface
  createMirror(surfaceId: string, config?: MirrorConfig): HTMLElement;
  
  // Update mirror position
  updatePosition(surfaceId: string, rect: { x, y, width, height }): void;
  
  // Update mirror configuration
  updateConfig(surfaceId: string, config: Partial<MirrorConfig>): void;
  
  // Remove a mirror
  removeMirror(surfaceId: string): void;
  
  // Get mirror element
  getMirror(surfaceId: string): HTMLElement | undefined;
  
  // Enable/disable all mirrors
  setEnabled(enabled: boolean): void;
  
  get isEnabled(): boolean;
  get size(): number;
  
  destroy(): void;
}
```

### FocusSync

Handles keyboard navigation and focus synchronization.

```typescript
type NavigationAxis = 'horizontal' | 'vertical' | 'both';

interface FocusSyncConfig {
  wrapNavigation?: boolean;      // Wrap at ends (default: true)
  navigationAxis?: NavigationAxis; // Arrow key direction (default: 'horizontal')
}

class FocusSync {
  constructor(mirror: DOMMirror, config?: FocusSyncConfig);
  
  // Set navigation order
  setNavigationOrder(surfaceIds: string[]): void;
  
  // Programmatic selection
  select(surfaceId: string | null): void;
  getSelected(): string | null;
  
  // Navigation
  selectNext(): void;
  selectPrevious(): void;
  selectFirst(): void;
  selectLast(): void;
  
  // Activation (Enter/Space)
  activate(): void;
  
  // Event subscriptions
  onSelect(callback: (surfaceId: string | null) => void): () => void;
  onActivate(callback: (surfaceId: string) => void): () => void;
  
  destroy(): void;
}
```

**Keyboard bindings:**
- `Tab` / `Shift+Tab` - Standard focus navigation
- `ArrowLeft` / `ArrowRight` - Horizontal navigation (when axis includes horizontal)
- `ArrowUp` / `ArrowDown` - Vertical navigation (when axis includes vertical)
- `Enter` / `Space` - Activate selected surface
- `Home` - Go to first surface
- `End` - Go to last surface

### LiveAnnouncer

Manages ARIA live regions for screen reader announcements.

```typescript
type Politeness = 'polite' | 'assertive';

interface LiveAnnouncerConfig {
  container?: HTMLElement;       // Container for live region
  defaultPoliteness?: Politeness; // Default level (default: 'polite')
  clearDelay?: number;           // Clear delay in ms (default: 1000)
}

class LiveAnnouncer {
  constructor(config?: LiveAnnouncerConfig);
  
  // Announce a message
  announce(message: string, politeness?: Politeness): void;
  
  // Clear announcements
  clear(): void;
  
  destroy(): void;
}
```

## Events

A11yManager emits events through the Engine's EventBus:

| Event | Payload | Description |
|-------|---------|-------------|
| `a11y:select` | `{ surfaceId: string \| null }` | Selection changed |
| `a11y:activate` | `{ surfaceId: string }` | Surface activated |

## Mode Behavior

- **Canvas-Interactive mode**: Mirrors are enabled and receive focus/keyboard events
- **DOM-Interactive mode**: Mirrors are hidden and disabled (actual DOM handles a11y)

A11yManager automatically enables/disables mirrors when the Engine mode changes.

## WCAG 2.1 AA Compliance

This package helps achieve WCAG 2.1 AA compliance:

- [x] **2.1.1 Keyboard** - All functionality available via keyboard
- [x] **2.1.2 No Keyboard Trap** - Focus can always escape
- [x] **2.4.3 Focus Order** - Logical navigation order
- [x] **2.4.7 Focus Visible** - Clear focus indicators
- [x] **4.1.2 Name, Role, Value** - ARIA roles and labels

## Reduced Motion

A11yManager respects the `prefers-reduced-motion` media query:

```typescript
if (a11y.prefersReducedMotion) {
  // Skip or reduce animations
}
```

## License

MIT
