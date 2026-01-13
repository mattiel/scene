/**
 * PointerManager
 *
 * Normalizes pointer events (mouse, touch, pen) into a unified interface.
 * Handles pointer capture for drag operations.
 */

/**
 * Normalized pointer state
 */
export interface NormalizedPointer {
  /** Unique pointer ID */
  id: number;
  /** X position relative to target */
  x: number;
  /** Y position relative to target */
  y: number;
  /** X position in viewport coordinates */
  clientX: number;
  /** Y position in viewport coordinates */
  clientY: number;
  /** Delta X since last event */
  deltaX: number;
  /** Delta Y since last event */
  deltaY: number;
  /** Pointer type: mouse, touch, or pen */
  type: 'mouse' | 'touch' | 'pen';
  /** Pressure (0-1, 0 for mouse) */
  pressure: number;
  /** Whether primary button/touch is pressed */
  isPrimary: boolean;
  /** Timestamp of the event */
  timestamp: number;
}

/**
 * Gesture state for drag operations
 */
export interface GestureState {
  /** Whether a drag is in progress */
  isDragging: boolean;
  /** Starting X position */
  startX: number;
  /** Starting Y position */
  startY: number;
  /** Total delta X since drag start */
  totalDeltaX: number;
  /** Total delta Y since drag start */
  totalDeltaY: number;
  /** Drag start timestamp */
  startTime: number;
  /** Primary pointer ID for this gesture */
  pointerId: number;
}

/**
 * Event callbacks for PointerManager
 */
export interface PointerManagerCallbacks {
  /** Called on pointer down */
  onPointerDown?: (pointer: NormalizedPointer) => void;
  /** Called on pointer move */
  onPointerMove?: (pointer: NormalizedPointer) => void;
  /** Called on pointer up */
  onPointerUp?: (pointer: NormalizedPointer) => void;
  /** Called on pointer cancel */
  onPointerCancel?: (pointer: NormalizedPointer) => void;
  /** Called when pointer leaves the target element (no button pressed) */
  onPointerLeave?: () => void;
  /** Called when drag starts */
  onDragStart?: (gesture: GestureState, pointer: NormalizedPointer) => void;
  /** Called during drag */
  onDrag?: (gesture: GestureState, pointer: NormalizedPointer) => void;
  /** Called when drag ends */
  onDragEnd?: (gesture: GestureState, pointer: NormalizedPointer) => void;
}

/**
 * Configuration options for PointerManager
 */
export interface PointerManagerOptions {
  /** Minimum distance to trigger drag (default: 5px) */
  dragThreshold?: number;
  /** Whether to use pointer capture (default: true) */
  useCapture?: boolean;
  /** Target element for relative coordinates (default: target) */
  coordinateTarget?: HTMLElement;
}

const DEFAULT_OPTIONS: Required<PointerManagerOptions> = {
  dragThreshold: 5,
  useCapture: true,
  coordinateTarget: null as unknown as HTMLElement,
};

/**
 * PointerManager - Unified pointer event handling
 */
export class PointerManager {
  private target: HTMLElement;
  private options: Required<PointerManagerOptions>;
  private callbacks: PointerManagerCallbacks;
  
  // Active pointers
  private pointers: Map<number, NormalizedPointer> = new Map();
  private previousPointers: Map<number, { x: number; y: number }> = new Map();
  
  // Gesture tracking
  private gesture: GestureState | null = null;
  private pendingGesture: { pointerId: number; x: number; y: number; time: number } | null = null;
  
  // Event handlers (bound for cleanup)
  private handlePointerDown: (e: PointerEvent) => void;
  private handlePointerMove: (e: PointerEvent) => void;
  private handlePointerUp: (e: PointerEvent) => void;
  private handlePointerCancel: (e: PointerEvent) => void;
  private handlePointerLeave: (e: PointerEvent) => void;
  
  // Attached state
  private attached: boolean = false;
  
  // Original touchAction value (for restoration on detach)
  private originalTouchAction: string = '';

  constructor(
    target: HTMLElement,
    callbacks: PointerManagerCallbacks = {},
    options: PointerManagerOptions = {}
  ) {
    this.target = target;
    this.callbacks = callbacks;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      coordinateTarget: options.coordinateTarget ?? target,
    };
    
