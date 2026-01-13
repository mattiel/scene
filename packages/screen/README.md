# @scene/screen

Screen effects and transitions for the Scene engine. Provides a high-level API for managing post-processing effects and navigation transitions.

## Features

- **EffectStack**: Ordered management of post-processing effects
- **Built-in Effects**: Blur, Vignette, Chromatic Aberration
- **Transitions**: Dissolve, Wipe, Fade to Black, Zoom
- **Extensible**: Create custom effects using the base classes

## Installation

```bash
pnpm add @scene/screen
```

## Usage

### Basic Effect Stack

```typescript
import { WebGPUContext, ShaderLibrary, ScreenPass } from '@scene/renderer';
import {
  EffectStack,
  createBlurEffect,
  createVignetteEffect,
  registerTransitionShaders,
} from '@scene/screen';

// Initialize renderer components
const context = new WebGPUContext();
await context.initialize({ canvas });

const shaderLibrary = new ShaderLibrary();
shaderLibrary.setDevice(context.device!);
shaderLibrary.registerDefaults();
registerTransitionShaders(shaderLibrary);

const screenPass = new ScreenPass(context, shaderLibrary);
screenPass.initialize();

// Create effect stack
const effectStack = new EffectStack(screenPass);
effectStack.initialize();

// Register effect factories
effectStack.registerFactory('blur', createBlurEffect);
effectStack.registerFactory('vignette', createVignetteEffect);

// Add effects
const blur = effectStack.add({ type: 'blur', params: { strength: 2 } });
const vignette = effectStack.add({ type: 'vignette' });

// Execute in render loop
effectStack.execute(commandEncoder, sourceTexture, targetTexture);
```

### Individual Effects

```typescript
import { BlurEffect, VignetteEffect } from '@scene/screen';

// Create blur effect directly
const blur = new BlurEffect('blur1', screenPass, {
  directionX: 1,
  directionY: 0,
  strength: 3,
});

// Use presets
blur.horizontal();  // Horizontal blur
blur.vertical();    // Vertical blur

// Create vignette
const vignette = new VignetteEffect('vignette1', screenPass);
vignette.cinematic(); // Apply cinematic preset
```

### Navigation Transitions

```typescript
import { TransitionEffect, registerTransitionShaders } from '@scene/screen';

// Register transition shaders first
registerTransitionShaders(shaderLibrary);

// Create transition
const transition = new TransitionEffect(context, shaderLibrary, {
  type: 'dissolve',
  duration: 500,
});
transition.initialize();

// Animate transition
function animate(progress: number) {
  transition.setProgress(progress);
  
  const commandEncoder = device.createCommandEncoder();
  transition.execute(commandEncoder, oldTexture, newTexture);
  device.queue.submit([commandEncoder.finish()]);
}
```

### Transition Types

- **dissolve**: Crossfade between two textures
- **wipe**: Directional wipe (left, right, top, bottom)
- **fade_to_black**: Fade out to black, then in from black
- **zoom**: Zoom out from source, zoom into destination

```typescript
// Wipe transition with custom direction
const wipe = new TransitionEffect(context, shaderLibrary, {
  type: 'wipe',
  wipeDirection: 'left-to-right',
  wipeSoftness: 0.1,
});

// Zoom transition
const zoom = new TransitionEffect(context, shaderLibrary, {
  type: 'zoom',
  zoomAmount: 0.3,
});
```

## API Reference

### EffectStack

| Method | Description |
|--------|-------------|
| `initialize()` | Initialize the effect stack |
| `registerFactory(type, factory)` | Register an effect factory |
| `add(config)` | Add an effect to the stack |
| `remove(id)` | Remove an effect |
| `get(id)` | Get effect by ID |
| `enable(id)` / `disable(id)` | Toggle effect |
| `reorder(id, index)` | Change effect order |
| `execute(encoder, source, target)` | Execute all enabled effects |

### Effect Parameters

**BlurEffect**
- `directionX`, `directionY`: Blur direction (0-1)
- `strength`: Blur radius

**VignetteEffect**
- `strength`: Intensity (0-1)
- `radius`: Start radius from center
- `softness`: Edge softness

**ChromaticAberrationEffect**
- `strength`: Aberration amount (0.001-0.05 typical)

### TransitionEffect

| Method | Description |
|--------|-------------|
| `initialize()` | Initialize the transition |
| `setProgress(0-1)` | Set transition progress |
| `execute(encoder, from, to, target)` | Render transition |
| `setType(type)` | Change transition type |
| `configure(config)` | Update configuration |

## Dependencies

- `@scene/renderer` - WebGPU context and ScreenPass
