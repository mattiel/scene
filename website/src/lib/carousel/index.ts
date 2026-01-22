/**
 * Carousel - 3D carousel implementation using Scene primitives
 */

// Data and types
export {
  CARD_DATA,
  CARD_THEMES,
  BASE_CONFIG,
  type CardData,
  type CardTexture,
  type CarouselConfig,
} from './data';

// Utilities and hooks
export {
  calculateSnapPoints,
  calculateBounds,
  findCenterIndex,
  useResponsiveConfig,
  lerp,
  clamp,
} from './utils';

// Canvas texture rendering
export { CardTextureRenderer, type CardTextureCache } from './CardTextureRenderer';

// UI components
export { LoadingOverlay, type LoadingOverlayProps } from './LoadingOverlay';

// GPU rendering
export {
  FabricWaveMaterial,
  GLOBAL_UNIFORM_SCHEMA,
  type FabricWaveMaterialConfig,
} from './FabricWaveMaterial';

export {
  FabricWaveRenderer,
  createFabricWaveRenderer,
  type FabricCardTexture,
  type FabricCardState,
  type FabricGlobalState,
  type FabricWaveRendererConfig,
} from './FabricWaveRenderer';
