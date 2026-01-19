/**
 * FocusSync - Synchronizes focus and selection between mirrors and Scene
 *
 * Handles keyboard navigation (arrow keys, Tab, Enter, Space) and keeps
 * the DOM focus state synchronized with Scene's selection state.
 */

import type { DOMMirror } from './DOMMirror';

export type NavigationAxis = 'horizontal' | 'vertical' | 'both';

export interface FocusSyncConfig {
  /** Wrap navigation at ends (default: true) */
  wrapNavigation?: boolean;
  /** Navigation axis for arrow keys (default: 'horizontal') */
  navigationAxis?: NavigationAxis;
}

type SelectCallback = (surfaceId: string | null) => void;
type ActivateCallback = (surfaceId: string) => void;

/**
 * FocusSync - Manages focus and keyboard navigation for mirrors
 *
 * Usage:
 * ```ts
 * const focusSync = new FocusSync(mirror, { navigationAxis: 'horizontal' });
 * focusSync.onSelect((surfaceId) => console.log('Selected:', surfaceId));
 * focusSync.onActivate((surfaceId) => console.log('Activated:', surfaceId));
 * ```
 */
export class FocusSync {
  private mirror: DOMMirror;
  private wrapNavigation: boolean;
  private navigationAxis: NavigationAxis;
  private selectedId: string | null = null;

  private selectCallbacks: Set<SelectCallback> = new Set();
  private activateCallbacks: Set<ActivateCallback> = new Set();

  // Ordered list of surface IDs for navigation
  private navigationOrder: string[] = [];

  // Event listeners that need cleanup
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private focusHandler: ((e: FocusEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(mirror: DOMMirror, config: FocusSyncConfig = {}) {
    this.mirror = mirror;
    this.wrapNavigation = config.wrapNavigation ?? true;
    this.navigationAxis = config.navigationAxis ?? 'horizontal';

    this.setupEventListeners();
  }

  /**
   * Set up global keyboard and focus event listeners
   */
  private setupEventListeners(): void {
    // Keyboard navigation handler
    this.keydownHandler = (e: KeyboardEvent) => {
      // Only handle if a mirror has focus
      const target = e.target as HTMLElement;
      if (!target.dataset.sceneMirror) return;

      this.handleKeydown(e);
    };

    // Focus tracking handler
    this.focusHandler = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const surfaceId = target.dataset?.sceneMirror;
      if (surfaceId) {
        this.setSelectedInternal(surfaceId, false);
      }
    };

    // Click/activation handler
    this.clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const surfaceId = target.dataset?.sceneMirror;
      if (surfaceId) {
        this.emitActivate(surfaceId);
      }
    };

    document.addEventListener('keydown', this.keydownHandler);
    document.addEventListener('focusin', this.focusHandler);
    document.addEventListener('click', this.clickHandler);
  }

  /**
   * Handle keyboard events for navigation and activation
   */
  private handleKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowLeft':
        if (this.navigationAxis === 'horizontal' || this.navigationAxis === 'both') {
          e.preventDefault();
          this.selectPrevious();
        }
        break;

      case 'ArrowRight':
        if (this.navigationAxis === 'horizontal' || this.navigationAxis === 'both') {
          e.preventDefault();
          this.selectNext();
        }
        break;

      case 'ArrowUp':
        if (this.navigationAxis === 'vertical' || this.navigationAxis === 'both') {
          e.preventDefault();
          this.selectPrevious();
        }
        break;

      case 'ArrowDown':
        if (this.navigationAxis === 'vertical' || this.navigationAxis === 'both') {
          e.preventDefault();
          this.selectNext();
        }
        break;

      case 'Enter':
      case ' ': // Space
        e.preventDefault();
        this.activate();
        break;

      case 'Home':
        e.preventDefault();
        this.selectFirst();
        break;

