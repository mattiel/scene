/**
 * Carousel data, types, and configuration constants
 */

// ============================================
// Types
// ============================================

export interface CardData {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  image: string;
  label: string;
}

export interface CardTexture {
  id: string;
  width: number;
  height: number;
  source: HTMLCanvasElement;
}

export interface CarouselConfig {
  cardSpacing: number;
  cardWidth: number;
  cardHeight: number;
  cameraZ: number;
  bendScale: number;
  bendClamp: number;
  expandScale: number;
}

// ============================================
// Configuration
// ============================================

/** Base config (desktop) */
export const BASE_CONFIG: CarouselConfig = {
  cardSpacing: 320,
  cardWidth: 300,
  cardHeight: 420,
  cameraZ: 1200,
  bendScale: 3.0,
  bendClamp: 1.2,
  expandScale: 0.6, // 1 + 0.6 = 1.6x at full expand
};

export const CARD_THEMES = [
  { primary: '#111111', secondary: '#1f1f1f' },
  { primary: '#1a1a1a', secondary: '#0f0f0f' },
  { primary: '#222222', secondary: '#141414' },
  { primary: '#191919', secondary: '#101010' },
] as const;

// ============================================
// Card Data
// ============================================

export const CARD_DATA: CardData[] = [
  {
    id: 'card-aurora',
    title: 'Aurora Drift',
    subtitle: 'Polar light study',
    body: 'A cinematic pass that reacts to drag velocity. The center card floats forward as the arc stabilizes.',
    image: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=800&fit=crop',
    label: 'Aurora Drift',
  },
  {
    id: 'card-ember',
    title: 'Ember Field',
    subtitle: 'Heat shimmer',
    body: 'Tracked surfaces map directly to DOM elements. Motion values drive distortion without owning timelines.',
    image: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=600&h=800&fit=crop',
    label: 'Ember Field',
  },
  {
    id: 'card-orbit',
    title: 'Orbit Lattice',
    subtitle: 'Parallax grid',
    body: 'Picking uses CPU intersection for now, keeping GPU dedicated to visual effects only.',
    image: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=600&h=800&fit=crop',
    label: 'Orbit Lattice',
  },
  {
    id: 'card-chorus',
    title: 'Chorus Fold',
    subtitle: 'Dissolve transition',
    body: 'TransitionCoordinator clones ghost surfaces so visuals can persist across view changes.',
    image: 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=600&h=800&fit=crop',
    label: 'Chorus Fold',
  },
  {
    id: 'card-surge',
    title: 'Surge Bloom',
    subtitle: 'Vignette pulse',
    body: 'Screen effects stack is ready for post-processing passes, gated behind WebGPU availability.',
    image: 'https://images.unsplash.com/photo-1501630834273-4b5604d2ee31?w=600&h=800&fit=crop',
    label: 'Surge Bloom',
  },
  {
    id: 'card-drift',
    title: 'Driftline',
    subtitle: 'Glide inertia',
    body: 'Inertia continues rotation after drag end. The carousel settles with reduced-motion support.',
    image: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&h=800&fit=crop',
    label: 'Driftline',
  },
  {
    id: 'card-veil',
    title: 'Veil Echo',
    subtitle: 'Focus sync',
    body: 'A11y mirrors stay in sync with selection and activation, keeping keyboard navigation intact.',
    image: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=600&h=800&fit=crop',
    label: 'Veil Echo',
  },
];
