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
          _padding: vec3f,
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
  }
}