      case 'End':
        e.preventDefault();
        this.selectLast();
        break;
    }
  }

  /**
   * Set the navigation order of surfaces
   * This determines the order for arrow key navigation
   * @param surfaceIds - Array of surface IDs in navigation order
   */
  setNavigationOrder(surfaceIds: string[]): void {
    this.navigationOrder = [...surfaceIds];
  }

  /**
   * Get current navigation order
   */
  getNavigationOrder(): string[] {
    // If no explicit order set, use mirror order
    if (this.navigationOrder.length === 0) {
      return this.mirror.getSurfaceIds();
    }
    return [...this.navigationOrder];
  }

  /**
   * Set current selection (programmatic)
   * @param surfaceId - The surface ID to select, or null to clear
   */
  select(surfaceId: string | null): void {
    this.setSelectedInternal(surfaceId, true);
  }

  /**
   * Internal selection handler
   */
  private setSelectedInternal(surfaceId: string | null, moveFocus: boolean): void {
    if (surfaceId === this.selectedId) return;

    this.selectedId = surfaceId;

    // Move DOM focus to the mirror
    if (moveFocus && surfaceId) {
      const element = this.mirror.getMirror(surfaceId);
      if (element && document.activeElement !== element) {
        element.focus();
      }
    }

    // Emit selection event
    this.emitSelect(surfaceId);
  }

  /**
   * Get current selection
   */
  getSelected(): string | null {
    return this.selectedId;
  }

  /**
   * Navigate to next surface
   */
  selectNext(): void {
    const order = this.getNavigationOrder();
    if (order.length === 0) return;

    const currentIndex = this.selectedId ? order.indexOf(this.selectedId) : -1;
    let nextIndex = currentIndex + 1;

    if (nextIndex >= order.length) {
      nextIndex = this.wrapNavigation ? 0 : order.length - 1;
    }

    this.select(order[nextIndex]);
  }

  /**
   * Navigate to previous surface
   */
  selectPrevious(): void {
    const order = this.getNavigationOrder();
    if (order.length === 0) return;

    const currentIndex = this.selectedId ? order.indexOf(this.selectedId) : order.length;
    let prevIndex = currentIndex - 1;

    if (prevIndex < 0) {
      prevIndex = this.wrapNavigation ? order.length - 1 : 0;
    }

    this.select(order[prevIndex]);
  }

  /**
   * Navigate to first surface
   */
  selectFirst(): void {
    const order = this.getNavigationOrder();
    if (order.length > 0) {
      this.select(order[0]);
    }
  }

  /**
   * Navigate to last surface
   */
  selectLast(): void {
    const order = this.getNavigationOrder();
    if (order.length > 0) {
      this.select(order[order.length - 1]);
    }
  }

  /**
   * Activate current selection (Enter/Space equivalent)
   */
  activate(): void {
    if (this.selectedId) {
      this.emitActivate(this.selectedId);
    }
  }

  /**
   * Subscribe to selection changes
   * @param callback - Called when selection changes
   * @returns Unsubscribe function
   */
  onSelect(callback: SelectCallback): () => void {
    this.selectCallbacks.add(callback);
    return () => {
      this.selectCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to activation events
   * @param callback - Called when a surface is activated
   * @returns Unsubscribe function
   */
  onActivate(callback: ActivateCallback): () => void {
    this.activateCallbacks.add(callback);
    return () => {
      this.activateCallbacks.delete(callback);
    };
  }

  /**
   * Emit selection change to subscribers
   */
  private emitSelect(surfaceId: string | null): void {
    for (const callback of this.selectCallbacks) {
      try {
        callback(surfaceId);
      } catch (error) {
        console.error('Error in FocusSync select callback:', error);
      }
    }
  }

  /**
   * Emit activation to subscribers
   */
  private emitActivate(surfaceId: string): void {
    for (const callback of this.activateCallbacks) {
      try {
        callback(surfaceId);
      } catch (error) {
        console.error('Error in FocusSync activate callback:', error);
      }
    }
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.select(null);
  }

  /**
   * Destroy the focus sync and clean up event listeners
   */
  destroy(): void {
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    if (this.focusHandler) {
      document.removeEventListener('focusin', this.focusHandler);
      this.focusHandler = null;
    }

    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }

    this.selectCallbacks.clear();
    this.activateCallbacks.clear();
    this.navigationOrder = [];
    this.selectedId = null;
  }
}
