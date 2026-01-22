/**
 * Built-in Surface Effects
 * 
 * Pre-built effects for common visual treatments:
 * - BlurEffect: Gaussian blur
 * - GlowEffect: Outer glow/bloom
 * - DistortEffect: Wave/ripple distortion
 * - RefractEffect: Refraction/glass effect
 */

import { BaseSurfaceEffect, type EffectUniform } from './SurfaceEffect';

// ============================================
// Blur Effect
// ============================================

/** BlurEffect configuration */
export interface BlurEffectConfig {
  /** Blur radius in pixels (default: 10) */
  radius?: number;
  /** Number of blur passes (default: 2, more = smoother) */
  passes?: number;
  /** Blur direction: 'both' | 'horizontal' | 'vertical' */
  direction?: 'both' | 'horizontal' | 'vertical';
}

/**
 * BlurEffect - Gaussian blur
 * 
 * @example
 * ```typescript
 * surface.addEffect(new BlurEffect({ radius: 20 }));
 * 
 * // Animate blur
 * surface.setEffectIntensity('blur', 0.5);
 * ```
 */
export class BlurEffect extends BaseSurfaceEffect {
  private radius: number;
  private direction: 'both' | 'horizontal' | 'vertical';

  constructor(config: BlurEffectConfig = {}) {
    super('blur', 'Gaussian Blur');
    this.radius = config.radius ?? 10;
    this.direction = config.direction ?? 'both';
  }

  getUniforms(): EffectUniform[] {
    return [
      { name: 'radius', type: 'f32', value: this.radius },
      { name: 'direction', type: 'vec2f', value: this.getDirectionVector() },
    ];
  }

  private getDirectionVector(): [number, number] {
    switch (this.direction) {
      case 'horizontal': return [1, 0];
      case 'vertical': return [0, 1];
      default: return [1, 1];
    }
  }

  setRadius(radius: number): this {
    this.radius = radius;
    return this;
  }

  protected override getEffectShaderCode(): string {
    return `
      @fragment
      fn fragmentMain(@location(0) texCoord: vec2f) -> @location(0) vec4f {
        let texelSize = 1.0 / uniforms.resolution;
        let radius = uniforms.radius * uniforms.intensity;
        let dir = uniforms.direction;
        
        var color = vec4f(0.0);
        var totalWeight = 0.0;
        
        // 9-tap Gaussian blur
        let offsets = array<f32, 5>(0.0, 1.0, 2.0, 3.0, 4.0);
        let weights = array<f32, 5>(0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
        
        for (var i = 0; i < 5; i++) {
          let offset = offsets[i] * radius * texelSize;
          let weight = weights[i];
          
          // Center sample
          if (i == 0) {
            color += textureSample(inputTex, texSampler, texCoord) * weight;
            totalWeight += weight;
          } else {
            // Bilateral samples
            color += textureSample(inputTex, texSampler, texCoord + offset * dir) * weight;
            color += textureSample(inputTex, texSampler, texCoord - offset * dir) * weight;
            totalWeight += weight * 2.0;
          }
        }
        
        return color / totalWeight;
      }
    `;
  }
}

// ============================================
// Glow Effect
// ============================================

/** GlowEffect configuration */
export interface GlowEffectConfig {
  /** Glow color RGB (default: white) */
  color?: [number, number, number];
  /** Glow radius in pixels (default: 20) */
  radius?: number;
  /** Glow strength multiplier (default: 2) */
  strength?: number;
  /** Threshold for glow extraction (default: 0.5) */
  threshold?: number;
}

/**
 * GlowEffect - Outer glow/bloom effect
 * 
 * @example
 * ```typescript
 * surface.addEffect(new GlowEffect({
 *   color: [1, 0.5, 0], // Orange glow
 *   radius: 30,
 *   strength: 3,
 * }));
 * ```
 */
export class GlowEffect extends BaseSurfaceEffect {
  private color: [number, number, number];
  private radius: number;
  private strength: number;
  private threshold: number;

  constructor(config: GlowEffectConfig = {}) {
    super('glow', 'Glow');
    this.color = config.color ?? [1, 1, 1];
    this.radius = config.radius ?? 20;
    this.strength = config.strength ?? 2;
    this.threshold = config.threshold ?? 0.5;
  }

  getUniforms(): EffectUniform[] {
    return [
      { name: 'glowColor', type: 'vec3f', value: this.color },
      { name: 'radius', type: 'f32', value: this.radius },
      { name: 'strength', type: 'f32', value: this.strength },
      { name: 'threshold', type: 'f32', value: this.threshold },
    ];
  }

  setColor(r: number, g: number, b: number): this {
    this.color = [r, g, b];
    return this;
  }

