/**
 * ShaderLibrary
 * 
 * Manages WGSL shader code and provides utilities for shader compilation.
 * Supports shader variants and preprocessor-like includes.
 */

/// <reference types="@webgpu/types" />

export interface ShaderModule {
  code: string;
  entryPoints: {
    vertex?: string;
    fragment?: string;
    compute?: string;
  };
}

export interface CompiledShader {
  module: GPUShaderModule;
  entryPoints: ShaderModule['entryPoints'];
}

export class ShaderLibrary {
  private shaders: Map<string, ShaderModule>;
  private compiled: Map<string, CompiledShader>;
  private device: GPUDevice | null;

  constructor() {
    this.shaders = new Map();
    this.compiled = new Map();
    this.device = null;
  }

  /**
   * Set the GPU device for shader compilation
   */
  setDevice(device: GPUDevice): void {
    this.device = device;
    // Clear compiled shaders when device changes
    this.compiled.clear();
  }

  /**
   * Register a shader module
   */
  register(name: string, shader: ShaderModule): void {
    this.shaders.set(name, shader);
    // Clear compiled version if it exists
    this.compiled.delete(name);
  }

  /**
   * Get a compiled shader module
   */
  get(name: string): CompiledShader | null {
    // Return cached compiled shader if available
    if (this.compiled.has(name)) {
      return this.compiled.get(name)!;
    }

    // Compile shader if device is available
    if (this.device && this.shaders.has(name)) {
      const shader: ShaderModule = this.shaders.get(name)!;
      const compiled: CompiledShader = this.compile(name, shader);
      this.compiled.set(name, compiled);
      return compiled;
    }

    return null;
  }

  /**
   * Compile a shader module
   */
  private compile(name: string, shader: ShaderModule): CompiledShader {
    if (!this.device) {
      throw new Error('Cannot compile shader: GPU device not set');
    }

    const module: GPUShaderModule = this.device.createShaderModule({
      label: name,
      code: shader.code
    });

    // Get compilation info for error reporting
    module.getCompilationInfo().then((info: GPUCompilationInfo) => {
      for (const message of info.messages) {
        if (message.type === 'error') {
          console.error(`Shader compilation error in ${name}:`, message.message);
        } else if (message.type === 'warning') {
          console.warn(`Shader compilation warning in ${name}:`, message.message);
        }
      }
    });

    return {
      module,
      entryPoints: shader.entryPoints
    };
  }

  /**
   * Check if a shader is registered
   */
  has(name: string): boolean {
    return this.shaders.has(name);
  }

  /**
   * Remove a shader from the library
   */
  remove(name: string): void {
    this.shaders.delete(name);
    this.compiled.delete(name);
  }

  /**
   * Clear all shaders
   */
  clear(): void {
    this.shaders.clear();
    this.compiled.clear();
  }

