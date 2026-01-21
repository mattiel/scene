/**
 * Carousel
 * 
 * Item-based carousel controller built on Scrollable.
 * Manages item layout, center detection, expand/collapse states, and item interactions.
 * 
 * This is a USER-LEVEL implementation showing how to build a carousel pattern
 * using Scene's primitives (Scrollable controller).
 */

import { Scrollable } from '@scene/controllers';
import type { ScrollableConfig, ScrollableEvents } from '@scene/controllers';

/**
 * Carousel item interface
 */
export interface CarouselItem {
  /** Unique identifier */
  id: string;
  /** Optional label for accessibility */
  label?: string;
  /** Optional metadata */
  data?: unknown;
}

/**
 * Computed item state for rendering
 */
export interface CarouselItemState {
  /** Item reference */
  item: CarouselItem;
  /** Index in items array */
  index: number;
  /** X position relative to center */
  x: number;
  /** Distance from center (absolute) */
  distance: number;
  /** Whether this is the center item */
  isCenter: boolean;
  /** Whether this item is expanded */
  isExpanded: boolean;
  /** Normalized position (-1 to 1, where 0 is center) */
  normalizedPosition: number;
}

/**
 * Carousel events
 */
export interface CarouselEvents {
  /** Center item changed */
  centerChange: { item: CarouselItem; index: number; previousItem: CarouselItem | null };
  /** Offset changed (forwarded from Scrollable) */
  offsetChange: { offset: number; velocity: number };
  /** Item tapped */
  itemTap: { item: CarouselItem; index: number; x: number; y: number };
  /** Item expanded */
  itemExpand: { item: CarouselItem; index: number };
  /** Item collapsed */
  itemCollapse: { item: CarouselItem | null; index: number };
  /** Items layout computed */
  layoutComputed: { items: CarouselItemState[] };
  /** Snapping started */
  snapStart: { from: number; to: number; item: CarouselItem };
  /** Snapping completed */
  snapEnd: { offset: number; item: CarouselItem };
}

/**
 * Event callback type
 */
export type CarouselCallback<K extends keyof CarouselEvents> = (
  payload: CarouselEvents[K]
) => void;

/**
 * Carousel configuration
 */
export interface CarouselConfig {
  /** Items in the carousel */
  items?: CarouselItem[];
  /** Spacing between items in pixels (default: 320) */
  itemSpacing?: number;
  /** Auto-center snap on release (default: true) */
  centerSnap?: boolean;
  /** Wheel sensitivity (default: 0.025) */
  wheelSensitivity?: number;
  /** Drag sensitivity (default: 1) */
  dragSensitivity?: number;
  /** Friction for inertia (default: 0.92) */
  friction?: number;
  /** Reduced motion mode */
  reducedMotion?: boolean;
  /** Initial center index (default: middle item) */
  initialIndex?: number;
  /** Allow expand/collapse on tap (default: true) */
  allowExpand?: boolean;
  /** Collapse on scroll/wheel (default: true) */
  collapseOnScroll?: boolean;
}

/**
 * Resolved config with defaults
 */
interface ResolvedConfig {
  items: CarouselItem[];
  itemSpacing: number;
  centerSnap: boolean;
  wheelSensitivity: number;
  dragSensitivity: number;
  friction: number;
  reducedMotion: boolean;
  initialIndex: number;
  allowExpand: boolean;
  collapseOnScroll: boolean;
}

const DEFAULT_CONFIG: ResolvedConfig = {
  items: [],
  itemSpacing: 320,
  centerSnap: true,
  wheelSensitivity: 0.025,
  dragSensitivity: 1,
  friction: 0.92,
  reducedMotion: false,
  initialIndex: -1, // -1 means calculate middle
  allowExpand: true,
  collapseOnScroll: true,
};

/**
 * Carousel - Item-based carousel controller
 */
export class Carousel {
  private config: ResolvedConfig;
  private scrollable: Scrollable;
  private listeners: Map<keyof CarouselEvents, Set<CarouselCallback<keyof CarouselEvents>>> = new Map();
  
  // State
  private _centerIndex: number = 0;
  private _expandedIndex: number = -1;
  private _expandProgress: number = 0;
  private _expandTarget: number = 0;
  
  // Expand animation
  private expandAnimationId: number | null = null;
  
  // Cleanup
  private unsubscribers: (() => void)[] = [];

