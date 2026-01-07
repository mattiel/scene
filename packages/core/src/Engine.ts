import { EventBus, type EventMap, type EventCallback } from './EventBus';
import { RAFScheduler, FramePriority } from './RAFScheduler';

/**
 * Interaction modes for Scene engine
 */
export enum InteractionMode {
  /** DOM handles all input, canvas is pointer-events: none */
  DOM_INTERACTIVE = 'dom-interactive',
  /** Canvas handles input, DOM is pointer-events: none */
  CANVAS_INTERACTIVE = 'canvas-interactive',
}

/**
 * Engine configuration options
 */
export interface EngineConfig {
  /** Canvas element or selector */
  canvas?: HTMLCanvasElement | string;
  /** Initial interaction mode */
  mode?: InteractionMode;
  /** Enable FPS tracking */
  trackFPS?: boolean;
  /** Auto-start render loop */
  autoStart?: boolean;
}

/**
 * Engine - Main Scene orchestrator
 * 
 * Responsibilities:
 * - Owns the render loop (RAFScheduler)
 * - Manages interaction mode switching
 * - Central event hub (EventBus)
 * - Coordinates all subsystems (renderer, surfaces, input, etc.)
 * 
 * This is the main entry point for Scene. All other packages
 * will interact with the engine to register their functionality.
 */
export class Engine {
  private _canvas: HTMLCanvasElement | null = null;
  private _mode: InteractionMode;
  private _events: EventBus;
  private _scheduler: RAFScheduler;
  private _isReady: boolean = false;
  private _resizeObserver: ResizeObserver | null = null;
  
  // Subsystem registries (will be populated by other packages)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _surfaces: Map<string, any> = new Map(); // Will be typed when surfaces package exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _renderer: any = null; // Will be typed when renderer package exists
  
  constructor(config: EngineConfig = {}) {
    this._mode = config.mode ?? InteractionMode.DOM_INTERACTIVE;
    this._events = new EventBus();
    this._scheduler = new RAFScheduler({
      trackFPS: config.trackFPS ?? false,
    });
    
    // Set up canvas if provided
    if (config.canvas) {
      this.setCanvas(config.canvas);
    }
    
    // Register core frame callback
    this._scheduler.add(
      (deltaTime, timestamp) => this.onFrame(deltaTime, timestamp),
      FramePriority.RENDER
    );
    
    // Auto-start if requested
    if (config.autoStart !== false) {
      this.start();
    }
  }

  /**
   * Set or change the canvas element
   * @param canvas - Canvas element or selector
   */
  setCanvas(canvas: HTMLCanvasElement | string): void {
    if (typeof canvas === 'string') {
      const element = document.querySelector(canvas);
      if (!element || !(element instanceof HTMLCanvasElement)) {
        throw new Error(`Canvas not found or invalid: ${canvas}`);
      }
      this._canvas = element;
    } else {
      this._canvas = canvas;
    }
    
    // Apply initial mode styling
    this.updateCanvasMode();
    
    // Set up resize observer
    this.setupResizeObserver();
  }

  /**
   * Get the canvas element
   */
  get canvas(): HTMLCanvasElement | null {
    return this._canvas;
  }

  /**
   * Get the event bus (for subscribing to events)
   */
  get events(): EventBus {
    return this._events;
  }

  /**
   * Get the scheduler (for registering frame callbacks)
   */
  get scheduler(): RAFScheduler {
    return this._scheduler;
  }

  /**
   * Get current interaction mode
   */
  get mode(): InteractionMode {
    return this._mode;
  }

  /**
   * Set interaction mode
   */
  set mode(mode: InteractionMode) {
    if (mode === this._mode) return;
    
    const from = this._mode;
    this._mode = mode;
    
    this.updateCanvasMode();
    this._events.emit('mode:changed', { from, to: mode });
  }

  /**
   * Check if engine is ready (renderer initialized)
   */
  get isReady(): boolean {
    return this._isReady;
  }

  /**
   * Get current FPS
   */
  get fps(): number {
    return this._scheduler.fps;
  }

  /**
   * Check if render loop is running
   */
  get isRunning(): boolean {
    return this._scheduler.running;
  }

  /**
   * Start the render loop
   */
  start(): void {
    this._scheduler.start();
  }

  /**
   * Stop the render loop
   */
  stop(): void {
    this._scheduler.stop();
  }

  /**
   * Pause the render loop
   */
  pause(): void {
    this._scheduler.pause();
  }

  /**
   * Resume the render loop
   */
  resume(): void {
    this._scheduler.resume();
  }

  /**
   * Subscribe to an event
   * Convenience wrapper around events.on()
   */
  on<K extends keyof EventMap>(
    event: K | '*',
    callback: EventCallback<EventMap[K]>
  ): () => void {
    return this._events.on(event, callback);
  }

  /**
   * Subscribe to an event once
   * Convenience wrapper around events.once()
   */
  once<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>
  ): () => void {
    return this._events.once(event, callback);
  }

  /**
   * Unsubscribe from an event
   * Convenience wrapper around events.off()
   */
  off<K extends keyof EventMap>(
    event: K | '*',
    callback?: EventCallback<EventMap[K]>
  ): void {
    this._events.off(event, callback);
  }

  /**
   * Internal: Main frame callback
   */
  private onFrame(deltaTime: number, timestamp: number): void {
    // Emit render event for other systems to hook into
    this._events.emit('render', { deltaTime, timestamp });
    
    // Actual rendering will be handled by renderer package
    // when it's added in Phase 2
  }

  /**
   * Internal: Update canvas pointer-events based on mode
   */
  private updateCanvasMode(): void {
    if (!this._canvas) return;
    
    if (this._mode === InteractionMode.DOM_INTERACTIVE) {
      this._canvas.style.pointerEvents = 'none';
    } else {
      this._canvas.style.pointerEvents = 'auto';
    }
  }

  /**
   * Internal: Set up resize observer for canvas
   */
  private setupResizeObserver(): void {
    if (!this._canvas) return;
    
    // Disconnect existing observer to prevent multiple observers
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
    
    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this._events.emit('resize', { width, height });
      }
    });
    
    this._resizeObserver.observe(this._canvas);
  }

  /**
   * Mark engine as ready (called by renderer when GPU is initialized)
   * @internal
   */
  _setReady(): void {
    if (this._isReady) return;
    this._isReady = true;
    this._events.emit('ready');
  }

  /**
   * Register renderer (called by renderer package)
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _setRenderer(renderer: any): void {
    this._renderer = renderer;
  }

  /**
   * Get renderer
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get _getRenderer(): any {
    return this._renderer;
  }

  /**
   * Register a surface (called by surfaces package)
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _registerSurface(id: string, surface: any): void {
    this._surfaces.set(id, surface);
    this._events.emit('surface:added', { id });
  }

  /**
   * Unregister a surface
   * @internal
   */
  _unregisterSurface(id: string): void {
    if (this._surfaces.has(id)) {
      this._surfaces.delete(id);
      this._events.emit('surface:removed', { id });
    }
  }

  /**
   * Get a surface by ID
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _getSurface(id: string): any {
    return this._surfaces.get(id);
  }

  /**
   * Get all surfaces
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get _getSurfaces(): Map<string, any> {
    return this._surfaces;
  }

  /**
   * Destroy the engine and clean up resources
   */
  destroy(): void {
    // Disconnect resize observer
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    
    this._scheduler.clear();
    this._events.clear();
    this._surfaces.clear();
    this._renderer = null;
    this._canvas = null;
    this._isReady = false;
  }
}