  /**
   * Register default Scene shaders
   */
  registerDefaults(): void {
    // Basic passthrough vertex shader
    this.register('passthrough_vertex', {
      code: `
        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) texCoord: vec2f,
        };

        @vertex
        fn main(
          @location(0) position: vec2f,
          @location(1) texCoord: vec2f
        ) -> VertexOutput {
          var output: VertexOutput;
          output.position = vec4f(position, 0.0, 1.0);
          output.texCoord = texCoord;
          return output;
        }
      `,
      entryPoints: { vertex: 'main' }
    });

    // Basic textured quad fragment shader
    this.register('textured_quad', {
      code: `
        @group(0) @binding(0) var textureSampler: sampler;
        @group(0) @binding(1) var textureData: texture_2d<f32>;

        @fragment
        fn main(
          @location(0) texCoord: vec2f
        ) -> @location(0) vec4f {
          return textureSample(textureData, textureSampler, texCoord);
        }
      `,
      entryPoints: { fragment: 'main' }
    });

    // Fullscreen quad vertex shader
    this.register('fullscreen_vertex', {
      code: `
        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) uv: vec2f,
        };

        @vertex
        fn main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
          var output: VertexOutput;
          
          // Generate fullscreen quad from vertex index
          let x: f32 = f32((vertexIndex & 1u) << 1u) - 1.0;
          let y: f32 = f32(vertexIndex & 2u) - 1.0;
          
          output.position = vec4f(x, y, 0.0, 1.0);
          output.uv = vec2f(x * 0.5 + 0.5, 1.0 - (y * 0.5 + 0.5));
          
          return output;
        }
      `,
      entryPoints: { vertex: 'main' }
    });

    // Simple post-process copy shader
    this.register('copy_fragment', {
      code: `
        @group(0) @binding(0) var textureSampler: sampler;
        @group(0) @binding(1) var textureData: texture_2d<f32>;

        @fragment
        fn main(
          @location(0) uv: vec2f
        ) -> @location(0) vec4f {
          return textureSample(textureData, textureSampler, uv);
        }
      `,
      entryPoints: { fragment: 'main' }
    });

    // Gaussian blur fragment shader
    this.register('blur_fragment', {
      code: `
        @group(0) @binding(0) var textureSampler: sampler;
        @group(0) @binding(1) var textureData: texture_2d<f32>;
        
        struct BlurParams {
          direction: vec2f,
          strength: f32,
          _padding: f32,
        };
        
        @group(0) @binding(2) var<uniform> params: BlurParams;

        @fragment
        fn main(
          @location(0) uv: vec2f
        ) -> @location(0) vec4f {
          let texelSize: vec2f = 1.0 / vec2f(textureDimensions(textureData));
          let offset: vec2f = params.direction * texelSize * params.strength;
          
          var color: vec4f = vec4f(0.0);
          
          // 5-tap Gaussian blur
          color += textureSample(textureData, textureSampler, uv - offset * 2.0) * 0.0625;
          color += textureSample(textureData, textureSampler, uv - offset) * 0.25;
          color += textureSample(textureData, textureSampler, uv) * 0.375;
          color += textureSample(textureData, textureSampler, uv + offset) * 0.25;
          color += textureSample(textureData, textureSampler, uv + offset * 2.0) * 0.0625;
          
          return color;
        }
      `,
      entryPoints: { fragment: 'main' }
    });

    // Chromatic aberration fragment shader
    this.register('chromatic_aberration_fragment', {
      code: `
        @group(0) @binding(0) var textureSampler: sampler;
        @group(0) @binding(1) var textureData: texture_2d<f32>;
        
        struct ChromaParams {
          strength: f32,
          _padding0: f32,
          _padding1: f32,
          _padding2: f32,
        };
        
        @group(0) @binding(2) var<uniform> params: ChromaParams;

        @fragment
        fn main(
          @location(0) uv: vec2f
        ) -> @location(0) vec4f {
          let offset: vec2f = (uv - 0.5) * params.strength;
          
          let r: f32 = textureSample(textureData, textureSampler, uv + offset).r;
          let g: f32 = textureSample(textureData, textureSampler, uv).g;
          let b: f32 = textureSample(textureData, textureSampler, uv - offset).b;
          let a: f32 = textureSample(textureData, textureSampler, uv).a;
          
          return vec4f(r, g, b, a);
        }
      `,
      entryPoints: { fragment: 'main' }
    });

    // Vignette fragment shader
    this.register('vignette_fragment', {
      code: `
        @group(0) @binding(0) var textureSampler: sampler;
        @group(0) @binding(1) var textureData: texture_2d<f32>;
        
        struct VignetteParams {
          strength: f32,
          radius: f32,
          softness: f32,
          _padding: f32,
        };
        
        @group(0) @binding(2) var<uniform> params: VignetteParams;

        @fragment
        fn main(
          @location(0) uv: vec2f
        ) -> @location(0) vec4f {
          let color: vec4f = textureSample(textureData, textureSampler, uv);
          
          let center: vec2f = vec2f(0.5, 0.5);
          let dist: f32 = distance(uv, center);
          
          let vignette: f32 = smoothstep(
            params.radius,
            params.radius - params.softness,
            dist
          );
          
          let finalVignette: f32 = mix(1.0, vignette, params.strength);
          
          return vec4f(color.rgb * finalVignette, color.a);
        }
      `,
      entryPoints: { fragment: 'main' }
    });

    // Depth of field fragment shader
    this.register('depth_of_field_fragment', {
      code: `
        @group(0) @binding(0) var textureSampler: sampler;
        @group(0) @binding(1) var textureData: texture_2d<f32>;
        
        struct DOFParams {
          focusPoint: vec2f,
          focusRange: f32,
          blurAmount: f32,
          bokehSize: f32,
          bokehBrightness: f32,
          _padding0: f32,
          _padding1: f32,
        };
        
        @group(0) @binding(2) var<uniform> params: DOFParams;

        @fragment
        fn main(
          @location(0) uv: vec2f
        ) -> @location(0) vec4f {
          let texelSize: vec2f = 1.0 / vec2f(textureDimensions(textureData));
          let centerColor: vec4f = textureSample(textureData, textureSampler, uv);
          
          // Calculate distance from focus point (radial blur)
          let dist: f32 = distance(uv, params.focusPoint);
          let blurFactor: f32 = smoothstep(0.0, params.focusRange, dist) * params.blurAmount;
          
          // Bokeh-style blur sampling
          var color: vec4f = vec4f(0.0);
          var totalWeight: f32 = 0.0;
          
          let samples: i32 = 16;
          let goldenAngle: f32 = 2.39996323;
          
          for (var i: i32 = 0; i < samples; i++) {
            let r: f32 = sqrt(f32(i) / f32(samples)) * blurFactor * params.bokehSize;
            let theta: f32 = f32(i) * goldenAngle;
            let offset: vec2f = vec2f(cos(theta), sin(theta)) * r * texelSize;
            
            let sampleColor: vec4f = textureSample(textureData, textureSampler, uv + offset);
            let weight: f32 = 1.0 + max(0.0, dot(sampleColor.rgb, vec3f(0.299, 0.587, 0.114)) - 0.5) * params.bokehBrightness;
            
            color += sampleColor * weight;
            totalWeight += weight;
          }
          
          color /= totalWeight;
          
          // Blend based on blur factor
          return mix(centerColor, color, min(blurFactor, 1.0));
        }
      `,
      entryPoints: { fragment: 'main' }
    });

    // Motion blur fragment shader
    this.register('motion_blur_fragment', {
      code: `
        @group(0) @binding(0) var textureSampler: sampler;
        @group(0) @binding(1) var textureData: texture_2d<f32>;
        
        struct MotionBlurParams {
          velocity: vec2f,
          strength: f32,
          samples: f32,
        };
        
        @group(0) @binding(2) var<uniform> params: MotionBlurParams;

        @fragment
        fn main(
          @location(0) uv: vec2f
        ) -> @location(0) vec4f {
          let texelSize: vec2f = 1.0 / vec2f(textureDimensions(textureData));
          let direction: vec2f = params.velocity * params.strength * texelSize;
          
          var color: vec4f = vec4f(0.0);
          let numSamples: i32 = i32(params.samples);
          
          for (var i: i32 = 0; i < numSamples; i++) {
            let t: f32 = (f32(i) / f32(numSamples - 1)) - 0.5;
            let sampleUV: vec2f = uv + direction * t;
            color += textureSample(textureData, textureSampler, sampleUV);
          }
          
          return color / f32(numSamples);
        }
      `,
      entryPoints: { fragment: 'main' }
    });

    // Film grain fragment shader
    this.register('film_grain_fragment', {
      code: `
        @group(0) @binding(0) var textureSampler: sampler;
        @group(0) @binding(1) var textureData: texture_2d<f32>;
        
        struct FilmGrainParams {
          intensity: f32,
          time: f32,
          luminanceResponse: f32,
          coloredGrain: f32,
        };
        
        @group(0) @binding(2) var<uniform> params: FilmGrainParams;

        fn hash(p: vec2f) -> f32 {
          var p3: vec3f = fract(vec3f(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        
        fn noise(uv: vec2f, time: f32) -> f32 {
          let seed: vec2f = uv * 1000.0 + vec2f(time * 123.456, time * 789.012);
          return hash(seed) * 2.0 - 1.0;
        }

        @fragment
        fn main(
          @location(0) uv: vec2f
        ) -> @location(0) vec4f {
          let color: vec4f = textureSample(textureData, textureSampler, uv);
          let luminance: f32 = dot(color.rgb, vec3f(0.299, 0.587, 0.114));
          
          // Grain intensity varies with luminance (shadows have more grain)
          let grainIntensity: f32 = params.intensity * mix(1.0, 1.0 - luminance, params.luminanceResponse);
          
          var grain: vec3f;
          if (params.coloredGrain > 0.5) {
            // Colored grain
            grain = vec3f(
              noise(uv, params.time),
              noise(uv + vec2f(100.0, 0.0), params.time),
              noise(uv + vec2f(0.0, 100.0), params.time)
            );
          } else {
            // Monochrome grain
            let n: f32 = noise(uv, params.time);
            grain = vec3f(n, n, n);
          }
          
          return vec4f(color.rgb + grain * grainIntensity, color.a);
        }
      `,
      entryPoints: { fragment: 'main' }
    });

    // Color grading fragment shader (with LUT-like functionality)
    this.register('color_grading_fragment', {
      code: `
        @group(0) @binding(0) var textureSampler: sampler;
        @group(0) @binding(1) var textureData: texture_2d<f32>;
        
        struct ColorGradingParams {
          brightness: f32,
          contrast: f32,
          saturation: f32,
          temperature: f32,
          tint: f32,
          shadows: f32,
          midtones: f32,
          highlights: f32,
        };
        
        @group(0) @binding(2) var<uniform> params: ColorGradingParams;

        fn adjustTemperature(color: vec3f, temp: f32) -> vec3f {
          // Simplified temperature adjustment
          return vec3f(
            color.r * (1.0 + temp * 0.1),
            color.g,
            color.b * (1.0 - temp * 0.1)
          );
        }
        
        fn adjustTint(color: vec3f, tint: f32) -> vec3f {
          return vec3f(
            color.r,
            color.g * (1.0 + tint * 0.1),
            color.b
          );
        }
        
        fn adjustSaturation(color: vec3f, sat: f32) -> vec3f {
          let luminance: f32 = dot(color, vec3f(0.299, 0.587, 0.114));
          return mix(vec3f(luminance), color, sat);
        }
        
        fn adjustContrast(color: vec3f, contrast: f32) -> vec3f {
          return (color - 0.5) * contrast + 0.5;
        }
        
        fn adjustLift(color: vec3f, shadows: f32, midtones: f32, highlights: f32) -> vec3f {
          let luminance: f32 = dot(color, vec3f(0.299, 0.587, 0.114));
          
          // Shadow influence (dark areas)
          let shadowWeight: f32 = 1.0 - smoothstep(0.0, 0.5, luminance);
          // Highlight influence (bright areas)
          let highlightWeight: f32 = smoothstep(0.5, 1.0, luminance);
          // Midtone influence
          let midtoneWeight: f32 = 1.0 - shadowWeight - highlightWeight;
          
          let adjustment: f32 = 
            shadows * shadowWeight + 
            midtones * midtoneWeight + 
            highlights * highlightWeight;
          
          return color + adjustment * 0.2;
        }

        @fragment
        fn main(
          @location(0) uv: vec2f
        ) -> @location(0) vec4f {
          var color: vec3f = textureSample(textureData, textureSampler, uv).rgb;
          
          // Apply adjustments in order
          color = color * params.brightness;
          color = adjustContrast(color, params.contrast);
          color = adjustSaturation(color, params.saturation);
          color = adjustTemperature(color, params.temperature);
          color = adjustTint(color, params.tint);
          color = adjustLift(color, params.shadows, params.midtones, params.highlights);
          
          // Clamp to valid range
          color = clamp(color, vec3f(0.0), vec3f(1.0));
          
          return vec4f(color, 1.0);
        }
      `,
      entryPoints: { fragment: 'main' }
    });
  }
}
