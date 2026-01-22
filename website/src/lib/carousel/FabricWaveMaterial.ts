/**
 * FabricWaveMaterial - Fabric wave effect material for carousel cards
 * 
 * Creates a cloth-like wave deformation effect with:
 * - Continuous wave deformation across multiple cards
 * - Scroll-based ripple effect
 * - Click-triggered billow animation
 * - Fabric-like shading
 */

import { 
  ShaderMaterial,
  type ShaderMaterialConfig,
  type UniformSchema,
} from '@scene/renderer';

// ============================================
// Shader Code (preserved exactly as-is)
// ============================================

const SHADER_CODE = `
  // ============================================
  // TUNABLE CONSTANTS - Adjust these to tweak the effect
  // ============================================
  
  // --- Expand Effect (when card is focused/clicked) ---
  const EXPAND_SOFT_RADIUS: f32 = 0.15;       // Flat dome center size (smaller = sharper peak)
  const EXPAND_ATTACK_SPEED: f32 = 10.0;      // How fast the billow starts (higher = snappier)
  const EXPAND_DECAY_SPEED: f32 = 8.0;        // How fast the billow fades (higher = quicker fade)
  const EXPAND_WAVE_SPEED: f32 = 4.0;         // How fast the wave propagates outward
  const EXPAND_PULSE_SPREAD: f32 = 0.8;       // Pulse falloff sharpness (lower = broader wave)
  const EXPAND_DOME_SCALE: f32 = 0.9;         // Dome size (lower = larger dome area)
  const EXPAND_PULSE_WEIGHT: f32 = 0.7;       // Pulse contribution to billow
  const EXPAND_DOME_WEIGHT: f32 = 0.6;        // Dome contribution to billow
  const EXPAND_INTENSITY: f32 = 140.0;        // Overall billow height (higher = more dramatic)
  const EXPAND_PUSH_STRENGTH: f32 = 0.14;     // Outward fabric displacement
  const EXPAND_SURFACE_VAR_X: f32 = 0.15;     // Surface variation in X
  const EXPAND_SURFACE_VAR_Y: f32 = 0.12;     // Surface variation in Y
  
  // --- Collapse Effect (when card returns to normal) ---
  const COLLAPSE_SOFT_RADIUS: f32 = 0.15;     // Flat dome center size
  const COLLAPSE_ATTACK_SPEED: f32 = 10.0;    // How fast collapse starts
  const COLLAPSE_DECAY_SPEED: f32 = 8.0;      // How fast collapse fades
  const COLLAPSE_WAVE_SPEED: f32 = 3.0;       // Inward wave speed
  const COLLAPSE_PULSE_SPREAD: f32 = 1.2;     // Pulse falloff sharpness
  const COLLAPSE_DOME_SCALE: f32 = 1.1;       // Dome size
  const COLLAPSE_PULSE_WEIGHT: f32 = 0.55;    // Pulse contribution
  const COLLAPSE_DOME_WEIGHT: f32 = 0.4;      // Dome contribution
  const COLLAPSE_INTENSITY: f32 = 65.0;       // Overall billow depth
  const COLLAPSE_PULL_STRENGTH: f32 = 0.07;   // Inward fabric displacement
  const COLLAPSE_SURFACE_VAR_X: f32 = 0.1;    // Surface variation in X
  const COLLAPSE_SURFACE_VAR_Y: f32 = 0.08;   // Surface variation in Y
  
  // --- Scroll/Drag Wave Effect ---
  const SCROLL_WAVE_INTENSITY: f32 = 45.0;    // Wave amplitude during scroll
  const SCROLL_DRAPE_VAR: f32 = 0.2;          // Vertical variation in scroll wave
  
  // ============================================
  // Uniforms
  // ============================================

  struct GlobalUniforms {
    viewProj: mat4x4<f32>,
    globalBend: f32,
    wavePhaseOffset: f32,
    scrollRipplePhase: f32,
    scrollRippleIntensity: f32,
    scrollRippleDirection: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
  };

  struct CardUniforms {
    model: mat4x4<f32>,
    bend: f32,
    opacity: f32,
    rippleOriginX: f32,
    rippleOriginY: f32,
    rippleProgress: f32,
    collapseProgress: f32,
    worldX: f32,
    cardWidth: f32,
  };

  @group(0) @binding(0) var<uniform> globals: GlobalUniforms;
  @group(1) @binding(0) var<uniform> card: CardUniforms;
  @group(1) @binding(1) var cardSampler: sampler;
  @group(1) @binding(2) var cardTexture: texture_2d<f32>;

  struct VertexInput {
    @location(0) position: vec3f,
    @location(1) texCoord: vec2f,
  };

  struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
    @location(1) shading: f32,
  };

  const PI: f32 = 3.14159265;
  const TWO_PI: f32 = 6.2831853;
  const HALF_PI: f32 = 1.5707963;

  // Dome shape: 1 - x^2 (parabola approximating cosine curve)
  fn domeShape(x: f32) -> f32 {
    let t = clamp(x, 0.0, 1.0);
    return 1.0 - t * t;
  }

  @vertex
  fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let x = input.position.x;
    let y = input.position.y;
    let b = globals.globalBend;
    let absB = abs(b);
    let signB = sign(b);
    let u = x + 0.5;
    let v = y + 0.5;
    let worldPosX = card.worldX + (x * card.cardWidth);
    let worldU = worldPosX * 0.002 + globals.wavePhaseOffset;
    
    // Precompute shared trig values
    let vPI = v * PI;
    let vPI2 = vPI * 2.0;
    let sinVPI = sin(vPI);
    let sinVPI2 = sin(vPI2);
    let wavePhase = worldU * TWO_PI - signB * 0.5;
    let sinWavePhase = sin(wavePhase);
    let sinWorldU2 = sin(worldU * TWO_PI);
    
    // Primary horizontal wave
    let primaryWave = sinWavePhase * absB * 8.0;
    let verticalRipple = sin(vPI * 3.0 + worldU * PI) * absB * 3.0;
    let worldEdgeFactor = sin(worldU * HALF_PI) * 0.5 + 0.5;
    let edgeLift = worldEdgeFactor * absB * 4.0;
    let leadingT = clamp(-worldU * signB * 0.3 + 0.5, 0.0, 1.0);
    let leadingWave = leadingT * sinVPI2 * absB * 5.0;
    var totalZ = (primaryWave + verticalRipple + edgeLift + leadingWave) * signB;
    var yOffset = sinWorldU2 * absB * 0.008;
    var xOffset = signB * absB * 0.01 * (1.0 - leadingT) * sinVPI;
    
    // Scroll ripple
    let scrollIntensity = globals.scrollRippleIntensity;
    let fabricPhase = (worldPosX * 0.002 + globals.scrollRipplePhase) * 1.8 + globals.scrollRippleDirection * 0.4;
    let fabricCurl = sin(fabricPhase) * scrollIntensity * SCROLL_WAVE_INTENSITY;
    let drapeVar = 1.0 + SCROLL_DRAPE_VAR * sinVPI2;
    totalZ += fabricCurl * drapeVar;
    
    var rippleIntensity: f32 = 0.0;
    
    // ========== EXPAND EFFECT (card focused) ==========
    let rp = card.rippleProgress;
    if (rp > 0.0 && rp < 1.0) {
      let toPos = vec2f(u - card.rippleOriginX, v - card.rippleOriginY);
      let rawDist = length(toPos);
      let dist = max(0.0, rawDist - EXPAND_SOFT_RADIUS);
      
      // Envelope: quick attack, smooth decay
      let attack = 1.0 - exp(-rp * EXPAND_ATTACK_SPEED);
      let decay = 1.0 - exp2(-EXPAND_DECAY_SPEED * clamp(rp / 0.9, 0.0, 1.0));
      let envelope = attack * (1.0 - decay);
      
      // Wave propagation
      let waveFront = rp * EXPAND_WAVE_SPEED;
      let distFromWave = dist - waveFront;
      
      // Billow shape
      let pulse = exp(-distFromWave * distFromWave * EXPAND_PULSE_SPREAD);
      let behindWave = smoothstep(0.0, 0.5, waveFront - dist);
      let dome = domeShape(rawDist * EXPAND_DOME_SCALE);
      
      let billowStrength = envelope * (pulse * EXPAND_PULSE_WEIGHT + behindWave * EXPAND_DOME_WEIGHT * dome);
      let surfaceVar = 1.0 + EXPAND_SURFACE_VAR_X * (u - 0.5) + EXPAND_SURFACE_VAR_Y * (v - 0.5);
      totalZ += billowStrength * EXPAND_INTENSITY * surfaceVar;
      
      // Outward push
      let pushFactor = smoothstep(0.0, 0.4, rawDist) * billowStrength * EXPAND_PUSH_STRENGTH;
      xOffset += toPos.x * pushFactor;
      yOffset += toPos.y * pushFactor;
      rippleIntensity = billowStrength;
    }
    
    // ========== COLLAPSE EFFECT (card returns to normal) ==========
    let cp = card.collapseProgress;
    if (cp > 0.0 && cp < 1.0) {
      let toPos = vec2f(u - 0.5, v - 0.5);
      let rawDist = length(toPos);
      let dist = max(0.0, rawDist - COLLAPSE_SOFT_RADIUS);
      
      // Envelope
      let attack = 1.0 - exp(-cp * COLLAPSE_ATTACK_SPEED);
      let decayT = clamp((cp - 0.2) * 1.4286, 0.0, 1.0);
      let decay = 1.0 - exp2(-COLLAPSE_DECAY_SPEED * decayT);
      let envelope = attack * (1.0 - decay * 0.9);
      
      // Inward wave
      let waveFront = 0.707 - cp * COLLAPSE_WAVE_SPEED;
      let distFromWave = dist - waveFront;
      
      // Billow shape
      let pulse = exp(-distFromWave * distFromWave * COLLAPSE_PULSE_SPREAD);
      let behindWave = smoothstep(0.0, 0.4, dist - waveFront);
      let dome = domeShape(rawDist * COLLAPSE_DOME_SCALE);
      
      let billowStrength = envelope * (pulse * COLLAPSE_PULSE_WEIGHT + behindWave * COLLAPSE_DOME_WEIGHT * dome);
      let surfaceVar = 1.0 + COLLAPSE_SURFACE_VAR_X * (u - 0.5) + COLLAPSE_SURFACE_VAR_Y * (v - 0.5);
      totalZ -= billowStrength * COLLAPSE_INTENSITY * surfaceVar;
      
      // Inward pull
      let pullFactor = smoothstep(0.0, 0.35, rawDist) * billowStrength * COLLAPSE_PULL_STRENGTH;
      xOffset -= toPos.x * pullFactor;
      yOffset -= toPos.y * pullFactor;
      
      rippleIntensity = max(rippleIntensity, billowStrength * 0.6);
    }
    
    // Final position
    let world = card.model * vec4f(x + xOffset, y + yOffset, totalZ, 1.0);
    output.position = globals.viewProj * world;
    output.uv = input.texCoord;
    
    // Pre-compute shading in vertex shader (interpolates well)
    let bendFactor = absB * (0.5 + 0.5 * abs(sinWavePhase)) + scrollIntensity * 0.15;
    let waveShade = sinWorldU2 * 0.08 + sinVPI * 0.04;  // Approximate fabric pattern
    let baseShade = 1.0 + waveShade * (absB + scrollIntensity * 0.15);
    output.shading = baseShade + bendFactor * 0.12 - (1.0 - bendFactor) * absB * 0.06 + rippleIntensity * 0.04;
    
    return output;
  }

  @fragment
  fn fragmentMain(
    @location(0) uv: vec2f, 
    @location(1) shading: f32
  ) -> @location(0) vec4f {
    let tex = textureSample(cardTexture, cardSampler, uv);
    return vec4f(tex.rgb * shading, tex.a * card.opacity);
  }
`;

