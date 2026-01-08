/// <reference types="@webgpu/types" />

import { Surface, type SurfaceRect, type SurfaceOptions } from './Surface';

/**
 * GhostSurface - Factory and utilities for temporary GPU-only surfaces
 * 
 * Ghost surfaces are used during navigation transitions to maintain
 * visual continuity. They capture a snapshot of a DOM element's
 * appearance and continue rendering it on the GPU after the element
 * is removed from the DOM.
 * 
 * Key characteristics:
 * - No associated DOM element (element is null)
 * - Fixed rect (doesn't update with layout changes)
 * - Typically has a captured texture from the original element
 * - Should be cleaned up after transition completes
 */

export interface GhostSurfaceOptions extends SurfaceOptions {
  /** The rect to use for the ghost surface */
  rect: SurfaceRect;
  /** Optional: the original element (for texture capture) */
  sourceElement?: HTMLElement;
}

/**
 * Create a ghost surface from an existing surface
 * 
 * This captures the current state of a surface and creates a
 * GPU-only clone that can continue rendering after the original
 * element is removed from the DOM.
 * 
 * @param id - Unique ID for the ghost surface
 * @param source - The source surface to clone
 * @returns A new ghost surface
 */
export function createGhostFromSurface(id: string, source: Surface): Surface {
  const ghost = new Surface(id, null, {
    zIndex: source.zIndex,
    texture: source.texture ?? undefined,
  });
  
  // Copy the rect
  ghost._updateRect({ ...source.rect });
  
  // Copy motion values
  const motionProperties: Array<Parameters<Surface['set']>[0]> = [
    'x', 'y', 'scale', 'rotation', 'opacity', 'distortion'
  ];
  
  for (const prop of motionProperties) {
    ghost.set(prop, source.get(prop));
  }
  
  return ghost;
}

/**
 * Create a ghost surface from a DOM element
 * 
 * This captures the current layout and appearance of an element
 * and creates a GPU-only surface that can render after the element
 * is removed.
 * 
 * @param id - Unique ID for the ghost surface
 * @param element - The DOM element to capture
 * @param options - Additional options
 * @returns A new ghost surface
 */
export function createGhostFromElement(
  id: string,
  element: HTMLElement,
  options: Omit<GhostSurfaceOptions, 'rect'> = {}
): Surface {
  // Capture the current rect
  const domRect = element.getBoundingClientRect();
  const rect: SurfaceRect = {
    x: domRect.left,
    y: domRect.top,
    width: domRect.width,
    height: domRect.height,
  };
  
  // Get z-index if not provided
  let zIndex = options.zIndex;
  if (zIndex === undefined) {
    const computedStyle = window.getComputedStyle(element);
    const cssZIndex = parseInt(computedStyle.zIndex, 10);
    zIndex = isNaN(cssZIndex) ? 0 : cssZIndex;
  }
  
  // Create the ghost surface
  const ghost = new Surface(id, null, {
    ...options,
    zIndex,
  });
  
  // Set the rect
  ghost._updateRect(rect);
  
  return ghost;
}

/**
 * Create a custom ghost surface with explicit parameters
 * 
 * This is the most flexible way to create a ghost surface,
 * useful when you need precise control over all properties.
 * 
 * @param id - Unique ID for the ghost surface
 * @param options - Ghost surface configuration
 * @returns A new ghost surface
 */
export function createGhost(id: string, options: GhostSurfaceOptions): Surface {
  const ghost = new Surface(id, null, {
    zIndex: options.zIndex,
    texture: options.texture,
  });
  
  ghost._updateRect(options.rect);
  
  return ghost;
}

/**
 * Helper to check if a surface is a ghost
 * 
 * @param surface - The surface to check
 * @returns True if the surface is a ghost
 */
export function isGhost(surface: Surface): boolean {
  return surface.isGhost;
}

/**
 * Capture a texture from a DOM element for use in a ghost surface
 * 
 * TODO: This will be fully implemented when renderer integration is added.
 * For now, this is a placeholder that returns null.
 * 
 * The implementation will:
 * 1. Create an OffscreenCanvas matching element size
 * 2. Render the element to the canvas (using html2canvas or similar)
 * 3. Convert to GPUTexture
 * 4. Return the texture
 * 
 * @param _element - The element to capture (unused for now)
 * @returns Promise resolving to a GPUTexture, or null if capture fails
 */
export async function captureTextureFromElement(
  _element: HTMLElement
): Promise<GPUTexture | null> {
  // This will be implemented in renderer integration phase
  console.warn('captureTextureFromElement() not yet implemented');
  return null;
}

/**
 * Create a ghost surface with texture capture
 * 
 * This is a convenience function that combines createGhostFromElement
 * with texture capture.
 * 
 * @param id - Unique ID for the ghost surface
 * @param element - The element to capture
 * @param options - Additional options
 * @returns Promise resolving to a new ghost surface with captured texture
 */
export async function createGhostWithTexture(
  id: string,
  element: HTMLElement,
  options: Omit<GhostSurfaceOptions, 'rect'> = {}
): Promise<Surface> {
  // Create the ghost surface
  const ghost = createGhostFromElement(id, element, options);
  
  // Capture texture (this will be implemented later)
  const texture = await captureTextureFromElement(element);
  if (texture) {
    ghost.texture = texture;
  }
  
  return ghost;
}
