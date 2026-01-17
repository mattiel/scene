/**
 * LiveAnnouncer - ARIA live region management for screen reader announcements
 *
 * Creates and manages an ARIA live region element for announcing state changes
 * to screen readers. Supports polite and assertive announcements.
 */

export type Politeness = 'polite' | 'assertive';

export interface LiveAnnouncerConfig {
  /** Container element for the live region (default: document.body) */
  container?: HTMLElement;
  /** Default politeness level (default: 'polite') */
  defaultPoliteness?: Politeness;
  /** Delay before clearing announcement in ms (default: 1000) */
  clearDelay?: number;
}

/**
 * LiveAnnouncer - Manages ARIA live regions for screen reader announcements
 *
 * Usage:
 * ```ts
 * const announcer = new LiveAnnouncer();
 * announcer.announce('Item selected');
 * announcer.announce('Error occurred', 'assertive');
 * ```
 */
export class LiveAnnouncer {
  private politeRegion: HTMLElement | null = null;
  private assertiveRegion: HTMLElement | null = null;
  private container: HTMLElement;
  private defaultPoliteness: Politeness;
  private clearDelay: number;
  private clearTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(config: LiveAnnouncerConfig = {}) {
    this.container = config.container ?? document.body;
    this.defaultPoliteness = config.defaultPoliteness ?? 'polite';
    this.clearDelay = config.clearDelay ?? 1000;

    this.createRegions();
  }

  /**
   * Create the ARIA live region elements
   */
  private createRegions(): void {
    // Create polite region
    this.politeRegion = this.createRegion('polite');
    this.container.appendChild(this.politeRegion);

    // Create assertive region
    this.assertiveRegion = this.createRegion('assertive');
    this.container.appendChild(this.assertiveRegion);
  }

  /**
   * Create a single live region element
   */
  private createRegion(politeness: Politeness): HTMLElement {
    const region = document.createElement('div');
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', politeness);
    region.setAttribute('aria-atomic', 'true');

    // Visually hidden but accessible to screen readers
    Object.assign(region.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0',
    });

    // Add identifying class for debugging
    region.className = `scene-live-region scene-live-region--${politeness}`;

    return region;
  }

  /**
   * Announce a message to screen readers
   * @param message - The message to announce
   * @param politeness - The urgency level ('polite' or 'assertive')
   */
  announce(message: string, politeness?: Politeness): void {
    const level = politeness ?? this.defaultPoliteness;
    const region = level === 'assertive' ? this.assertiveRegion : this.politeRegion;

    if (!region) return;

    // Clear any pending timeout
    if (this.clearTimeoutId !== null) {
      clearTimeout(this.clearTimeoutId);
      this.clearTimeoutId = null;
    }

    // Clear and re-set to trigger announcement (needed for repeated messages)
    region.textContent = '';

    // Use requestAnimationFrame to ensure the clear is processed first
    requestAnimationFrame(() => {
      if (region) {
        region.textContent = message;
      }

      // Schedule clearing after delay
      this.clearTimeoutId = setTimeout(() => {
        this.clear();
      }, this.clearDelay);
    });
  }

  /**
   * Clear all announcements
   */
  clear(): void {
    if (this.clearTimeoutId !== null) {
      clearTimeout(this.clearTimeoutId);
      this.clearTimeoutId = null;
    }

    if (this.politeRegion) {
      this.politeRegion.textContent = '';
    }
    if (this.assertiveRegion) {
      this.assertiveRegion.textContent = '';
    }
  }

  /**
   * Destroy the announcer and remove DOM elements
   */
  destroy(): void {
    this.clear();

    if (this.politeRegion) {
      this.politeRegion.remove();
      this.politeRegion = null;
    }

    if (this.assertiveRegion) {
      this.assertiveRegion.remove();
      this.assertiveRegion = null;
    }
  }
}