// ============================================
// Uniform Schemas
// ============================================

/** Schema for per-card uniforms */
const CARD_UNIFORM_SCHEMA: UniformSchema = {
  model: { type: 'mat4x4f' },
  bend: { type: 'f32', default: 0 },
  opacity: { type: 'f32', default: 1 },
  rippleOriginX: { type: 'f32', default: 0.5 },
  rippleOriginY: { type: 'f32', default: 0.5 },
  rippleProgress: { type: 'f32', default: 0 },
  collapseProgress: { type: 'f32', default: 0 },
  worldX: { type: 'f32', default: 0 },
  cardWidth: { type: 'f32', default: 300 },
};

/** Schema for global uniforms (used by FabricWaveRenderer) */
export const GLOBAL_UNIFORM_SCHEMA: UniformSchema = {
  viewProj: { type: 'mat4x4f' },
  globalBend: { type: 'f32', default: 0 },
  wavePhaseOffset: { type: 'f32', default: 0 },
  scrollRipplePhase: { type: 'f32', default: 0 },
  scrollRippleIntensity: { type: 'f32', default: 0 },
  scrollRippleDirection: { type: 'f32', default: 0 },
};

// ============================================
// Material Class
// ============================================

export interface FabricWaveMaterialConfig {
  name?: string;
  texture?: GPUTexture;
}

