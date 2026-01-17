/**
 * A11yManager - High-level coordinator for accessibility features
 *
 * Ties together DOMMirror, FocusSync, and LiveAnnouncer with the Engine.
 * Automatically manages mirrors based on surfaces and interaction mode.
 */

import type { Engine, EventBus } from '@scene/core';
import { DOMMirror, type MirrorConfig } from './DOMMirror';
import { FocusSync, type NavigationAxis } from './FocusSync';
import { LiveAnnouncer, type Politeness } from './LiveAnnouncer';

/**
 * Surface registry interface (matches @scene/surfaces SurfaceRegistry)
 * Defined here to avoid circular dependency
 */
interface SurfaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Surface {
  id: string;
  rect: Readonly<SurfaceRect>;
  isGhost: boolean;
  onLayoutChange(callback: (rect: SurfaceRect) => void): () => void;
}

interface SurfaceRegistry {
  all(): Surface[];
  get(id: string): Surface | undefined;
  onAdd(callback: (surface: Surface) => void): () => void;
  onRemove(callback: (surface: Surface) => void): () => void;
}

export interface A11yManagerConfig {
  /** Surface registry to track */
  registry: SurfaceRegistry;
  /** Container element for mirrors and live regions */
  container?: HTMLElement;
  /** Default ARIA role for mirrors (default: 'button') */
  defaultRole?: string;
  /** Navigation axis for keyboard navigation (default: 'horizontal') */
  navigationAxis?: NavigationAxis;
  /** Wrap keyboard navigation at ends (default: true) */
  wrapNavigation?: boolean;
  /** Auto-create mirrors for surfaces (default: true) */
  autoCreateMirrors?: boolean;
  /** Only create mirrors for non-ghost surfaces (default: true) */
  skipGhosts?: boolean;
}

/**
 * A11yManager - Coordinates accessibility features with Scene Engine
 *
 * Usage:
 * ```ts
 * const a11y = new A11yManager(engine, { registry: surfaceRegistry });
 *
 * // Configure specific surface accessibility
 * a11y.configure('card-1', { label: 'Product Card', role: 'button' });
 *
 * // Listen for selection/activation
 * engine.on('a11y:select', ({ surfaceId }) => console.log('Selected:', surfaceId));
 * engine.on('a11y:activate', ({ surfaceId }) => console.log('Activated:', surfaceId));
 * ```
 */
export class A11yManager {
  private engine: Engine;
  private eventBus: EventBus;
  private registry: SurfaceRegistry;
  private config: Required<Omit<A11yManagerConfig, 'registry' | 'container'>> & {
    container?: HTMLElement;
  };

  // Core components
  private _mirror: DOMMirror;
  private _focus: FocusSync;
  private _announcer: LiveAnnouncer;

  // Surface configuration overrides
  private surfaceConfigs: Map<string, MirrorConfig> = new Map();

  // Cleanup functions
  private unsubscribes: (() => void)[] = [];

  // Layout change unsubscribes per surface
  private layoutUnsubscribes: Map<string, () => void> = new Map();

  // Reduced motion media query
  private reducedMotionQuery: MediaQueryList | null = null;
  private _prefersReducedMotion: boolean = false;

  constructor(engine: Engine, config: A11yManagerConfig) {
    this.engine = engine;
    this.eventBus = engine.events;
    this.registry = config.registry;

    this.config = {
      container: config.container,
      defaultRole: config.defaultRole ?? 'button',
      navigationAxis: config.navigationAxis ?? 'horizontal',
      wrapNavigation: config.wrapNavigation ?? true,
      autoCreateMirrors: config.autoCreateMirrors ?? true,
      skipGhosts: config.skipGhosts ?? true,
    };

    // Initialize components
    this._mirror = new DOMMirror({ container: this.config.container });
    this._focus = new FocusSync(this._mirror, {
      navigationAxis: this.config.navigationAxis,
      wrapNavigation: this.config.wrapNavigation,
    });
    this._announcer = new LiveAnnouncer({ container: this.config.container });

    // Set up integrations
    this.setupModeListener();
    this.setupSurfaceTracking();
    this.setupFocusIntegration();
    this.setupReducedMotion();

    // Initialize mirrors for existing surfaces
    this.initializeExistingSurfaces();
  }

  /**
   * Set up listener for interaction mode changes
   */
  private setupModeListener(): void {
    // Initial mode check
    const isCanvasMode = this.engine.mode === 'canvas-interactive';
    this._mirror.setEnabled(isCanvasMode);

    // Listen for mode changes
    const unsub = this.eventBus.on('mode:changed', ({ to }) => {
      const enabled = to === 'canvas-interactive';
      this._mirror.setEnabled(enabled);

      if (enabled) {
        this._announcer.announce('Canvas mode active. Use arrow keys to navigate.');
      }
    });
    this.unsubscribes.push(unsub);
  }

  /**
   * Set up surface registry listeners
   */
  private setupSurfaceTracking(): void {
    if (!this.config.autoCreateMirrors) return;

    // Listen for surface additions
    const addUnsub = this.registry.onAdd((surface) => {
      this.handleSurfaceAdded(surface);
    });
    this.unsubscribes.push(addUnsub);

    // Listen for surface removals
    const removeUnsub = this.registry.onRemove((surface) => {
      this.handleSurfaceRemoved(surface);
    });
    this.unsubscribes.push(removeUnsub);
  }

