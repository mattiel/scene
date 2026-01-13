/**
 * Inertia
 *
 * Provides momentum and deceleration for drag gestures.
 * Calculates velocity from recent movement and applies friction.
 */

/**
 * Velocity sample for tracking
 */
interface VelocitySample {
  x: number;
  y: number;
  timestamp: number;
}

/**
 * Inertia state
 */
export interface InertiaState {
  /** Whether inertia animation is active */
  isActive: boolean;
  /** Current X position */
  x: number;
  /** Current Y position */
  y: number;
  /** Current X velocity (px/ms) */
  velocityX: number;
  /** Current Y velocity (px/ms) */
  velocityY: number;
}

/**
 * Inertia callback
 */
export type InertiaCallback = (state: InertiaState) => void;

/**
 * Inertia configuration options
 */
export interface InertiaOptions {
  /** Friction coefficient (0-1, lower = more friction, default: 0.92) */
  friction?: number;
  /** Minimum velocity to continue animation (default: 0.1 px/ms) */
  minVelocity?: number;
  /** Number of samples to use for velocity calculation (default: 5) */
  sampleCount?: number;
  /** Maximum age of samples in ms (default: 100) */
  sampleMaxAge?: number;
  /** Optional bounds for the motion */
  bounds?: {
    minX?: number;
    maxX?: number;
    minY?: number;
    maxY?: number;
  };
  /** Bounce coefficient when hitting bounds (0-1, default: 0.5) */
  bounce?: number;
}

const DEFAULT_OPTIONS: Required<InertiaOptions> = {
  friction: 0.92,
  minVelocity: 0.1,
  sampleCount: 5,
  sampleMaxAge: 100,
  bounds: {},
  bounce: 0.5,
};

/**
 * Inertia - Momentum and deceleration system
 */
export class Inertia {
  private options: Required<InertiaOptions>;
  private callback: InertiaCallback | null = null;
  
  // Velocity tracking
  private samples: VelocitySample[] = [];
  
  // Current state
  private x: number = 0;
  private y: number = 0;
  private velocityX: number = 0;
  private velocityY: number = 0;
  
  // Animation state
  private isActive: boolean = false;
  private animationId: number | null = null;
  private lastTime: number = 0;

  constructor(options: InertiaOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    if (options.bounds) {
      this.options.bounds = { ...DEFAULT_OPTIONS.bounds, ...options.bounds };
    }
  }

  /**
   * Set the callback for inertia updates
   */
  setCallback(callback: InertiaCallback): void {
    this.callback = callback;
  }

  /**
   * Update options
   */
  setOptions(options: Partial<InertiaOptions>): void {
    Object.assign(this.options, options);
    if (options.bounds) {
      this.options.bounds = { ...this.options.bounds, ...options.bounds };
    }
  }

  /**
   * Set bounds
   */
  setBounds(bounds: InertiaOptions['bounds']): void {
    this.options.bounds = { ...this.options.bounds, ...bounds };
  }

  /**
   * Get current state
   */
  getState(): InertiaState {
    return {
      isActive: this.isActive,
      x: this.x,
      y: this.y,
      velocityX: this.velocityX,
      velocityY: this.velocityY,
    };
  }

  /**
   * Start tracking (call at drag start)
   */
  startTracking(x: number, y: number): void {
    this.stop();
    this.samples = [];
    this.x = x;
    this.y = y;
    this.velocityX = 0;
    this.velocityY = 0;
    
    this.addSample(x, y);
  }

  /**
   * Add a position sample (call during drag)
   */
  addSample(x: number, y: number): void {
    const now = performance.now();
    
    this.x = x;
    this.y = y;
    
    this.samples.push({ x, y, timestamp: now });
    
    // Remove old samples
    const cutoff = now - this.options.sampleMaxAge;
    while (this.samples.length > this.options.sampleCount || 
           (this.samples.length > 1 && this.samples[0].timestamp < cutoff)) {
      this.samples.shift();
    }
  }