  constructor(config: CarouselConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Calculate initial index if not specified
    if (this.config.initialIndex < 0) {
      this.config.initialIndex = Math.floor((this.config.items.length - 1) / 2);
    }
    
    // Calculate initial offset to center the initial item
    const initialOffset = this.indexToOffset(this.config.initialIndex);
    
    // Create Scrollable with snap points at item positions
    const scrollableConfig: ScrollableConfig = {
      initialOffset,
      wheelSensitivity: this.config.wheelSensitivity,
      dragSensitivity: this.config.dragSensitivity,
      friction: this.config.friction,
      reducedMotion: this.config.reducedMotion,
      autoSnap: this.config.centerSnap,
      snapPoints: this.calculateSnapPoints(),
      ...this.calculateBounds(),
    };
    
    this.scrollable = new Scrollable(scrollableConfig);
    
    // Subscribe to Scrollable events
    this.unsubscribers.push(
      this.scrollable.on('change', this.onScrollableChange.bind(this)),
      this.scrollable.on('snapStart', this.onSnapStart.bind(this)),
      this.scrollable.on('snapEnd', this.onSnapEnd.bind(this))
    );
    
    // Initialize center
    this._centerIndex = this.findCenterIndex();
  }

  // ============================================
  // Getters
  // ============================================

  /** Current offset */
  get offset(): number {
    return this.scrollable.offset;
  }

  /** Current velocity */
  get velocity(): number {
    return this.scrollable.velocity;
  }

  /** Whether currently dragging */
  get isDragging(): boolean {
    return this.scrollable.isDragging;
  }

  /** Current center item index */
  get centerIndex(): number {
    return this._centerIndex;
  }

  /** Current center item */
  get centerItem(): CarouselItem | null {
    return this.config.items[this._centerIndex] ?? null;
  }

  /** Currently expanded item index (-1 if none) */
  get expandedIndex(): number {
    return this._expandedIndex;
  }

  /** Currently expanded item (null if none) */
  get expandedItem(): CarouselItem | null {
    return this._expandedIndex >= 0 ? this.config.items[this._expandedIndex] : null;
  }

  /** Current expand progress (0-1) */
  get expandProgress(): number {
    return this._expandProgress;
  }

  /** Whether an item is expanded */
  get hasExpanded(): boolean {
    return this._expandedIndex >= 0;
  }

  /** Number of items */
  get itemCount(): number {
    return this.config.items.length;
  }

  /** All items */
  get items(): readonly CarouselItem[] {
    return this.config.items;
  }

  /** The underlying Scrollable instance */
  get scrollableController(): Scrollable {
    return this.scrollable;
  }

  // ============================================
  // Configuration
  // ============================================

  /**
   * Set items
   */
  setItems(items: CarouselItem[]): void {
    this.config.items = [...items];
    
    // Recalculate snap points and bounds
    this.scrollable.setSnapPoints(this.calculateSnapPoints());
    const bounds = this.calculateBounds();
    this.scrollable.setBounds(bounds.minOffset!, bounds.maxOffset!);
    
    // Update center
    this._centerIndex = this.findCenterIndex();
  }

  /**
   * Set item spacing
   */
  setItemSpacing(spacing: number): void {
    this.config.itemSpacing = spacing;
    
    // Recalculate snap points and bounds
    this.scrollable.setSnapPoints(this.calculateSnapPoints());
    const bounds = this.calculateBounds();
    this.scrollable.setBounds(bounds.minOffset!, bounds.maxOffset!);
    
    // Snap to maintain current center
    if (this._centerIndex >= 0) {
      this.scrollToIndex(this._centerIndex);
    }
  }

  // ============================================
  // Navigation
  // ============================================

  /**
   * Scroll to a specific item by index
   */
  scrollToIndex(index: number, animated: boolean = true): void {
    const targetOffset = this.indexToOffset(index);
    
    if (animated) {
      this.scrollable.snapTo(targetOffset);
    } else {
      this.scrollable.setOffset(targetOffset);
    }
  }

  /**
   * Scroll to a specific item by ID
   */
  scrollToItem(itemId: string, animated: boolean = true): void {
    const index = this.config.items.findIndex(item => item.id === itemId);
    if (index >= 0) {
      this.scrollToIndex(index, animated);
    }
  }

  /**
   * Go to next item
   */
  next(animated: boolean = true): void {
    const nextIndex = Math.min(this._centerIndex + 1, this.config.items.length - 1);
    this.scrollToIndex(nextIndex, animated);
  }