    // Bind handlers
    this.handlePointerDown = this.onPointerDown.bind(this);
    this.handlePointerMove = this.onPointerMove.bind(this);
    this.handlePointerUp = this.onPointerUp.bind(this);
    this.handlePointerCancel = this.onPointerCancel.bind(this);
    this.handlePointerLeave = this.onPointerLeave.bind(this);
  }

  /**
   * Attach event listeners to the target
   */
  attach(): void {
    if (this.attached) return;
    
    this.target.addEventListener('pointerdown', this.handlePointerDown);
    this.target.addEventListener('pointermove', this.handlePointerMove);
    this.target.addEventListener('pointerup', this.handlePointerUp);
    this.target.addEventListener('pointercancel', this.handlePointerCancel);
    this.target.addEventListener('pointerleave', this.handlePointerLeave);
    
    // Prevent default touch actions for smoother interaction
    this.originalTouchAction = this.target.style.touchAction;
    this.target.style.touchAction = 'none';
    
    this.attached = true;
  }

  /**
   * Detach event listeners from the target
   */
  detach(): void {
    if (!this.attached) return;
    
    this.target.removeEventListener('pointerdown', this.handlePointerDown);
    this.target.removeEventListener('pointermove', this.handlePointerMove);
    this.target.removeEventListener('pointerup', this.handlePointerUp);
    this.target.removeEventListener('pointercancel', this.handlePointerCancel);
    this.target.removeEventListener('pointerleave', this.handlePointerLeave);
    
    // Release any captured pointers
    for (const pointerId of this.pointers.keys()) {
      try {
        this.target.releasePointerCapture(pointerId);
      } catch {
        // Pointer may already be released
      }
    }
    
    // Restore original touchAction
    this.target.style.touchAction = this.originalTouchAction;
    
    // Reset state
    this.pointers.clear();
    this.previousPointers.clear();
    this.gesture = null;
    this.pendingGesture = null;
    
    this.attached = false;
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: Partial<PointerManagerCallbacks>): void {
    Object.assign(this.callbacks, callbacks);
  }

  /**
   * Get active pointer count
   */
  get pointerCount(): number {
    return this.pointers.size;
  }

  /**
   * Get all active pointers
   */
  getPointers(): NormalizedPointer[] {
    return Array.from(this.pointers.values());
  }

  /**
   * Get a specific pointer by ID
   */
  getPointer(id: number): NormalizedPointer | undefined {
    return this.pointers.get(id);
  }

  /**
   * Get current gesture state
   */
  getGesture(): GestureState | null {
    return this.gesture;
  }

  /**
   * Normalize a PointerEvent into our unified format
   */
  private normalizePointer(e: PointerEvent): NormalizedPointer {
    const rect = this.options.coordinateTarget.getBoundingClientRect();
    const prev = this.previousPointers.get(e.pointerId);
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    return {
      id: e.pointerId,
      x,
      y,
      clientX: e.clientX,
      clientY: e.clientY,
      deltaX: prev ? x - prev.x : 0,
      deltaY: prev ? y - prev.y : 0,
      type: e.pointerType as 'mouse' | 'touch' | 'pen',
      pressure: e.pressure,
      isPrimary: e.isPrimary,
      timestamp: e.timeStamp,
    };
  }

  /**
   * Handle pointer down event
   */
  private onPointerDown(e: PointerEvent): void {
    const pointer = this.normalizePointer(e);
    
    // Store pointer
    this.pointers.set(pointer.id, pointer);
    this.previousPointers.set(pointer.id, { x: pointer.x, y: pointer.y });
    
    // Set pointer capture for reliable tracking
    if (this.options.useCapture) {
      this.target.setPointerCapture(pointer.id);
    }
    
    // Start pending gesture (will become actual drag if threshold exceeded)
    if (!this.gesture && pointer.isPrimary) {
      this.pendingGesture = {
        pointerId: pointer.id,
        x: pointer.x,
        y: pointer.y,
        time: pointer.timestamp,
      };
    }
    
    this.callbacks.onPointerDown?.(pointer);
  }

  /**
   * Handle pointer move event
   */
  private onPointerMove(e: PointerEvent): void {
    const pointer = this.normalizePointer(e);
    const isTracked = this.pointers.has(e.pointerId);
    
    // For tracked pointers (button pressed), update stored state
    if (isTracked) {
      // Update stored pointer
      this.pointers.set(pointer.id, pointer);
      
      // Check if we should start a drag
      let dragJustStarted = false;
      if (this.pendingGesture && pointer.id === this.pendingGesture.pointerId) {
        const dx = pointer.x - this.pendingGesture.x;
        const dy = pointer.y - this.pendingGesture.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance >= this.options.dragThreshold) {
          // Start the drag
          this.gesture = {
            isDragging: true,
            startX: this.pendingGesture.x,
            startY: this.pendingGesture.y,
            totalDeltaX: dx,
            totalDeltaY: dy,
            startTime: this.pendingGesture.time,
            pointerId: pointer.id,
          };
          this.pendingGesture = null;
          dragJustStarted = true;
          
          this.callbacks.onDragStart?.(this.gesture, pointer);
        }
      }
      
      // Update gesture if active (skip if drag just started to avoid duplicate event)
      if (this.gesture && pointer.id === this.gesture.pointerId && !dragJustStarted) {
        this.gesture.totalDeltaX = pointer.x - this.gesture.startX;
        this.gesture.totalDeltaY = pointer.y - this.gesture.startY;
        
        this.callbacks.onDrag?.(this.gesture, pointer);
      }
    }
    
    // Update previous position for delta calculation (for both hover and tracked)
    this.previousPointers.set(pointer.id, { x: pointer.x, y: pointer.y });
    
    // Always invoke callback - needed for hover tracking (picking)
    this.callbacks.onPointerMove?.(pointer);
  }

  /**
   * Handle pointer up event
   */
  private onPointerUp(e: PointerEvent): void {
    const pointer = this.normalizePointer(e);
    
    // End gesture if this pointer started it
    if (this.gesture && pointer.id === this.gesture.pointerId) {
      this.gesture.isDragging = false;
      this.callbacks.onDragEnd?.(this.gesture, pointer);
      this.gesture = null;
    }
    
    // Clear pending gesture if this pointer started it
    if (this.pendingGesture && pointer.id === this.pendingGesture.pointerId) {
      this.pendingGesture = null;
    }
    
    // Release pointer capture
    if (this.options.useCapture) {
      try {
        this.target.releasePointerCapture(pointer.id);
      } catch {
        // Pointer may already be released
      }
    }
    
    // Remove pointer
    this.pointers.delete(pointer.id);
    this.previousPointers.delete(pointer.id);
    
    this.callbacks.onPointerUp?.(pointer);
  }

  /**
   * Handle pointer cancel event
   */
  private onPointerCancel(e: PointerEvent): void {
    const pointer = this.normalizePointer(e);
    
    // End gesture if this pointer started it
    if (this.gesture && pointer.id === this.gesture.pointerId) {
      this.gesture.isDragging = false;
      this.callbacks.onDragEnd?.(this.gesture, pointer);
      this.gesture = null;
    }
    
    // Clear pending gesture if this pointer started it
    if (this.pendingGesture && pointer.id === this.pendingGesture.pointerId) {
      this.pendingGesture = null;
    }
    
    // Remove pointer
    this.pointers.delete(pointer.id);
    this.previousPointers.delete(pointer.id);
    
    this.callbacks.onPointerCancel?.(pointer);
  }

  /**
   * Handle pointer leave event
   * Only fires when no buttons are pressed (hover leave, not drag leave)
   */
  private onPointerLeave(e: PointerEvent): void {
    // Only handle leave when no buttons are pressed
    // During drag, pointer capture keeps events flowing even outside element
    if (e.buttons === 0 && this.pointers.size === 0) {
      this.previousPointers.delete(e.pointerId);
      this.callbacks.onPointerLeave?.();
    }
  }

  /**
   * Destroy the PointerManager and clean up resources
   */
  destroy(): void {
    this.detach();
  }
}
