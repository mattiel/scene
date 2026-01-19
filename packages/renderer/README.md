# @scene/renderer

WebGPU rendering foundation for Scene engine.

## Features

- **WebGPUContext**: GPU adapter/device initialization with availability detection and graceful degradation
- **QuadRenderer**: Efficient rendering of textured quads for DOM surfaces
- **ScreenPass**: Fullscreen post-processing pipeline for screen effects
- **ShaderLibrary**: WGSL shader management with built-in effects
- **Browser Detection**: Safari/iOS detection utilities for platform-specific handling

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome/Edge | 113+ | ✅ Full support |
| Firefox | 121+ | ✅ Full support |
| Safari (macOS) | 17+ | ✅ Full support |
| iOS Safari | 17.4+ | ✅ Full support |
| iOS Safari | 17.0-17.3 | ⚠️ Requires feature flag |
| iOS Safari | 16- | ❌ Not supported |

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

## Browser Detection

The renderer provides utilities for detecting Safari/iOS for platform-specific handling:

```typescript
import { WebGPUContext } from '@scene/renderer';

// Static method - can be called without initialization
const browser = WebGPUContext.detectBrowser();

console.log(browser.isSafari);     // true for Safari
console.log(browser.isIOS);        // true for iPhone/iPad
console.log(browser.isIOSSafari);  // true for Safari on iOS
console.log(browser.isMobile);     // true for mobile devices
console.log(browser.iosVersion);   // { major: 17, minor: 4 } or null

// Check expected WebGPU support
const support = WebGPUContext.checkExpectedSupport();
if (!support.supported) {
  console.warn(support.reason);
  // e.g., "iOS 16.5 does not support WebGPU. iOS 17+ required."
}
```

## Capabilities Detection

After initialization, you can query WebGPU capabilities:

```typescript
const context = new WebGPUContext();
await context.initialize({ canvas });

if (context.capabilities) {
  // Useful for debugging Safari-specific behavior
  console.log('Preferred format:', context.capabilities.preferredFormat);
  // Safari: 'bgra8unorm', Chrome: 'rgba8unorm'
  
  console.log('Max texture size:', context.capabilities.maxTextureDimension2D);
  console.log('Features:', context.capabilities.features);
}
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
