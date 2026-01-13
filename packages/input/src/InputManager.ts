/**
 * InputManager
 *
 * High-level input coordinator that ties together PointerManager, Inertia, and Picking.
 * Integrates with the Engine's mode system to automatically enable/disable picking.
 */

import type { Engine, EventBus } from '@scene/core';
import { PointerManager } from './PointerManager';
import type { NormalizedPointer, GestureState, PointerManagerCallbacks } from './PointerManager';
import { Inertia } from './Inertia';
import type { InertiaState, InertiaOptions } from './Inertia';
import { Picking } from './Picking';
import type { PickableRegistry, PickEvent } from './Picking';

/**
 * Intent events emitted by InputManager
 */
export interface InputIntents {
  /** Tap/click intent */
  tap: { surfaceId: string | null; x: number; y: number };
  /** Drag intent */
  drag: { surfaceId: string | null; deltaX: number; deltaY: number; totalDeltaX: number; totalDeltaY: number };
  /** Drag start intent */
  dragStart: { surfaceId: string | null; x: number; y: number };
  /** Drag end intent */
  dragEnd: { surfaceId: string | null; velocityX: number; velocityY: number };
  /** Hover intent (surface entered) */
  hoverEnter: { surfaceId: string };
  /** Hover intent (surface left) */
  hoverLeave: { surfaceId: string };
  /** Inertia update */
  inertia: InertiaState;
}

/**
 * Intent callback type
 */
export type IntentCallback<K extends keyof InputIntents> = (payload: InputIntents[K]) => void;

/**
 * InputManager configuration
 */
export interface InputManagerConfig {
  /** Target element for pointer events (default: engine canvas) */
  target?: HTMLElement;
  /** Enable picking in Canvas-Interactive mode (default: true) */
  enablePicking?: boolean;
  /** Enable inertia for drag gestures (default: true) */
  enableInertia?: boolean;
  /** Inertia options */
  inertiaOptions?: InertiaOptions;
  /** Surface registry for picking */
  registry?: PickableRegistry;
}

/**
 * Resolved config with defaults applied
 * (target and registry remain optional at runtime)
 */
interface ResolvedConfig {
  target: HTMLElement | undefined;
  enablePicking: boolean;
  enableInertia: boolean;
  inertiaOptions: InertiaOptions;
  registry: PickableRegistry | undefined;
}

/**
 * InputManager - High-level input coordinator
 */
export class InputManager {
  private eventBus: EventBus;
  private config: ResolvedConfig;
  
  // Subsystems
  private pointerManager: PointerManager | null = null;
  private inertia: Inertia;
  private picking: Picking;
  
  // Intent listeners
  private intentListeners: Map<keyof InputIntents, Set<IntentCallback<keyof InputIntents>>> = new Map();
  
  // State
  private isCanvasMode: boolean = false;
  private dragStartSurfaceId: string | null = null;
  private modeChangedUnsub: (() => void) | null = null;
  // Track whether a drag occurred in the current pointer sequence
  private dragActive: boolean = false;
  
  constructor(engine: Engine, config: InputManagerConfig = {}) {
    this.eventBus = engine.events;
    
    this.config = {
      target: config.target ?? engine.canvas ?? undefined,
      enablePicking: config.enablePicking ?? true,
      enableInertia: config.enableInertia ?? true,
      inertiaOptions: config.inertiaOptions ?? {},
      registry: config.registry,
    };
    
    // Initialize subsystems
    this.inertia = new Inertia(this.config.inertiaOptions);
    this.inertia.setCallback(this.onInertiaUpdate.bind(this));
    
    this.picking = new Picking({
      onEnter: this.onSurfaceEnter.bind(this),
      onLeave: this.onSurfaceLeave.bind(this),
    });
    
    if (this.config.registry) {
      this.picking.setRegistry(this.config.registry);
    }
    
    // Check current mode
    this.isCanvasMode = engine.mode === 'canvas-interactive';
    
    // Listen for mode changes
    this.modeChangedUnsub = this.eventBus.on('mode:changed', ({ to }) => {
      this.isCanvasMode = to === 'canvas-interactive';
    });
  }

