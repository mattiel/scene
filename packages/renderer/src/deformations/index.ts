/**
 * Deformations - Composable vertex deformations
 * 
 * Deformations modify vertex positions in shaders for various effects.
 */

export { 
  BaseDeformation, 
  type DeformationConfig,
} from './BaseDeformation';

export { 
  BendDeformation, 
  horizontalBend, 
  verticalBend,
  type BendDeformationConfig,
} from './BendDeformation';

export { 
  RippleDeformation, 
  subtleRipple, 
  strongRipple,
  type RippleDeformationConfig,
} from './RippleDeformation';

export { 
  WaveDeformation, 
  horizontalWave, 
  verticalWave,
  type WaveDeformationConfig,
} from './WaveDeformation';