export interface CardUniforms {
  bend?: number;
  opacity?: number;
  rippleOriginX?: number;
  rippleOriginY?: number;
  rippleProgress?: number;
  collapseProgress?: number;
  worldX?: number;
  cardWidth?: number;
}

/**
 * FabricWaveMaterial - Material with fabric wave deformation
 * 
 * Uses ShaderMaterial's raw mode for complete shader control
 * while leveraging library infrastructure for uniform management.
 */
export class FabricWaveMaterial extends ShaderMaterial {
  constructor(config: FabricWaveMaterialConfig = {}) {
    super({
      name: config.name ?? 'FabricWaveMaterial',
      shaderCode: SHADER_CODE,
      uniforms: CARD_UNIFORM_SCHEMA,
      ownBindGroupIndex: 1,
      bindGroupEntries: [
        { binding: 0, type: 'uniform' },
        { binding: 1, type: 'sampler' },
        { binding: 2, type: 'texture' },
      ],
      blendMode: 'alpha',
      depthTest: false,
      depthWrite: false,
    } as ShaderMaterialConfig);
  }

  /** Set card texture */
  setCardTexture(texture: GPUTexture): void {
    this.setTexture('default', texture);
  }

  /** Update card uniforms */
  updateCard(modelMatrix: Float32Array, uniforms: CardUniforms): void {
    this.setUniform('model', modelMatrix);
    if (uniforms.bend !== undefined) this.setUniform('bend', uniforms.bend);
    if (uniforms.opacity !== undefined) this.setUniform('opacity', uniforms.opacity);
    if (uniforms.rippleOriginX !== undefined) this.setUniform('rippleOriginX', uniforms.rippleOriginX);
    if (uniforms.rippleOriginY !== undefined) this.setUniform('rippleOriginY', uniforms.rippleOriginY);
    if (uniforms.rippleProgress !== undefined) this.setUniform('rippleProgress', uniforms.rippleProgress);
    if (uniforms.collapseProgress !== undefined) this.setUniform('collapseProgress', uniforms.collapseProgress);
    if (uniforms.worldX !== undefined) this.setUniform('worldX', uniforms.worldX);
    if (uniforms.cardWidth !== undefined) this.setUniform('cardWidth', uniforms.cardWidth);
    this.prepare();  // Upload uniforms to GPU
  }
}
