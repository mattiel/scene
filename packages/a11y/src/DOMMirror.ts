/**
 * DOMMirror - Creates accessible DOM elements that mirror canvas surfaces
 *
 * In Canvas-Interactive mode, the canvas owns pointer events but we need
 * accessible DOM elements for screen readers and keyboard navigation.
 * DOMMirror creates visually-hidden but focusable elements positioned
 * over each surface.
 */

export interface MirrorConfig {
  /** ARIA role for the mirror element (default: 'button') */
  role?: string;
  /** Accessible name (aria-label) */
  label?: string;
  /** Accessible description (aria-describedby content) */
  description?: string;
  /** Tab order (default: 0) */
  tabIndex?: number;
  /** Additional ARIA attributes */
  ariaAttributes?: Record<string, string>;
}

export interface DOMMirrorConfig {
  /** Container element for mirrors (default: document.body) */
  container?: HTMLElement;
}

interface MirrorEntry {
  element: HTMLElement;
  descriptionElement: HTMLElement | null;
  config: MirrorConfig;
}

/**
 * DOMMirror - Manages accessible DOM mirrors for canvas surfaces
 *
 * Usage:
 * ```ts
 * const mirror = new DOMMirror();
 * mirror.createMirror('card-1', { label: 'Product Card', role: 'button' });
 * mirror.updatePosition('card-1', { x: 100, y: 200, width: 300, height: 400 });
 * ```
 */
export class DOMMirror {
  private container: HTMLElement;
  private mirrors: Map<string, MirrorEntry> = new Map();
  private enabled: boolean = true;

  constructor(config: DOMMirrorConfig = {}) {
    this.container = config.container ?? document.body;
  }

  /**
   * Create a mirror element for a surface
   * @param surfaceId - The surface ID to mirror
   * @param config - Mirror configuration (role, label, etc.)
   * @returns The created mirror element
   */
  createMirror(surfaceId: string, config: MirrorConfig = {}): HTMLElement {
    // Remove existing mirror if present
    if (this.mirrors.has(surfaceId)) {
      this.removeMirror(surfaceId);
    }

    const element = document.createElement('div');
    element.dataset.sceneMirror = surfaceId;
    element.className = 'scene-mirror';

    // Apply ARIA role
    const role = config.role ?? 'button';
    element.setAttribute('role', role);

    // Apply accessible name
    if (config.label) {
      element.setAttribute('aria-label', config.label);
    }

    // Apply tabIndex
    element.tabIndex = config.tabIndex ?? 0;

    // Create description element if needed
    let descriptionElement: HTMLElement | null = null;
    if (config.description) {
      descriptionElement = document.createElement('div');
      descriptionElement.id = `scene-mirror-desc-${surfaceId}`;
      descriptionElement.textContent = config.description;
      descriptionElement.style.display = 'none';
      element.setAttribute('aria-describedby', descriptionElement.id);
      this.container.appendChild(descriptionElement);
    }

    // Apply additional ARIA attributes
    if (config.ariaAttributes) {
      for (const [key, value] of Object.entries(config.ariaAttributes)) {
        element.setAttribute(key, value);
      }
    }

    // Apply base styles (visually transparent but focusable)
    Object.assign(element.style, {
      position: 'absolute',
      background: 'transparent',
      border: 'none',
      padding: '0',
      margin: '0',
      cursor: 'pointer',
      // Show focus ring
      outlineOffset: '2px',
      // Hidden until position is set
      visibility: this.enabled ? 'visible' : 'hidden',
      pointerEvents: this.enabled ? 'auto' : 'none',
    });

    this.container.appendChild(element);
    this.mirrors.set(surfaceId, { element, descriptionElement, config });

    return element;
  }

  /**
   * Update mirror position from a surface rect
   * @param surfaceId - The surface ID
   * @param rect - The rect to position the mirror at
   */
  updatePosition(
    surfaceId: string,
    rect: { x: number; y: number; width: number; height: number }
  ): void {
    const entry = this.mirrors.get(surfaceId);
    if (!entry) return;

    const { element } = entry;
    element.style.left = `${rect.x}px`;
    element.style.top = `${rect.y}px`;
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
  }

  /**
   * Update mirror configuration
   * @param surfaceId - The surface ID
   * @param config - New configuration to apply
   */
  updateConfig(surfaceId: string, config: Partial<MirrorConfig>): void {
    const entry = this.mirrors.get(surfaceId);
    if (!entry) return;

    const { element } = entry;

    if (config.role !== undefined) {
      element.setAttribute('role', config.role);
    }

    if (config.label !== undefined) {
      if (config.label) {
        element.setAttribute('aria-label', config.label);
      } else {
        element.removeAttribute('aria-label');
      }
    }

    if (config.tabIndex !== undefined) {
      element.tabIndex = config.tabIndex;
    }

    if (config.description !== undefined) {
      // Handle description changes
      if (config.description) {
        if (entry.descriptionElement) {
          entry.descriptionElement.textContent = config.description;
        } else {
          const descElement = document.createElement('div');
          descElement.id = `scene-mirror-desc-${surfaceId}`;
          descElement.textContent = config.description;
          descElement.style.display = 'none';
          element.setAttribute('aria-describedby', descElement.id);
          this.container.appendChild(descElement);
          entry.descriptionElement = descElement;
        }
      } else if (entry.descriptionElement) {
        entry.descriptionElement.remove();
        entry.descriptionElement = null;
        element.removeAttribute('aria-describedby');
      }
    }

    if (config.ariaAttributes) {
      for (const [key, value] of Object.entries(config.ariaAttributes)) {
        element.setAttribute(key, value);
      }
    }

    // Update stored config
    Object.assign(entry.config, config);
  }

  /**
   * Remove a mirror element
   * @param surfaceId - The surface ID
   */
  removeMirror(surfaceId: string): void {
    const entry = this.mirrors.get(surfaceId);
    if (!entry) return;

    entry.element.remove();
    if (entry.descriptionElement) {
      entry.descriptionElement.remove();
    }

    this.mirrors.delete(surfaceId);
  }

  /**
   * Get a mirror element by surface ID
   * @param surfaceId - The surface ID
   * @returns The mirror element or undefined
   */
  getMirror(surfaceId: string): HTMLElement | undefined {
    return this.mirrors.get(surfaceId)?.element;
  }

  /**
   * Get all surface IDs with mirrors
   */
  getSurfaceIds(): string[] {
    return Array.from(this.mirrors.keys());
  }

  /**
   * Get the number of mirrors
   */
  get size(): number {
    return this.mirrors.size;
  }

  /**
   * Enable or disable all mirrors
   * When disabled, mirrors are hidden and non-interactive
   * @param enabled - Whether mirrors should be enabled
   */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;

    for (const entry of this.mirrors.values()) {
      entry.element.style.visibility = enabled ? 'visible' : 'hidden';
      entry.element.style.pointerEvents = enabled ? 'auto' : 'none';
      entry.element.tabIndex = enabled ? (entry.config.tabIndex ?? 0) : -1;
    }
  }

  /**
   * Check if mirrors are enabled
   */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Clear all mirrors
   */
  clear(): void {
    // Spread to array to avoid mutation during iteration
    const surfaceIds = [...this.mirrors.keys()];
    for (const surfaceId of surfaceIds) {
      this.removeMirror(surfaceId);
    }
  }

  /**
   * Destroy the mirror manager
   */
  destroy(): void {
    this.clear();
  }
}
