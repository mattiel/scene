/**
 * Carousel - User-level implementation
 * 
 * This folder contains a complete carousel implementation showing how to build
 * interactive 3D carousels using Scene's primitives:
 * 
 * - Carousel: Controller built on @scene/controllers Scrollable
 * - CarouselRenderer: WebGPU renderer using @scene/renderer primitives
 * - useCarousel: React hook for declarative carousel control
 * 
 * This is an EXAMPLE of what users can build with Scene, not a framework component.
 */

// Controller
export {
  Carousel,
  type CarouselConfig,
  type CarouselEvents,
  type CarouselCallback,
  type CarouselItem,
  type CarouselItemState,
} from './Carousel';

// Renderer
export {
  CarouselRenderer,
  type CarouselCardTexture,
  type CarouselCardState,
  type CarouselGlobalState,
  type CarouselRendererOptions,
} from './CarouselRenderer';

// React hook
export {
  useCarousel,
  useCarouselPointerEvents,
  type UseCarouselReturn,
  type UseCarouselConfig,
} from './useCarousel';
