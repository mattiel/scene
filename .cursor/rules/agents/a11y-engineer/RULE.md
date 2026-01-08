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

## WCAG Conformance

**Target: WCAG 2.1 Level AA**

Key requirements for Scene:
- **1.4.3 Contrast** - Focus indicators must have 3:1 contrast ratio
- **2.1.1 Keyboard** - All functionality available via keyboard
- **2.4.7 Focus Visible** - Focus indicator always visible
- **2.5.1 Pointer Gestures** - Multi-point gestures have single-pointer alternatives
- **4.1.2 Name, Role, Value** - All interactive elements have accessible names

## Browser and Screen Reader Compatibility

Test with these combinations:

| Platform | Screen Reader | Browser | Priority |
|----------|--------------|---------|----------|
| macOS | VoiceOver | Safari | High |
| Windows | NVDA | Firefox | High |
| Windows | JAWS | Chrome | Medium |
| Android | TalkBack | Chrome | Medium |
| iOS | VoiceOver | Safari | Medium |

### VoiceOver Commands (macOS)

- `VO + →/←` - Navigate elements
- `VO + Space` - Activate element
- `VO + U` - Open rotor
- `VO + Shift + ↓` - Enter web area

### NVDA Commands (Windows)

- `Tab` - Navigate focusable elements
- `↑/↓` - Browse mode navigation
- `Enter/Space` - Activate element
- `NVDA + F7` - Elements list

## Screen Reader Testing Workflow

1. **Enable screen reader** and close your eyes or look away
2. **Navigate to Scene component** using Tab
3. **Verify announcements:**
   - Element role (button, listbox, etc.)
   - Accessible name (label)
   - State (selected, expanded, etc.)
4. **Navigate within Scene** using arrow keys
5. **Activate elements** using Enter/Space
6. **Listen for live region announcements** on state changes

## Reduced Motion

Respect user preference for reduced motion:

```typescript
class MotionPreference {
  static prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  
  static addListener(callback: (reduced: boolean) => void): void {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', (e) => callback(e.matches));
  }
}

// In animation code
const duration = MotionPreference.prefersReducedMotion() ? 0 : 300;
```

## Error Handling

```typescript
class A11yError extends Error {
  constructor(
    message: string,
    public readonly element?: HTMLElement,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'A11yError';
  }
}

// Validate accessible name
function validateAccessibleName(element: HTMLElement): void {
  const name = element.getAttribute('aria-label') || 
               element.getAttribute('aria-labelledby') ||
               element.textContent?.trim();
               
  if (!name) {
    console.warn('Element missing accessible name:', element);
  }
}
```

## When to Invoke

Invoke `@a11y-engineer` when:
- Creating DOM mirrors for canvas elements
- Implementing focus management and synchronization
- Adding keyboard navigation patterns
- Setting up ARIA live regions for announcements
- Testing with screen readers
- Ensuring WCAG compliance

## Testing Checklist

### Keyboard Navigation
- [ ] All interactive elements reachable via Tab
- [ ] Tab order follows logical reading order
- [ ] Arrow keys navigate between items
- [ ] Enter/Space activates items
- [ ] Escape closes/cancels where appropriate

### Visual
- [ ] Focus indicator always visible
- [ ] Focus indicator has sufficient contrast (3:1 minimum)
- [ ] Focus indicator matches canvas highlight position

### Screen Reader
- [ ] Element roles announced correctly
- [ ] Element labels announced correctly
- [ ] Selection state announced
- [ ] Live regions announce dynamic changes
- [ ] No duplicate or confusing announcements

### Motion
- [ ] Reduced motion preference respected
- [ ] Essential animations still convey meaning

### Cross-Browser
- [ ] Tested with VoiceOver + Safari
- [ ] Tested with NVDA + Firefox
- [ ] No browser-specific a11y regressions