  /**
   * Handle a new surface being added
   */
  private handleSurfaceAdded(surface: Surface): void {
    // Skip ghost surfaces if configured
    if (this.config.skipGhosts && surface.isGhost) return;

    // Get config override or use defaults
    const config = this.surfaceConfigs.get(surface.id) ?? {
      role: this.config.defaultRole,
    };

    // Create mirror
    this._mirror.createMirror(surface.id, config);
    this._mirror.updatePosition(surface.id, surface.rect);

    // Subscribe to layout changes
    const layoutUnsub = surface.onLayoutChange((rect) => {
      this._mirror.updatePosition(surface.id, rect);
    });
    this.layoutUnsubscribes.set(surface.id, layoutUnsub);

    // Update navigation order
    this.updateNavigationOrder();
  }

  /**
   * Handle a surface being removed
   */
  private handleSurfaceRemoved(surface: Surface): void {
    // Clean up layout subscription
    const layoutUnsub = this.layoutUnsubscribes.get(surface.id);
    if (layoutUnsub) {
      layoutUnsub();
      this.layoutUnsubscribes.delete(surface.id);
    }

    // Remove mirror
    this._mirror.removeMirror(surface.id);

    // Clear selection if this surface was selected
    if (this._focus.getSelected() === surface.id) {
      this._focus.clearSelection();
    }

    // Update navigation order
    this.updateNavigationOrder();
  }

  /**
   * Initialize mirrors for surfaces that exist before A11yManager was created
   */
  private initializeExistingSurfaces(): void {
    if (!this.config.autoCreateMirrors) return;

    for (const surface of this.registry.all()) {
      this.handleSurfaceAdded(surface);
    }
  }

  /**
   * Update the navigation order based on current surfaces
   */
  private updateNavigationOrder(): void {
    const order = this.registry
      .all()
      .filter((s) => !this.config.skipGhosts || !s.isGhost)
      .map((s) => s.id);
    this._focus.setNavigationOrder(order);
  }

  /**
   * Set up focus and activation event forwarding
   */
  private setupFocusIntegration(): void {
    // Forward selection changes to engine events
    const selectUnsub = this._focus.onSelect((surfaceId) => {
      this.eventBus.emit('a11y:select', { surfaceId });

      // Announce selection
      if (surfaceId) {
        const surface = this.registry.get(surfaceId);
        const config = this.surfaceConfigs.get(surfaceId);
        const label = config?.label ?? surfaceId;

        // Calculate position in list
        const order = this._focus.getNavigationOrder();
        const index = order.indexOf(surfaceId);
        const total = order.length;

        if (surface && index >= 0) {
          this._announcer.announce(`${label}, ${index + 1} of ${total}`);
        }
      }
    });
    this.unsubscribes.push(selectUnsub);

    // Forward activation events to engine events
    const activateUnsub = this._focus.onActivate((surfaceId) => {
      this.eventBus.emit('a11y:activate', { surfaceId });

      // Announce activation
      const config = this.surfaceConfigs.get(surfaceId);
      const label = config?.label ?? surfaceId;
      this._announcer.announce(`Activated ${label}`, 'assertive');
    });
    this.unsubscribes.push(activateUnsub);
  }

  /**
   * Set up reduced motion preference tracking
   */
  private setupReducedMotion(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._prefersReducedMotion = this.reducedMotionQuery.matches;

    const handleChange = (e: MediaQueryListEvent): void => {
      this._prefersReducedMotion = e.matches;
    };

    // Use addEventListener if available (modern browsers)
    if (this.reducedMotionQuery.addEventListener) {
      this.reducedMotionQuery.addEventListener('change', handleChange);
      this.unsubscribes.push(() => {
        this.reducedMotionQuery?.removeEventListener('change', handleChange);
      });
    }
  }

  /**
   * Configure accessibility settings for a specific surface
   * @param surfaceId - The surface ID to configure
   * @param config - Mirror configuration
   */
  configure(surfaceId: string, config: MirrorConfig): void {
    this.surfaceConfigs.set(surfaceId, config);

    // Update existing mirror if present
    const existingMirror = this._mirror.getMirror(surfaceId);
    if (existingMirror) {
      this._mirror.updateConfig(surfaceId, config);
    }
  }

  /**
   * Announce a message to screen readers
   * @param message - The message to announce
   * @param politeness - The urgency level
   */
  announce(message: string, politeness?: Politeness): void {
    this._announcer.announce(message, politeness);
  }

  /**
   * Get the DOMMirror instance
   */
  get mirror(): DOMMirror {
    return this._mirror;
  }

  /**
   * Get the FocusSync instance
   */
  get focus(): FocusSync {
    return this._focus;
  }

  /**
   * Get the LiveAnnouncer instance
   */
  get announcer(): LiveAnnouncer {
    return this._announcer;
  }

  /**
   * Check if user prefers reduced motion
   */
  get prefersReducedMotion(): boolean {
    return this._prefersReducedMotion;
  }

  /**
   * Destroy the A11yManager and clean up resources
   */
  destroy(): void {
    // Clean up all subscriptions
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];

    // Clean up layout subscriptions
    for (const unsub of this.layoutUnsubscribes.values()) {
      unsub();
    }
    this.layoutUnsubscribes.clear();

    // Destroy components
    this._focus.destroy();
    this._mirror.destroy();
    this._announcer.destroy();

    // Clear config
    this.surfaceConfigs.clear();
  }
}