  /**
   * Go to previous item
   */
  previous(animated: boolean = true): void {
    const prevIndex = Math.max(this._centerIndex - 1, 0);
    this.scrollToIndex(prevIndex, animated);
  }

  // ============================================
  // Expand/Collapse
  // ============================================

  /**
   * Expand an item by index
   */
  expandItem(index: number): void {
    if (!this.config.allowExpand) return;
    if (index < 0 || index >= this.config.items.length) return;
    
    // If already expanded, toggle off
    if (this._expandedIndex === index) {
      this.collapseItem();
      return;
    }
    
    // Snap to the item first
    this.scrollToIndex(index);
    
    this._expandedIndex = index;
    this._expandTarget = 1;
    
    this.emit('itemExpand', {
      item: this.config.items[index],
      index,
    });
    
    this.startExpandAnimation();
  }

  /**
   * Expand an item by ID
   */
  expandItemById(itemId: string): void {
    const index = this.config.items.findIndex(item => item.id === itemId);
    if (index >= 0) {
      this.expandItem(index);
    }
  }

  /**
   * Collapse expanded item
   */
  collapseItem(): void {
    if (this._expandedIndex < 0) return;
    
    const previousIndex = this._expandedIndex;
    const previousItem = this.config.items[previousIndex] ?? null;
    
    this._expandedIndex = -1;
    this._expandTarget = 0;
    
    this.emit('itemCollapse', {
      item: previousItem,
      index: previousIndex,
    });
    
    this.startExpandAnimation();
  }

  // ============================================
  // Input Handlers
  // ============================================

  /**
   * Handle drag start
   */
  handleDragStart(): void {
    if (this.config.collapseOnScroll && this._expandedIndex >= 0) {
      this.collapseItem();
    }
    this.scrollable.handleDragStart();
  }

  /**
   * Handle drag movement
   */
  handleDrag(delta: number): void {
    this.scrollable.handleDrag(delta);
  }

  /**
   * Handle drag end with optional inertia velocity
   */
  handleDragEnd(velocityX?: number): void {
    this.scrollable.handleDragEnd(velocityX);
  }

  /**
   * Handle wheel input
   */
  handleWheel(delta: number): void {
    if (this.config.collapseOnScroll && this._expandedIndex >= 0) {
      this.collapseItem();
      return;
    }
    this.scrollable.handleWheel(delta);
  }

  /**
   * Handle tap on an item
   */
  handleItemTap(itemId: string, x: number, y: number): void {
    const index = this.config.items.findIndex(item => item.id === itemId);
    if (index < 0) return;
    
    const item = this.config.items[index];
    
    this.emit('itemTap', { item, index, x, y });
    
    // Expand if allowed
    if (this.config.allowExpand) {
      this.expandItem(index);
    }
  }

  // ============================================
  // Layout Computation
  // ============================================

  /**
   * Compute current state for all items
   */
  computeItemStates(): CarouselItemState[] {
    const { items, itemSpacing } = this.config;
    const offset = this.scrollable.offset;
    const midIndex = (items.length - 1) / 2;
    
    const states: CarouselItemState[] = items.map((item, index) => {
      const baseX = (index - midIndex) * itemSpacing;
      const x = baseX + offset;
      const distance = Math.abs(x);
      
      // Normalized position: -1 (far left) to 1 (far right), 0 = center
      const maxDistance = midIndex * itemSpacing;
      const normalizedPosition = maxDistance > 0 ? x / maxDistance : 0;
      
      return {
        item,
        index,
        x,
        distance,
        isCenter: index === this._centerIndex,
        isExpanded: index === this._expandedIndex,
        normalizedPosition: Math.max(-1, Math.min(1, normalizedPosition)),
      };
    });
    
    this.emit('layoutComputed', { items: states });
    
    return states;
  }

  /**
   * Get item state by index
   */
  getItemState(index: number): CarouselItemState | null {
    if (index < 0 || index >= this.config.items.length) return null;
    
    const states = this.computeItemStates();
    return states[index];
  }

  /**
   * Get item state by ID
   */
  getItemStateById(itemId: string): CarouselItemState | null {
    const index = this.config.items.findIndex(item => item.id === itemId);
    return index >= 0 ? this.getItemState(index) : null;
  }

  // ============================================
  // Events
  // ============================================

  /**
   * Subscribe to an event
   */
  on<K extends keyof CarouselEvents>(
    event: K,
    callback: CarouselCallback<K>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    const listeners = this.listeners.get(event)!;
    listeners.add(callback as CarouselCallback<keyof CarouselEvents>);
    
    return () => {
      listeners.delete(callback as CarouselCallback<keyof CarouselEvents>);
    };
  }