  setRadius(radius: number): this {
    this.radius = radius;
    return this;
  }

  setStrength(strength: number): this {
    this.strength = strength;
    return this;
  }

  protected override getEffectShaderCode(): string {
    return `
      @fragment
      fn fragmentMain(@location(0) texCoord: vec2f) -> @location(0) vec4f {
        let texelSize = 1.0 / uniforms.resolution;
        let radius = uniforms.radius * uniforms.intensity;
        
        // Sample original color
        let original = textureSample(inputTex, texSampler, texCoord);
        
        // Blur for glow
        var glow = vec4f(0.0);
        var totalWeight = 0.0;
        
        let samples = 8;
        for (var i = 0; i < samples; i++) {
          let angle = f32(i) * 6.28318 / f32(samples);
          let offset = vec2f(cos(angle), sin(angle)) * radius * texelSize;
          
          let sample = textureSample(inputTex, texSampler, texCoord + offset);
          let luminance = dot(sample.rgb, vec3f(0.299, 0.587, 0.114));
          
          // Only include bright pixels
          if (luminance > uniforms.threshold) {
            glow += sample;
            totalWeight += 1.0;
          }
        }
        
        if (totalWeight > 0.0) {
          glow /= totalWeight;
        }
        
        // Apply glow color and strength
        let glowContrib = glow.rgb * uniforms.glowColor * uniforms.strength * uniforms.intensity;
        
        // Additive blend
        return vec4f(original.rgb + glowContrib, original.a);
      }
    `;
  }
}

// ============================================
// Distort Effect
// ============================================

/** DistortEffect configuration */
export interface DistortEffectConfig {
  /** Distortion type */
  type?: 'wave' | 'ripple' | 'noise';
  /** Distortion amount (default: 20) */
  amount?: number;
  /** Wave/ripple frequency (default: 10) */
  frequency?: number;
  /** Animation speed (default: 1) */
  speed?: number;
}

/**
 * DistortEffect - Wave/ripple distortion
 * 
 * @example
 * ```typescript
 * surface.addEffect(new DistortEffect({
 *   type: 'wave',
 *   amount: 30,
 *   frequency: 5,
 * }));
 * ```
 */
export class DistortEffect extends BaseSurfaceEffect {
  private distortType: 'wave' | 'ripple' | 'noise';
  private amount: number;
  private frequency: number;
  private speed: number;

  constructor(config: DistortEffectConfig = {}) {
    super('distort', 'Distortion');
    this.distortType = config.type ?? 'wave';
    this.amount = config.amount ?? 20;
    this.frequency = config.frequency ?? 10;
    this.speed = config.speed ?? 1;
  }

  getUniforms(): EffectUniform[] {
    return [
      { name: 'distortType', type: 'f32', value: this.getTypeValue() },
      { name: 'amount', type: 'f32', value: this.amount },
      { name: 'frequency', type: 'f32', value: this.frequency },
      { name: 'speed', type: 'f32', value: this.speed },
    ];
  }

  private getTypeValue(): number {
    switch (this.distortType) {
      case 'wave': return 0;
      case 'ripple': return 1;
      case 'noise': return 2;
    }
  }

  setAmount(amount: number): this {
    this.amount = amount;
    return this;
  }

  setFrequency(frequency: number): this {
    this.frequency = frequency;
    return this;
  }

  protected override getEffectShaderCode(): string {
    return `
      fn hash(p: vec2f) -> f32 {
        return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
      }
      
      @fragment
      fn fragmentMain(@location(0) texCoord: vec2f) -> @location(0) vec4f {
        let texelSize = 1.0 / uniforms.resolution;
        let amount = uniforms.amount * uniforms.intensity * texelSize.x;
        let freq = uniforms.frequency;
        let t = uniforms.time * uniforms.speed;
        
        var offset = vec2f(0.0);
        
        // Wave distortion
        if (uniforms.distortType < 0.5) {
          offset.x = sin(texCoord.y * freq + t) * amount;
          offset.y = sin(texCoord.x * freq + t * 0.7) * amount * 0.5;
        }
        // Ripple distortion
        else if (uniforms.distortType < 1.5) {
          let center = vec2f(0.5);
          let dist = distance(texCoord, center);
          let ripple = sin(dist * freq * 10.0 - t * 3.0) * amount;
          let dir = normalize(texCoord - center);
          offset = dir * ripple * (1.0 - dist);
        }
        // Noise distortion
        else {
          let n1 = hash(texCoord * freq + t);
          let n2 = hash(texCoord * freq * 1.3 + t * 0.8);
          offset = vec2f(n1, n2) * 2.0 - 1.0;
          offset *= amount;
        }
        
        return textureSample(inputTex, texSampler, texCoord + offset);
      }
    `;
  }
}

