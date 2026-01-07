# @scene/renderer

WebGPU rendering foundation for Scene engine.

## Features

- **WebGPUContext**: GPU adapter/device initialization with availability detection and graceful degradation
- **QuadRenderer**: Efficient rendering of textured quads for DOM surfaces
- **ScreenPass**: Fullscreen post-processing pipeline for screen effects
- **ShaderLibrary**: WGSL shader management with built-in effects

## Graceful Degradation

The renderer automatically detects WebGPU availability and degrades gracefully when not supported:

```typescript
const context = new WebGPUContext();
const isAvailable = await context.initialize({ canvas });

if (!isAvailable) {
  // Scene will continue to work, but without GPU rendering
  console.log('WebGPU not available - running in degraded mode');
}
```

## Usage

### Initialize WebGPU Context

```typescript
import { WebGPUContext } from '@scene/renderer';

const canvas = document.createElement('canvas');
const context = new WebGPUContext();

await context.initialize({
  canvas,
  powerPreference: 'high-performance'
});

if (context.isAvailable) {
  console.log('WebGPU ready');
}
```

### Set Up Shader Library

```typescript
import { ShaderLibrary } from '@scene/renderer';

const shaderLibrary = new ShaderLibrary();
shaderLibrary.setDevice(context.device);
shaderLibrary.registerDefaults(); // Register built-in shaders
```

### Render Quads

```typescript
import { QuadRenderer } from '@scene/renderer';

const quadRenderer = new QuadRenderer(context, shaderLibrary);
quadRenderer.initialize();

// Create bind group for texture
const bindGroup = quadRenderer.createBindGroup(texture);

// Render
const commandEncoder = context.device.createCommandEncoder();
quadRenderer.renderQuad(commandEncoder, bindGroup);
context.device.queue.submit([commandEncoder.finish()]);
```

### Post-Processing Effects

```typescript
import { ScreenPass } from '@scene/renderer';

const screenPass = new ScreenPass(context, shaderLibrary);
screenPass.initialize();

// Create blur effect
const blurParams = new Float32Array([
  1.0, 0.0, // direction (horizontal)
  2.0,      // strength
  0.0       // padding
]);

const blurEffect = screenPass.createEffect({
  shaderName: 'blur_fragment',
  uniformData: blurParams
});

// Execute effect
const commandEncoder = context.device.createCommandEncoder();
screenPass.execute(commandEncoder, blurEffect, sourceTexture);
context.device.queue.submit([commandEncoder.finish()]);
```

## Built-in Shaders

The ShaderLibrary includes these default shaders:

- `passthrough_vertex` - Basic vertex shader
- `textured_quad` - Textured quad fragment shader
- `fullscreen_vertex` - Fullscreen quad vertex shader
- `copy_fragment` - Simple copy/passthrough
- `blur_fragment` - Gaussian blur
- `chromatic_aberration_fragment` - RGB channel offset
- `vignette_fragment` - Edge darkening

## Architecture

```
WebGPUContext
├─ Manages adapter/device
├─ Canvas configuration
└─ Availability detection

ShaderLibrary
├─ Shader compilation
├─ Shader caching
└─ Built-in effects

QuadRenderer
├─ Vertex/index buffers
├─ Textured quad pipeline
└─ Instanced rendering support

ScreenPass
├─ Fullscreen post-processing
├─ Effect stacking
└─ Intermediate textures
```

## Device Lost Handling

The WebGPUContext automatically handles device lost events:

```typescript
context.device.lost.then((info) => {
  console.error('GPU device lost:', info.reason);
  // Re-initialization handled automatically
});
```

## Canvas Sizing

The context handles device pixel ratio for retina displays:

```typescript
context.resize(window.innerWidth, window.innerHeight);
// Automatically scales by devicePixelRatio
```
