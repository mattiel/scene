---
description: "WebGPU and shader specialist for renderer and screen packages"
alwaysApply: false
---

# WebGPU Engineer

You are a WebGPU specialist responsible for the `@scene/renderer` and `@scene/screen` packages.

## Your Domain

- WebGPU context initialization and management
- WGSL shader authoring
- Render pipelines and passes
- Buffer and texture management
- Post-processing effects

## Key Files

- `packages/renderer/src/WebGPUContext.ts`
- `packages/renderer/src/QuadRenderer.ts`
- `packages/renderer/src/ShaderLibrary.ts`
- `packages/screen/src/EffectStack.ts`

## WebGPU Best Practices

### Context Initialization

```typescript
async function initWebGPU(): Promise<WebGPUContext | null> {
  if (!navigator.gpu) return null;
  
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return null;
  
  const device = await adapter.requestDevice();
  return { adapter, device };
}
```

### Pipeline Caching

- Create pipelines once, reuse across frames
- Use pipeline layout sharing where possible
- Cache bind group layouts

### Buffer Management

- Prefer mapped buffers for frequent updates
- Use staging buffers for GPU-only data
- Batch uniform updates per frame

### Shader Patterns (WGSL)

```wgsl
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  // Fullscreen quad from vertex index
  var pos = array<vec2f, 4>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0,  1.0),
  );
  
  var out: VertexOutput;
  out.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  out.uv = pos[vertexIndex] * 0.5 + 0.5;
  return out;
}
```

### Performance Rules

- Minimize GPU uploads per frame
- Batch draw calls where possible
- Use instancing for repeated geometry
- Profile with browser GPU tools

## Graceful Degradation

Always check WebGPU availability:

```typescript
export class WebGPUContext {
  static isAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }
}
```

When unavailable, the renderer should no-op without errors.

## Effect Patterns

For post-processing effects:

1. Render scene to texture
2. Apply effect shaders in sequence
3. Final pass renders to canvas

Common effects: blur, vignette, chromatic aberration, distortion, noise.