  /**
   * Calculate velocity from samples
   */
  private calculateVelocity(): { vx: number; vy: number } {
    if (this.samples.length < 2) {
      return { vx: 0, vy: 0 };
    }
    
    const now = performance.now();
    const cutoff = now - this.options.sampleMaxAge;
    
    // Filter to recent samples
    const recent = this.samples.filter(s => s.timestamp >= cutoff);
    if (recent.length < 2) {
      return { vx: 0, vy: 0 };
    }
    
    // Calculate weighted average velocity
    // More recent samples have higher weight
    let totalWeight = 0;
    let vx = 0;
    let vy = 0;
    
    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];
      const dt = curr.timestamp - prev.timestamp;
      
      if (dt > 0) {
        const weight = i / recent.length; // Later samples have higher weight
        const sampleVx = (curr.x - prev.x) / dt;
        const sampleVy = (curr.y - prev.y) / dt;
        
        vx += sampleVx * weight;
        vy += sampleVy * weight;
        totalWeight += weight;
      }
    }
    
    if (totalWeight > 0) {
      vx /= totalWeight;
      vy /= totalWeight;
    }
    
    return { vx, vy };
  }

  /**
   * Release and start inertia animation (call at drag end)
   */
  release(): void {
    // Cancel any existing animation to prevent orphaned RAF callbacks
    this.stop();
    
    const { vx, vy } = this.calculateVelocity();
    
    this.velocityX = vx;
    this.velocityY = vy;
    
    // Check if we have enough velocity to animate
    // Note: We preserve velocityX/Y even if below threshold so consumers
    // can read the actual drag velocity via getState()
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed < this.options.minVelocity) {
      // Don't call stop() here - it would zero out the velocity values
      // that consumers need. Just don't start the animation.
      return;
    }
    
    this.isActive = true;
    this.lastTime = performance.now();
    this.samples = [];
    
    // Schedule first frame asynchronously so release() returns before any callbacks fire.
    // This ensures dragEnd is emitted before inertia updates begin.
    this.animationId = requestAnimationFrame(this.animate);
  }

  /**
   * Stop the inertia animation
   */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    this.isActive = false;
    this.velocityX = 0;
    this.velocityY = 0;
  }

  /**
   * Set position directly (useful for constraints)
   */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * Animation loop
   */
  private animate = (): void => {
    const now = performance.now();
    const dt = now - this.lastTime;
    this.lastTime = now;
    
    // Apply velocity
    this.x += this.velocityX * dt;
    this.y += this.velocityY * dt;
    
    // Apply friction (time-normalized to ensure consistent physics across refresh rates)
    // Normalize to 60Hz frame time (16.67ms) so friction behaves the same at any refresh rate
    const normalizedFriction = Math.pow(this.options.friction, dt / 16.67);
    this.velocityX *= normalizedFriction;
    this.velocityY *= normalizedFriction;
    
    // Apply bounds
    this.applyBounds();
    
    // Emit callback
    this.callback?.(this.getState());
    
    // Check if we should stop
    const speed = Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);
    if (speed < this.options.minVelocity) {
      this.stop();
      this.callback?.(this.getState());
      return;
    }
    
    // Continue animation
    this.animationId = requestAnimationFrame(this.animate);
  };

  /**
   * Apply bounds constraints with optional bounce
   */
  private applyBounds(): void {
    const { bounds, bounce } = this.options;
    
    if (bounds.minX !== undefined && this.x < bounds.minX) {
      this.x = bounds.minX;
      this.velocityX = -this.velocityX * bounce;
    }
    
    if (bounds.maxX !== undefined && this.x > bounds.maxX) {
      this.x = bounds.maxX;
      this.velocityX = -this.velocityX * bounce;
    }
    
    if (bounds.minY !== undefined && this.y < bounds.minY) {
      this.y = bounds.minY;
      this.velocityY = -this.velocityY * bounce;
    }
    
    if (bounds.maxY !== undefined && this.y > bounds.maxY) {
      this.y = bounds.maxY;
      this.velocityY = -this.velocityY * bounce;
    }
  }

  /**
   * Destroy the Inertia instance
   */
  destroy(): void {
    this.stop();
    this.callback = null;
    this.samples = [];
  }
}
