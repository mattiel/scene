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
      
      // Weighted blend with normalization to handle out-of-bounds cases
      // When one texture is out of bounds, the other shows at full intensity
      let weightFrom: f32 = alphaFrom * (1.0 - params.progress);
      let weightTo: f32 = alphaTo * params.progress;
      let totalWeight: f32 = weightFrom + weightTo;
      
      if (totalWeight > 0.0) {
        return (colorFrom * weightFrom + colorTo * weightTo) / totalWeight;
      } else {
        return vec4f(0.0, 0.0, 0.0, 1.0);
      }
    }
  `,
  entryPoints: { fragment: 'main' },
};

/**
 * Slide transition shader - slide new content in from a direction
 */
export const slideShader: ShaderModule = {
  code: `
    @group(0) @binding(0) var textureSampler: sampler;
    @group(0) @binding(1) var textureFrom: texture_2d<f32>;
    @group(0) @binding(2) var textureTo: texture_2d<f32>;
    
    struct TransitionParams {
      progress: f32,
      direction: f32, // 0 = left, 1 = right, 2 = up, 3 = down
      _padding0: f32,
      _padding1: f32,
    };
    
    @group(0) @binding(3) var<uniform> params: TransitionParams;

    @fragment
    fn main(
      @location(0) uv: vec2f
    ) -> @location(0) vec4f {
      var offset: vec2f;
      
      if (params.direction < 0.5) {
        // From left
        offset = vec2f(params.progress, 0.0);
      } else if (params.direction < 1.5) {
        // From right
        offset = vec2f(-params.progress, 0.0);
      } else if (params.direction < 2.5) {
        // From top
        offset = vec2f(0.0, params.progress);
      } else {
        // From bottom
        offset = vec2f(0.0, -params.progress);
      }
      
      let uvFrom: vec2f = uv + offset;
      let uvTo: vec2f = uv + offset - sign(offset);
      
      // Check bounds
      if (uvFrom.x >= 0.0 && uvFrom.x <= 1.0 && uvFrom.y >= 0.0 && uvFrom.y <= 1.0) {
        return textureSample(textureFrom, textureSampler, uvFrom);
      } else if (uvTo.x >= 0.0 && uvTo.x <= 1.0 && uvTo.y >= 0.0 && uvTo.y <= 1.0) {
        return textureSample(textureTo, textureSampler, uvTo);
      }
      
      return vec4f(0.0, 0.0, 0.0, 1.0);
    }
  `,
  entryPoints: { fragment: 'main' },
};

/**
 * Flip transition shader - 3D card flip effect
 */
export const flipShader: ShaderModule = {
  code: `
    @group(0) @binding(0) var textureSampler: sampler;
    @group(0) @binding(1) var textureFrom: texture_2d<f32>;
    @group(0) @binding(2) var textureTo: texture_2d<f32>;
    
    struct TransitionParams {
      progress: f32,
      axis: f32, // 0 = horizontal, 1 = vertical
      _padding0: f32,
      _padding1: f32,
    };
    
    @group(0) @binding(3) var<uniform> params: TransitionParams;

    @fragment
    fn main(
      @location(0) uv: vec2f
    ) -> @location(0) vec4f {
      let PI: f32 = 3.14159265359;
      let angle: f32 = params.progress * PI;
      
      var coord: f32;
      if (params.axis < 0.5) {
        coord = uv.x - 0.5;
      } else {
        coord = uv.y - 0.5;
      }
      
      // Apply perspective distortion
      let scale: f32 = abs(cos(angle));
      let perspective: f32 = 1.0 + (1.0 - scale) * 0.5;
      
      var newCoord: f32 = coord / (scale * perspective);
      
      // Check if visible
      if (abs(newCoord) > 0.5) {
        return vec4f(0.0, 0.0, 0.0, 1.0);
      }
      
      newCoord += 0.5;
      
      var sampleUV: vec2f;
      if (params.axis < 0.5) {
        sampleUV = vec2f(newCoord, uv.y);
      } else {
        sampleUV = vec2f(uv.x, newCoord);
      }
      
      // First half shows front, second half shows back
      if (params.progress < 0.5) {
        let color: vec4f = textureSample(textureFrom, textureSampler, sampleUV);
        return vec4f(color.rgb * scale, color.a);
      } else {
        // Mirror UV for back side
        if (params.axis < 0.5) {
          sampleUV.x = 1.0 - sampleUV.x;
        } else {
          sampleUV.y = 1.0 - sampleUV.y;
        }
        let color: vec4f = textureSample(textureTo, textureSampler, sampleUV);
        return vec4f(color.rgb * scale, color.a);
      }
    }
  `,
  entryPoints: { fragment: 'main' },
};

/**
 * Cube transition shader - 3D cube rotation
 */
export const cubeShader: ShaderModule = {
  code: `
    @group(0) @binding(0) var textureSampler: sampler;
    @group(0) @binding(1) var textureFrom: texture_2d<f32>;
    @group(0) @binding(2) var textureTo: texture_2d<f32>;
    
    struct TransitionParams {
      progress: f32,
      direction: f32, // 0 = left, 1 = right
      depth: f32,
      _padding: f32,
    };
    
    @group(0) @binding(3) var<uniform> params: TransitionParams;

    @fragment
    fn main(
      @location(0) uv: vec2f
    ) -> @location(0) vec4f {
      let PI: f32 = 3.14159265359;
      let angle: f32 = params.progress * PI * 0.5;
      
      let dir: f32 = select(1.0, -1.0, params.direction < 0.5);
      
      // Calculate which face we're on
      let x: f32 = uv.x - 0.5;
      let rotatedX: f32 = x * cos(angle * dir) - params.depth * sin(angle * dir);
      
      // Front face
      let frontX: f32 = rotatedX / cos(angle * dir) + 0.5;
      // Side face
      let sideOffset: f32 = select(0.0, 1.0, params.direction < 0.5);
      let sideX: f32 = (x + sin(angle * dir) * params.depth) / sin(angle * dir) + sideOffset;
      
      // Determine visibility
      let showFront: bool = frontX >= 0.0 && frontX <= 1.0 && cos(angle) > 0.0;
      let showSide: bool = sideX >= 0.0 && sideX <= 1.0 && sin(angle * dir) * dir > 0.0;
      
      if (showFront) {
        let frontUV: vec2f = vec2f(frontX, uv.y);
        let shade: f32 = 0.8 + 0.2 * cos(angle);
        let color: vec4f = textureSample(textureFrom, textureSampler, frontUV);
        return vec4f(color.rgb * shade, color.a);
      } else if (showSide) {
        let sideUV: vec2f = vec2f(sideX, uv.y);
        let shade: f32 = 0.6 + 0.4 * sin(angle * dir) * dir;
        let color: vec4f = textureSample(textureTo, textureSampler, sideUV);
        return vec4f(color.rgb * shade, color.a);
      }
      
      return vec4f(0.0, 0.0, 0.0, 1.0);
    }
  `,
  entryPoints: { fragment: 'main' },
};

/**
 * Morph transition shader - pixel displacement morphing
 */
export const morphShader: ShaderModule = {
  code: `
    @group(0) @binding(0) var textureSampler: sampler;
    @group(0) @binding(1) var textureFrom: texture_2d<f32>;
    @group(0) @binding(2) var textureTo: texture_2d<f32>;
    
    struct TransitionParams {
      progress: f32,
      strength: f32,
      _padding0: f32,
      _padding1: f32,
    };
    
    @group(0) @binding(3) var<uniform> params: TransitionParams;
    
    fn hash(p: vec2f) -> vec2f {
      var p3: vec3f = fract(vec3f(p.xyx) * vec3f(0.1031, 0.1030, 0.0973));
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.xx + p3.yz) * p3.zy);
    }

    @fragment
    fn main(
      @location(0) uv: vec2f
    ) -> @location(0) vec4f {
      // Create displacement based on position
      let noise: vec2f = hash(uv * 10.0) * 2.0 - 1.0;
      let displacement: vec2f = noise * params.strength * params.progress * (1.0 - params.progress) * 4.0;
      
      let uvFrom: vec2f = uv + displacement * (1.0 - params.progress);
      let uvTo: vec2f = uv - displacement * params.progress;
      
      let colorFrom: vec4f = textureSample(textureFrom, textureSampler, clamp(uvFrom, vec2f(0.0), vec2f(1.0)));
      let colorTo: vec4f = textureSample(textureTo, textureSampler, clamp(uvTo, vec2f(0.0), vec2f(1.0)));
      
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
  transition_slide: slideShader,
  transition_flip: flipShader,
  transition_cube: cubeShader,
  transition_morph: morphShader,
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
