/**
 * RAFScheduler - Batched requestAnimationFrame scheduler
 * 
 * Manages the render loop and batches all frame-based updates.
 * Prevents multiple RAF calls per frame and provides delta time tracking.
 */

export type FrameCallback = (deltaTime: number, timestamp: number) => void;

interface ScheduledCallback {
  callback: FrameCallback;
  priority: number; // Higher priority runs first
  id: number;
}

/**
 * Priority levels for frame callbacks
 */
export enum FramePriority {
  /** Input handling - runs first */
  INPUT = 100,
  /** Layout updates and DOM measurements */
  LAYOUT = 75,
  /** Surface updates and GPU state preparation */
  UPDATE = 50,
  /** Rendering to GPU */
  RENDER = 25,
  /** Post-render cleanup and analytics */
  CLEANUP = 0,
}

/**
 * RAFScheduler manages the animation frame loop
 * 
 * Features:
 * - Single RAF per frame (all callbacks batched)
 * - Priority-based execution order
 * - Delta time calculation
 * - Play/pause control
 * - FPS tracking (optional)
 */
export class RAFScheduler {
  private callbacks: Map<number, ScheduledCallback> = new Map();
  private rafId: number | null = null;
  private lastTimestamp: number = 0;
  private isRunning: boolean = false;
  private nextCallbackId: number = 1;
  
  // FPS tracking
  private frameCount: number = 0;
  private fpsTimestamp: number = 0;
  private currentFPS: number = 0;
  private trackFPS: boolean = false;

  constructor(options?: { trackFPS?: boolean }) {
    this.trackFPS = options?.trackFPS ?? false;
  }

  /**
   * Add a callback to the render loop
   * @param callback - Function to call each frame
   * @param priority - Execution priority (higher = earlier)
   * @returns ID that can be used to cancel the callback
   */
  add(callback: FrameCallback, priority: number = FramePriority.UPDATE): number {
    const id = this.nextCallbackId++;
    this.callbacks.set(id, { callback, priority, id });
    
    // Sort callbacks by priority whenever we add one
    this.sortCallbacks();
    
    // Auto-start if not running
    if (!this.isRunning) {
      this.start();
    }
    
    return id;
  }

  /**
   * Remove a callback from the render loop
   * @param id - ID returned from add()
   */
  remove(id: number): void {
    this.callbacks.delete(id);
    
    // Auto-stop if no more callbacks
    if (this.callbacks.size === 0 && this.isRunning) {
      this.stop();
    }
  }

  /**
   * Start the render loop
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.fpsTimestamp = this.lastTimestamp;
    this.frameCount = 0;
    
    this.scheduleFrame();
  }

  /**
   * Stop the render loop
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Pause the render loop (can be resumed with start())
   */
  pause(): void {
    this.stop();
  }

  /**
   * Resume the render loop
   */
  resume(): void {
    this.start();
  }

  /**
   * Check if scheduler is currently running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Get current FPS (if tracking is enabled)
   */
  get fps(): number {
    return this.currentFPS;
  }

  /**
   * Get number of registered callbacks
   */
  get callbackCount(): number {
    return this.callbacks.size;
  }

  /**
   * Internal: Schedule next frame
   */
  private scheduleFrame(): void {
    this.rafId = requestAnimationFrame((timestamp) => this.onFrame(timestamp));
  }

  /**
   * Internal: Handle frame callback
   */
  private onFrame(timestamp: number): void {
    if (!this.isRunning) return;

    // Calculate delta time
    const deltaTime = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // Track FPS
    if (this.trackFPS) {
      this.frameCount++;
      const fpsElapsed = timestamp - this.fpsTimestamp;
      if (fpsElapsed >= 1000) {
        this.currentFPS = Math.round((this.frameCount * 1000) / fpsElapsed);
        this.frameCount = 0;
        this.fpsTimestamp = timestamp;
      }
    }

    // Execute callbacks in priority order
    // Note: callbacks are already sorted by priority
    for (const scheduled of this.callbacks.values()) {
      try {
        scheduled.callback(deltaTime, timestamp);
      } catch (error) {
        console.error('Error in RAF callback:', error);
      }
    }

    // Schedule next frame
    if (this.isRunning) {
      this.scheduleFrame();
    }
  }

  /**
   * Internal: Sort callbacks by priority
   */
  private sortCallbacks(): void {
    // Convert to array, sort, and rebuild map
    const sorted = Array.from(this.callbacks.values())
      .sort((a, b) => b.priority - a.priority);
    
    this.callbacks.clear();
    for (const item of sorted) {
      this.callbacks.set(item.id, item);
    }
  }

  /**
   * Execute a callback once on the next frame
   * @param callback - Function to call
   * @param priority - Execution priority
   */
  once(callback: FrameCallback, priority: number = FramePriority.UPDATE): void {
    const id = this.add((deltaTime, timestamp) => {
      this.remove(id);
      callback(deltaTime, timestamp);
    }, priority);
  }

  /**
   * Remove all callbacks and stop the scheduler
   */
  clear(): void {
    this.callbacks.clear();
    this.stop();
  }
}