  /**
   * Initialize the input manager
   * @param target - Optional target element (overrides config)
   */
  initialize(target?: HTMLElement): void {
    const actualTarget = target ?? this.config.target;
    if (!actualTarget) {
      throw new Error('InputManager requires a target element');
    }
    
    // Create pointer manager
    this.pointerManager = new PointerManager(
      actualTarget,
      this.createPointerCallbacks(),
      { dragThreshold: 5, useCapture: true }
    );
    
    this.pointerManager.attach();
  }

  /**
   * Set the surface registry for picking
   */
  setRegistry(registry: PickableRegistry): void {
    this.config.registry = registry;
    this.picking.setRegistry(registry);
  }

  /**
   * Subscribe to an intent
   */
  onIntent<K extends keyof InputIntents>(
    intent: K,
    callback: IntentCallback<K>
  ): () => void {
    if (!this.intentListeners.has(intent)) {
      this.intentListeners.set(intent, new Set());
    }
    
    const listeners = this.intentListeners.get(intent)!;
    listeners.add(callback as IntentCallback<keyof InputIntents>);
    
    return () => {
      listeners.delete(callback as IntentCallback<keyof InputIntents>);
    };
  }

  /**
   * Emit an intent
   */
  private emitIntent<K extends keyof InputIntents>(
    intent: K,
    payload: InputIntents[K]
  ): void {
    const listeners = this.intentListeners.get(intent);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in intent listener for "${intent}":`, error);
        }
      }
    }
  }

  /**
   * Create pointer manager callbacks
   */
  private createPointerCallbacks(): PointerManagerCallbacks {
    return {
      onPointerDown: (pointer) => {
        this.onPointerDown(pointer);
      },
      onPointerMove: (pointer) => {
        this.onPointerMove(pointer);
      },
      onPointerUp: (pointer) => {
        this.onPointerUp(pointer);
      },
      onDragStart: (gesture, pointer) => {
        this.onDragStart(gesture, pointer);
      },
      onDrag: (gesture, pointer) => {
        this.onDrag(gesture, pointer);
      },
      onDragEnd: (gesture, pointer) => {
        this.onDragEnd(gesture, pointer);
      },
    };
  }

  /**
   * Handle pointer down
   */
  private onPointerDown(pointer: NormalizedPointer): void {
    // Stop any inertia animation
    this.inertia.stop();
    
    // Determine surface once to avoid duplicate events
    let surfaceId: string | undefined;

    // Run picking if in canvas mode
    if (this.isCanvasMode && this.config.enablePicking) {
      const pickEvent = this.picking.handlePointerDown(pointer);
      
      if (pickEvent.topHit) {
        surfaceId = pickEvent.topHit.surface.id;
      }
    }

    // Emit a single down event (with surface when available)
    this.eventBus.emit('pointer:down', {
      x: pointer.x,
      y: pointer.y,
      surfaceId,
    });
  }

  /**
   * Handle pointer move
   */
  private onPointerMove(pointer: NormalizedPointer): void {
    // Emit core event
    this.eventBus.emit('pointer:move', {
      x: pointer.x,
      y: pointer.y,
      surfaceId: undefined,
    });
    
    // Run picking if in canvas mode and not dragging
    if (this.isCanvasMode && this.config.enablePicking) {
      const gesture = this.pointerManager?.getGesture();
      if (!gesture?.isDragging) {
        this.picking.handlePointerMove(pointer);
      }
    }
  }

  /**
   * Handle pointer up
   */
  private onPointerUp(pointer: NormalizedPointer): void {
    // Emit core event
    this.eventBus.emit('pointer:up', {
      x: pointer.x,
      y: pointer.y,
      surfaceId: undefined,
    });
    
    // Check for tap (only when no drag occurred in this pointer sequence)
    if (!this.dragActive) {
      // This was a tap (no drag threshold exceeded)
      let surfaceId: string | null = null;
      
      if (this.isCanvasMode && this.config.enablePicking) {
        const pickEvent = this.picking.handlePointerUp(pointer);
        surfaceId = pickEvent.topHit?.surface.id ?? null;
      }
      
      this.emitIntent('tap', {
        surfaceId,
        x: pointer.x,
        y: pointer.y,
      });
    }

    // Reset drag tracking for the next sequence
    this.dragActive = false;
  }

  /**
   * Handle drag start
   */
  private onDragStart(gesture: GestureState, _pointer: NormalizedPointer): void {
    // Track starting surface
    this.dragStartSurfaceId = null;
    this.dragActive = true;
    
    if (this.isCanvasMode && this.config.enablePicking) {
      const pickResult = this.picking.pickTop(gesture.startX, gesture.startY);
      this.dragStartSurfaceId = pickResult?.surface.id ?? null;
    }
    
    // Start inertia tracking
    if (this.config.enableInertia) {
      this.inertia.startTracking(gesture.startX, gesture.startY);
    }
    
    this.emitIntent('dragStart', {
      surfaceId: this.dragStartSurfaceId,
      x: gesture.startX,
      y: gesture.startY,
    });
  }

  /**
   * Handle drag
   */
  private onDrag(gesture: GestureState, pointer: NormalizedPointer): void {
    // Update inertia tracking
    if (this.config.enableInertia) {
      this.inertia.addSample(pointer.x, pointer.y);
    }
    
    this.emitIntent('drag', {
      surfaceId: this.dragStartSurfaceId,
      deltaX: pointer.deltaX,
      deltaY: pointer.deltaY,
      totalDeltaX: gesture.totalDeltaX,
      totalDeltaY: gesture.totalDeltaY,
    });
  }

  /**
   * Handle drag end
   */
  private onDragEnd(_gesture: GestureState, _pointer: NormalizedPointer): void {
    // Release inertia
    let velocityX = 0;
    let velocityY = 0;
    
    if (this.config.enableInertia) {
      this.inertia.release();
      const state = this.inertia.getState();
      velocityX = state.velocityX;
      velocityY = state.velocityY;
    }
    
    this.emitIntent('dragEnd', {
      surfaceId: this.dragStartSurfaceId,
      velocityX,
      velocityY,
    });
    
    // Note: dragActive is reset in onPointerUp after the tap check
    this.dragStartSurfaceId = null;
  }

  /**
   * Handle surface enter (hover)
   */
  private onSurfaceEnter(surface: { id: string }, _event: PickEvent): void {
    this.emitIntent('hoverEnter', { surfaceId: surface.id });
  }

  /**
   * Handle surface leave (hover)
   */
  private onSurfaceLeave(surface: { id: string }, _event: PickEvent): void {
    this.emitIntent('hoverLeave', { surfaceId: surface.id });
  }

  /**
   * Handle inertia update
   */
  private onInertiaUpdate(state: InertiaState): void {
    this.emitIntent('inertia', state);
  }

  /**
   * Get the PointerManager
   */
  get pointer(): PointerManager | null {
    return this.pointerManager;
  }

  /**
   * Get the Inertia instance
   */
  get inertiaSystem(): Inertia {
    return this.inertia;
  }

  /**
   * Get the Picking instance
   */
  get pickingSystem(): Picking {
    return this.picking;
  }

  /**
   * Destroy the InputManager
   */
  destroy(): void {
    // Unsubscribe from mode changes
    if (this.modeChangedUnsub) {
      this.modeChangedUnsub();
      this.modeChangedUnsub = null;
    }
    
    // Destroy subsystems
    this.pointerManager?.destroy();
    this.pointerManager = null;
    
    this.inertia.destroy();
    this.picking.destroy();
    
    // Clear listeners
    this.intentListeners.clear();
  }
}