// ============================================
// Refract Effect
// ============================================

/** RefractEffect configuration */
export interface RefractEffectConfig {
  /** Refraction strength (default: 0.1) */
  strength?: number;
  /** Index of refraction (default: 1.5, like glass) */
  ior?: number;
  /** Chromatic aberration amount (default: 0) */
  chromaticAberration?: number;
  /** Fresnel effect intensity (default: 0.5) */
  fresnel?: number;
}

/**
 * RefractEffect - Glass/refraction effect
 * 
 * @example
 * ```typescript
 * surface.addEffect(new RefractEffect({
 *   strength: 0.2,
 *   ior: 1.5,
 *   chromaticAberration: 0.01,
 * }));
 * ```
 */
export class RefractEffect extends BaseSurfaceEffect {
  private strength: number;
  private ior: number;
  private chromaticAberration: number;
  private fresnel: number;

  constructor(config: RefractEffectConfig = {}) {
    super('refract', 'Refraction');
    this.strength = config.strength ?? 0.1;
    this.ior = config.ior ?? 1.5;
    this.chromaticAberration = config.chromaticAberration ?? 0;
    this.fresnel = config.fresnel ?? 0.5;
  }

  getUniforms(): EffectUniform[] {
    return [
      { name: 'refractStrength', type: 'f32', value: this.strength },
      { name: 'ior', type: 'f32', value: this.ior },
      { name: 'chromatic', type: 'f32', value: this.chromaticAberration },
      { name: 'fresnel', type: 'f32', value: this.fresnel },
    ];
  }

  setStrength(strength: number): this {
    this.strength = strength;
    return this;
  }

  setIOR(ior: number): this {
    this.ior = ior;
    return this;
  }

  setChromaticAberration(amount: number): this {
    this.chromaticAberration = amount;
    return this;
  }

  protected override getEffectShaderCode(): string {
    return `
      @fragment
      fn fragmentMain(@location(0) texCoord: vec2f) -> @location(0) vec4f {
        let strength = uniforms.refractStrength * uniforms.intensity;
        
        // Simulate normal from texture gradient
        let texelSize = 1.0 / uniforms.resolution;
        let left = textureSample(inputTex, texSampler, texCoord - vec2f(texelSize.x, 0.0)).r;
        let right = textureSample(inputTex, texSampler, texCoord + vec2f(texelSize.x, 0.0)).r;
        let up = textureSample(inputTex, texSampler, texCoord - vec2f(0.0, texelSize.y)).r;
        let down = textureSample(inputTex, texSampler, texCoord + vec2f(0.0, texelSize.y)).r;
        
        let dx = (right - left) * 0.5;
        let dy = (down - up) * 0.5;
        
        // Calculate refraction offset
        let normal = normalize(vec3f(dx, dy, 1.0));
        let viewDir = vec3f(0.0, 0.0, 1.0);
        
        // Simplified refraction
        let ratio = 1.0 / uniforms.ior;
        let refractDir = refract(-viewDir, normal, ratio);
        let offset = refractDir.xy * strength;
        
        // Fresnel effect - edges refract more
        let fresnelFactor = pow(1.0 - abs(dot(viewDir, normal)), 2.0) * uniforms.fresnel;
        offset *= (1.0 + fresnelFactor);
        
        // Sample with chromatic aberration
        var color: vec4f;
        if (uniforms.chromatic > 0.001) {
          let ca = uniforms.chromatic * uniforms.intensity;
          color.r = textureSample(inputTex, texSampler, texCoord + offset * (1.0 + ca)).r;
          color.g = textureSample(inputTex, texSampler, texCoord + offset).g;
          color.b = textureSample(inputTex, texSampler, texCoord + offset * (1.0 - ca)).b;
          color.a = textureSample(inputTex, texSampler, texCoord + offset).a;
        } else {
          color = textureSample(inputTex, texSampler, texCoord + offset);
        }
        
        return color;
      }
    `;
  }
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a blur effect
 */
export function blur(config?: BlurEffectConfig): BlurEffect {
  return new BlurEffect(config);
}

/**
 * Create a glow effect
 */
export function glow(config?: GlowEffectConfig): GlowEffect {
  return new GlowEffect(config);
}

/**
 * Create a distort effect
 */
export function distort(config?: DistortEffectConfig): DistortEffect {
  return new DistortEffect(config);
}

/**
 * Create a refract effect
 */
export function refract(config?: RefractEffectConfig): RefractEffect {
  return new RefractEffect(config);
}
