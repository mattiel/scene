/**
 * InputVisualizer
 *
 * Debug overlay for visualizing input events.
 * Shows touch points, gesture state, and event history.
 */

import type { NormalizedPointer } from './PointerManager';
import type { MultiTouchState } from './MultiTouch';
import type { GestureEvent } from './GestureRecognizer';

/**
 * Visualizer configuration
 */
export interface InputVisualizerOptions {
  /** Show touch points (default: true) */
  showTouchPoints?: boolean;
  /** Show touch trails (default: true) */
  showTrails?: boolean;
  /** Show multi-touch info (scale, rotation) (default: true) */
  showMultiTouchInfo?: boolean;
  /** Show gesture labels (default: true) */
  showGestureLabels?: boolean;
  /** Show event log panel (default: false) */
  showEventLog?: boolean;
  /** Touch point color (default: 'rgba(65, 105, 225, 0.7)') */
  touchPointColor?: string;
  /** Trail color (default: 'rgba(65, 105, 225, 0.3)') */
  trailColor?: string;
  /** Touch point radius in px (default: 20) */
  touchPointRadius?: number;
  /** Trail length in points (default: 50) */
  trailLength?: number;
  /** Event log max entries (default: 20) */
  eventLogMaxEntries?: number;
  /** Z-index for overlay (default: 999999) */
  zIndex?: number;
}

const DEFAULT_OPTIONS: Required<InputVisualizerOptions> = {
  showTouchPoints: true,
  showTrails: true,
  showMultiTouchInfo: true,
  showGestureLabels: true,
  showEventLog: false,
  touchPointColor: 'rgba(65, 105, 225, 0.7)',
  trailColor: 'rgba(65, 105, 225, 0.3)',
  touchPointRadius: 20,
  trailLength: 50,
  eventLogMaxEntries: 20,
  zIndex: 999999,
};

/**
 * Trail point
 */
interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
}

/**
 * Active pointer visualization
 */
interface PointerViz {
  id: number;
  x: number;
  y: number;
  pressure: number;
  type: string;
  trail: TrailPoint[];
}

/**
 * Event log entry
 */
interface EventLogEntry {
  time: number;
  type: string;
  details: string;
}

/**
 * InputVisualizer - Debug overlay for input events
 */
export class InputVisualizer {
  private options: Required<InputVisualizerOptions>;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private logPanel: HTMLDivElement | null = null;
  
  // State
  private pointers: Map<number, PointerViz> = new Map();
  private multiTouchState: MultiTouchState | null = null;
  private lastGesture: GestureEvent | null = null;
  private gestureTimeout: ReturnType<typeof setTimeout> | null = null;
  private eventLog: EventLogEntry[] = [];
  
  // Animation
  private animationId: number | null = null;
  private isAttached: boolean = false;

