# @scene/motion

Motion library integration layer for Scene engine. Bridges [Motion](https://motion.dev) (successor to Framer Motion) with Scene's render loop and uniform system.

## Features

- **SceneValue**: Animated values that sync with Scene uniforms
- **Spring presets**: Pre-configured spring physics for common UI patterns
- **Frame sync**: Bridges Motion's frame API with Scene's RAFScheduler

## Installation

```bash
pnpm add @scene/motion motion
```

## Usage

### Basic Animation

```typescript
import { SceneValue } from '@scene/motion';

// Create an animated value
const offset = new SceneValue(0);

// Animate with spring physics
offset.animateTo(500, { type: 'spring', stiffness: 300, damping: 30 });

// Subscribe to changes
offset.on('change', (value) => {
  material.setUniform('offset', value);
});
```

### Binding to Materials

```typescript
// Bind directly to a material uniform
offset.bindTo(material, 'offset');

// Value changes automatically sync to the uniform
offset.animateTo(100);
```

### Spring Presets

```typescript
import { springs } from '@scene/motion';

// Use pre-configured spring presets
offset.animateTo(500, springs.snappy);
offset.animateTo(500, springs.smooth);
offset.animateTo(500, springs.bouncy);
```

### Frame Synchronization

```typescript
import { syncFrame } from '@scene/motion';
import { RAFScheduler } from '@scene/core';

// Bridge Motion's frame loop with Scene's scheduler
const scheduler = new RAFScheduler();
syncFrame(scheduler);
```

## API Reference

### SceneValue

An animated value that integrates with Scene's render loop.

- `new SceneValue(initial)` - Create a new animated value
- `value.get()` - Get current value
- `value.set(v)` - Set value immediately
- `value.animateTo(target, options)` - Animate to target value
- `value.on('change', callback)` - Subscribe to value changes
- `value.bindTo(material, uniform)` - Bind to a material uniform
- `value.destroy()` - Clean up subscriptions and animations

### Springs

Pre-configured spring presets:

- `springs.default` - Balanced spring (stiffness: 300, damping: 30)
- `springs.snappy` - Quick, responsive (stiffness: 500, damping: 35)
- `springs.smooth` - Gentle, smooth (stiffness: 200, damping: 25)
- `springs.bouncy` - Playful bounce (stiffness: 400, damping: 15)
- `springs.stiff` - Very quick (stiffness: 700, damping: 40)
- `springs.slow` - Deliberate (stiffness: 100, damping: 20)
