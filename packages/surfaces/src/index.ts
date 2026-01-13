/**
 * @scene/surfaces - Surface tracking and management
 * 
 * This package provides the surface system for Scene, which tracks
 * DOM elements and prepares them for GPU augmentation.
 */

export { Surface, type SurfaceRect, type SurfaceOptions, type SurfaceMotionProperty } from './Surface';
export { SurfaceRegistry } from './SurfaceRegistry';
export { LayoutTracker, type LayoutTrackerOptions } from './LayoutTracker';
export {
  createGhost,
  createGhostFromSurface,
  createGhostFromElement,
  createGhostWithTexture,
  isGhost,
  captureTextureFromElement,
  type GhostSurfaceOptions,
} from './GhostSurface';