  constructor(options: InputVisualizerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Attach the visualizer to the document
   */
  attach(): void {
    if (this.isAttached) return;
    
    // Create canvas overlay
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: ${this.options.zIndex};
    `;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    this.ctx = this.canvas.getContext('2d');
    document.body.appendChild(this.canvas);
    
    // Create event log panel if enabled
    if (this.options.showEventLog) {
      this.createLogPanel();
    }
    
    // Handle resize
    window.addEventListener('resize', this.handleResize);
    
    // Start render loop
    this.isAttached = true;
    this.startRenderLoop();
  }

  /**
   * Detach the visualizer from the document
   */
  detach(): void {
    if (!this.isAttached) return;
    
    // Stop render loop
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Remove canvas
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    
    // Remove log panel
    if (this.logPanel && this.logPanel.parentNode) {
      this.logPanel.parentNode.removeChild(this.logPanel);
    }
    this.logPanel = null;
    
    // Remove event listener
    window.removeEventListener('resize', this.handleResize);
    
    // Clear state
    this.pointers.clear();
    this.multiTouchState = null;
    this.lastGesture = null;
    this.eventLog = [];
    
    this.isAttached = false;
  }

  /**
   * Update options
   */
  setOptions(options: Partial<InputVisualizerOptions>): void {
    Object.assign(this.options, options);
    
    // Toggle log panel if needed
    if (this.isAttached) {
      if (this.options.showEventLog && !this.logPanel) {
        this.createLogPanel();
      } else if (!this.options.showEventLog && this.logPanel) {
        if (this.logPanel.parentNode) {
          this.logPanel.parentNode.removeChild(this.logPanel);
        }
        this.logPanel = null;
      }
    }
  }

  /**
   * Handle pointer down
   */
  handlePointerDown(pointer: NormalizedPointer): void {
    const viz: PointerViz = {
      id: pointer.id,
      x: pointer.clientX,
      y: pointer.clientY,
      pressure: pointer.pressure,
      type: pointer.type,
      trail: [{ x: pointer.clientX, y: pointer.clientY, timestamp: pointer.timestamp }],
    };
    
    this.pointers.set(pointer.id, viz);
    this.logEvent('down', `id:${pointer.id} ${pointer.type} (${Math.round(pointer.clientX)}, ${Math.round(pointer.clientY)})`);
  }

  /**
   * Handle pointer move
   */
  handlePointerMove(pointer: NormalizedPointer): void {
    const viz = this.pointers.get(pointer.id);
    if (!viz) return;
    
    viz.x = pointer.clientX;
    viz.y = pointer.clientY;
    viz.pressure = pointer.pressure;
    
    // Add trail point
    viz.trail.push({ x: pointer.clientX, y: pointer.clientY, timestamp: pointer.timestamp });
    
    // Trim trail
    while (viz.trail.length > this.options.trailLength) {
      viz.trail.shift();
    }
  }

  /**
   * Handle pointer up
   */
  handlePointerUp(pointer: NormalizedPointer): void {
    this.pointers.delete(pointer.id);
    this.logEvent('up', `id:${pointer.id} (${Math.round(pointer.clientX)}, ${Math.round(pointer.clientY)})`);
  }

  /**
   * Handle pointer cancel
   */
  handlePointerCancel(pointer: NormalizedPointer): void {
    this.pointers.delete(pointer.id);
    this.logEvent('cancel', `id:${pointer.id}`);
  }

  /**
   * Update multi-touch state
   */
  updateMultiTouch(state: MultiTouchState | null): void {
    this.multiTouchState = state;
  }

  /**
   * Show recognized gesture
   */
  showGesture(event: GestureEvent): void {
    this.lastGesture = event;
    this.logEvent('gesture', `${event.type}${event.type === 'swipe' ? ` ${(event as { direction: string }).direction}` : ''}`);
    
    // Clear after 1 second
    if (this.gestureTimeout) {
      clearTimeout(this.gestureTimeout);
    }
    this.gestureTimeout = setTimeout(() => {
      this.lastGesture = null;
      this.gestureTimeout = null;
    }, 1000);
  }

  /**
   * Log an event
   */
  private logEvent(type: string, details: string): void {
    this.eventLog.push({
      time: performance.now(),
      type,
      details,
    });
    
    // Trim log
    while (this.eventLog.length > this.options.eventLogMaxEntries) {
      this.eventLog.shift();
    }
    
    // Update log panel
    this.updateLogPanel();
  }

  /**
   * Create log panel
   */
  private createLogPanel(): void {
    this.logPanel = document.createElement('div');
    this.logPanel.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      width: 300px;
      max-height: 300px;
      overflow-y: auto;
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      font-family: monospace;
      font-size: 11px;
      padding: 8px;
      border-radius: 4px;
      pointer-events: auto;
      z-index: ${this.options.zIndex + 1};
    `;
    document.body.appendChild(this.logPanel);
    this.updateLogPanel();
  }

  /**
   * Update log panel content
   */
  private updateLogPanel(): void {
    if (!this.logPanel) return;
    
    const lines = this.eventLog.map(entry => {
      const timeStr = (entry.time % 100000).toFixed(0).padStart(5, '0');
      return `<div><span style="color:#888">${timeStr}</span> <span style="color:#4af">${entry.type.padEnd(8)}</span> ${entry.details}</div>`;
    });
    
    this.logPanel.innerHTML = lines.join('');
    this.logPanel.scrollTop = this.logPanel.scrollHeight;
  }

  /**
   * Handle window resize
   */
  private handleResize = (): void => {
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  };

  /**
   * Start render loop
   */
  private startRenderLoop(): void {
    const render = () => {
      this.render();
      this.animationId = requestAnimationFrame(render);
    };
    this.animationId = requestAnimationFrame(render);
  }

  /**
   * Render visualization
   */
  private render(): void {
    if (!this.ctx || !this.canvas) return;
    
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // Clear
    ctx.clearRect(0, 0, width, height);
    
    // Draw trails
    if (this.options.showTrails) {
      for (const viz of this.pointers.values()) {
        this.drawTrail(ctx, viz);
      }
    }
    
    // Draw touch points
    if (this.options.showTouchPoints) {
      for (const viz of this.pointers.values()) {
        this.drawTouchPoint(ctx, viz);
      }
    }
    
    // Draw multi-touch info
    if (this.options.showMultiTouchInfo && this.multiTouchState?.isActive) {
      this.drawMultiTouchInfo(ctx, this.multiTouchState);
    }
    
    // Draw gesture label
    if (this.options.showGestureLabels && this.lastGesture) {
      this.drawGestureLabel(ctx, this.lastGesture);
    }
  }

  /**
   * Draw a touch point
   */
  private drawTouchPoint(ctx: CanvasRenderingContext2D, viz: PointerViz): void {
    const radius = this.options.touchPointRadius;
    
    // Outer circle
    ctx.beginPath();
    ctx.arc(viz.x, viz.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = this.options.touchPointColor;
    ctx.fill();
    
    // Pressure indicator (inner circle)
    if (viz.pressure > 0) {
      const pressureRadius = radius * viz.pressure;
      ctx.beginPath();
      ctx.arc(viz.x, viz.y, pressureRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fill();
    }
    
    // Pointer ID label
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(viz.id.toString(), viz.x, viz.y);
    
    // Type indicator
    const typeColors: Record<string, string> = {
      mouse: '#4CAF50',
      touch: '#2196F3',
      pen: '#9C27B0',
    };
    ctx.beginPath();
    ctx.arc(viz.x, viz.y - radius - 5, 3, 0, Math.PI * 2);
    ctx.fillStyle = typeColors[viz.type] ?? '#888';
    ctx.fill();
  }

  /**
   * Draw a trail
   */
  private drawTrail(ctx: CanvasRenderingContext2D, viz: PointerViz): void {
    if (viz.trail.length < 2) return;
    
    ctx.beginPath();
    ctx.moveTo(viz.trail[0].x, viz.trail[0].y);
    
    for (let i = 1; i < viz.trail.length; i++) {
      ctx.lineTo(viz.trail[i].x, viz.trail[i].y);
    }
    
    ctx.strokeStyle = this.options.trailColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  /**
   * Draw multi-touch info
   */
  private drawMultiTouchInfo(ctx: CanvasRenderingContext2D, state: MultiTouchState): void {
    const { center, scale, rotation } = state;
    
    // Draw center point
    ctx.beginPath();
    ctx.arc(center.x, center.y, 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#FF9800';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw rotation indicator
    const rotationLength = 40;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(
      center.x + Math.cos(rotation) * rotationLength,
      center.y + Math.sin(rotation) * rotationLength
    );
    ctx.strokeStyle = '#FF9800';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw info text
    const info = [
      `Scale: ${scale.toFixed(2)}`,
      `Rotation: ${(rotation * 180 / Math.PI).toFixed(1)}°`,
      `Touches: ${state.touchCount}`,
    ];
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(center.x + 20, center.y - 30, 120, 50);
    
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    info.forEach((line, i) => {
      ctx.fillText(line, center.x + 25, center.y - 25 + i * 15);
    });
  }

  /**
   * Draw gesture label
   */
  private drawGestureLabel(ctx: CanvasRenderingContext2D, gesture: GestureEvent): void {
    let label = gesture.name;
    if (gesture.type === 'swipe') {
      label = `swipe ${(gesture as { direction: string }).direction}`;
    }
    
    const x = gesture.endX;
    const y = gesture.endY - 30;
    
    // Background
    ctx.font = 'bold 14px sans-serif';
    const metrics = ctx.measureText(label);
    const padding = 6;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.roundRect(
      x - metrics.width / 2 - padding,
      y - 10 - padding,
      metrics.width + padding * 2,
      20 + padding * 2,
      4
    );
    ctx.fill();
    
    // Text
    ctx.fillStyle = '#4CAF50';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  }

  /**
   * Get attached state
   */
  get attached(): boolean {
    return this.isAttached;
  }

  /**
   * Destroy the visualizer
   */
  destroy(): void {
    this.detach();
    if (this.gestureTimeout) {
      clearTimeout(this.gestureTimeout);
    }
  }
}