  private emit<K extends keyof CarouselEvents>(
    event: K,
    payload: CarouselEvents[K]
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const callback of [...listeners]) {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in Carousel "${event}" listener:`, error);
        }
      }
    }
  }

  // ============================================
  // Internal Event Handlers
  // ============================================

  private onScrollableChange(event: ScrollableEvents['change']): void {
    // Forward offset change
    this.emit('offsetChange', {
      offset: event.offset,
      velocity: event.velocity,
    });
    
    // Update center index
    const newCenterIndex = this.findCenterIndex();
    if (newCenterIndex !== this._centerIndex) {
      const previousItem = this.config.items[this._centerIndex] ?? null;
      this._centerIndex = newCenterIndex;
      
      this.emit('centerChange', {
        item: this.config.items[newCenterIndex],
        index: newCenterIndex,
        previousItem,
      });
    }
  }

  private onSnapStart(event: ScrollableEvents['snapStart']): void {
    const targetIndex = this.offsetToIndex(event.to);
    const item = this.config.items[targetIndex];
    
    if (item) {
      this.emit('snapStart', {
        from: event.from,
        to: event.to,
        item,
      });
    }
  }

  private onSnapEnd(event: ScrollableEvents['snapEnd']): void {
    const item = this.config.items[this._centerIndex];
    
    if (item) {
      this.emit('snapEnd', {
        offset: event.offset,
        item,
      });
    }
  }

  // ============================================
  // Expand Animation
  // ============================================

  private startExpandAnimation(): void {
    if (this.expandAnimationId !== null) return;
    
    this.expandAnimationId = requestAnimationFrame(this.animateExpand);
  }

  private animateExpand = (): void => {
    
    // Lerp toward target
    const lerpFactor = this.config.reducedMotion ? 0.15 : 0.1;
    this._expandProgress = this.lerp(this._expandProgress, this._expandTarget, lerpFactor);
    
    // Check if close enough to target
    if (Math.abs(this._expandProgress - this._expandTarget) < 0.001) {
      this._expandProgress = this._expandTarget;
      this.expandAnimationId = null;
      return;
    }
    
    this.expandAnimationId = requestAnimationFrame(this.animateExpand);
  };

  // ============================================
  // Utilities
  // ============================================

  private calculateSnapPoints(): number[] {
    const { items, itemSpacing } = this.config;
    if (items.length === 0) return [];
    
    const midIndex = (items.length - 1) / 2;
    return items.map((_, index) => -(index - midIndex) * itemSpacing);
  }

  private calculateBounds(): { minOffset: number; maxOffset: number } {
    const { items, itemSpacing } = this.config;
    if (items.length === 0) {
      return { minOffset: 0, maxOffset: 0 };
    }
    
    const midIndex = (items.length - 1) / 2;
    const minOffset = -(items.length - 1 - midIndex) * itemSpacing;
    const maxOffset = midIndex * itemSpacing;
    
    return { minOffset, maxOffset };
  }

  private indexToOffset(index: number): number {
    const { items, itemSpacing } = this.config;
    const midIndex = (items.length - 1) / 2;
    return -(index - midIndex) * itemSpacing;
  }

  private offsetToIndex(offset: number): number {
    const { items, itemSpacing } = this.config;
    const midIndex = (items.length - 1) / 2;
    const index = midIndex - offset / itemSpacing;
    return Math.round(index);
  }

  private findCenterIndex(): number {
    const { items, itemSpacing } = this.config;
    if (items.length === 0) return 0;
    
    const offset = this.scrollable.offset;
    const midIndex = (items.length - 1) / 2;
    
    // Find item closest to center (x = 0)
    let closestIndex = 0;
    let closestDistance = Infinity;
    
    items.forEach((_, index) => {
      const baseX = (index - midIndex) * itemSpacing;
      const x = baseX + offset;
      const distance = Math.abs(x);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    
    return closestIndex;
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Destroy the Carousel instance
   */
  destroy(): void {
    // Cancel animation
    if (this.expandAnimationId !== null) {
      cancelAnimationFrame(this.expandAnimationId);
      this.expandAnimationId = null;
    }
    
    // Unsubscribe from Scrollable
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    
    // Destroy Scrollable
    this.scrollable.destroy();
    
    // Clear listeners
    this.listeners.clear();
  }
}
