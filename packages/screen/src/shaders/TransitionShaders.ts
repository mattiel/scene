/**
 * TransitionShaders
 *
 * WGSL shader definitions for navigation transitions.
 * These shaders blend between two textures based on progress.
 */

import type { ShaderModule } from '@scene/renderer';

/**
 * Dissolve transition shader - crossfade between two textures
 */
export const dissolveShader: ShaderModule = {
  code: `
    @group(0) @binding(0) var textureSampler: sampler;
    @group(0) @binding(1) var textureFrom: texture_2d<f32>;
    @group(0) @binding(2) var textureTo: texture_2d<f32>;
    
    struct TransitionParams {
      progress: f32,
      _padding0: f32,
      _padding1: f32,
      _padding2: f32,
    };
    
    @group(0) @binding(3) var<uniform> params: TransitionParams;

    @fragment
    fn main(
      @location(0) uv: vec2f
    ) -> @location(0) vec4f {
      let colorFrom: vec4f = textureSample(textureFrom, textureSampler, uv);
      let colorTo: vec4f = textureSample(textureTo, textureSampler, uv);
      
      return mix(colorFrom, colorTo, params.progress);
    }
  `,
  entryPoints: { fragment: 'main' },
};

/**
 * Wipe transition shader - horizontal wipe from left to right
 */
export const wipeShader: ShaderModule = {
  code: `
    @group(0) @binding(0) var textureSampler: sampler;
    @group(0) @binding(1) var textureFrom: texture_2d<f32>;
    @group(0) @binding(2) var textureTo: texture_2d<f32>;
    
    struct TransitionParams {
      progress: f32,
      softness: f32,
      direction: f32, // 0 = left-to-right, 1 = right-to-left, 2 = top-to-bottom, 3 = bottom-to-top
      _padding: f32,
    };
    
    @group(0) @binding(3) var<uniform> params: TransitionParams;

    @fragment
    fn main(
      @location(0) uv: vec2f
    ) -> @location(0) vec4f {
      let colorFrom: vec4f = textureSample(textureFrom, textureSampler, uv);
      let colorTo: vec4f = textureSample(textureTo, textureSampler, uv);
      
      var coord: f32;
      if (params.direction < 0.5) {
        // Left to right
        coord = uv.x;
      } else if (params.direction < 1.5) {
        // Right to left
        coord = 1.0 - uv.x;
      } else if (params.direction < 2.5) {
        // Top to bottom
        coord = uv.y;
      } else {
        // Bottom to top
        coord = 1.0 - uv.y;
      }
      
      // Ensure minimum softness to avoid smoothstep undefined behavior when low >= high
      let softness: f32 = max(params.softness, 0.0001);
      let edge: f32 = params.progress * (1.0 + softness);
      let t: f32 = smoothstep(edge - softness, edge, coord);
      
      return mix(colorTo, colorFrom, t);
    }
  `,
  entryPoints: { fragment: 'main' },
};

/**
 * Fade to black transition shader
 */
export const fadeToBlackShader: ShaderModule = {
  code: `
    @group(0) @binding(0) var textureSampler: sampler;
    @group(0) @binding(1) var textureFrom: texture_2d<f32>;
    @group(0) @binding(2) var textureTo: texture_2d<f32>;
    
    struct TransitionParams {
      progress: f32,
      _padding0: f32,
      _padding1: f32,
      _padding2: f32,
    };
    
    @group(0) @binding(3) var<uniform> params: TransitionParams;

    @fragment
    fn main(
      @location(0) uv: vec2f
    ) -> @location(0) vec4f {
      let colorFrom: vec4f = textureSample(textureFrom, textureSampler, uv);
      let colorTo: vec4f = textureSample(textureTo, textureSampler, uv);
      
      // First half: fade from source to black
      // Second half: fade from black to destination
      let black: vec4f = vec4f(0.0, 0.0, 0.0, 1.0);
      
      if (params.progress < 0.5) {
        let t: f32 = params.progress * 2.0;
        return mix(colorFrom, black, t);
      } else {
        let t: f32 = (params.progress - 0.5) * 2.0;
        return mix(black, colorTo, t);
      }
    }
  `,
  entryPoints: { fragment: 'main' },
};

/**
 * Zoom transition shader - zoom out from source, zoom in to destination
 */
export const zoomShader: ShaderModule = {
  code: `
    @group(0) @binding(0) var textureSampler: sampler;
    @group(0) @binding(1) var textureFrom: texture_2d<f32>;
    @group(0) @binding(2) var textureTo: texture_2d<f32>;
    
    struct TransitionParams {
      progress: f32,
      zoomAmount: f32,
      _padding0: f32,
      _padding1: f32,
    };
    
    @group(0) @binding(3) var<uniform> params: TransitionParams;

    @fragment
    fn main(
      @location(0) uv: vec2f
    ) -> @location(0) vec4f {
      let center: vec2f = vec2f(0.5, 0.5);
      
      // Source: starts normal, zooms OUT (shrinks into distance) as progress increases
      let zoomFrom: f32 = 1.0 + params.progress * params.zoomAmount;
      let uvFrom: vec2f = (uv - center) * zoomFrom + center;
      
      // Destination: starts zoomed OUT (small/distant), zooms IN (grows to normal) as progress increases
      let zoomTo: f32 = 1.0 + (1.0 - params.progress) * params.zoomAmount;
      let uvTo: vec2f = (uv - center) * zoomTo + center;
      
      let colorFrom: vec4f = textureSample(textureFrom, textureSampler, uvFrom);
      let colorTo: vec4f = textureSample(textureTo, textureSampler, uvTo);
      
      // Apply alpha based on UV bounds
      var alphaFrom: f32 = 1.0;
      var alphaTo: f32 = 1.0;
      
      if (uvFrom.x < 0.0 || uvFrom.x > 1.0 || uvFrom.y < 0.0 || uvFrom.y > 1.0) {
        alphaFrom = 0.0;
      }
      if (uvTo.x < 0.0 || uvTo.x > 1.0 || uvTo.y < 0.0 || uvTo.y > 1.0) {
        alphaTo = 0.0;
      }
      
      // Handle edge cases: when one texture is out of bounds, show the other at full intensity
      if (alphaFrom == 0.0) {
        return colorTo * alphaTo;
      }
      if (alphaTo == 0.0) {
        return colorFrom * alphaFrom;
      }
      
      // Both textures are in bounds: blend based on progress
      return mix(colorFrom, colorTo, params.progress);
    }
  `,
  entryPoints: { fragment: 'main' },
};

/**
 * All transition shaders for registration
 */
export const transitionShaders: Record<string, ShaderModule> = {
  transition_dissolve: dissolveShader,
  transition_wipe: wipeShader,
  transition_fade_to_black: fadeToBlackShader,
  transition_zoom: zoomShader,
};

/**
 * Register all transition shaders with a ShaderLibrary
 */
export function registerTransitionShaders(shaderLibrary: {
  register: (name: string, shader: ShaderModule) => void;
}): void {
  for (const [name, shader] of Object.entries(transitionShaders)) {
    shaderLibrary.register(name, shader);
  }
}
