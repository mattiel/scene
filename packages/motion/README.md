# @scene/motion

Motion library integration layer for Scene engine. Bridges [Motion](https://motion.dev) (successor to Framer Motion) with Scene's render loop and uniform system.

## Features

- **SceneValue**: Animated values that sync with Scene uniforms
- **Spring presets**: 20+ pre-configured spring physics for common UI patterns
- **Derived values**: `derive()`, `interpolate()`, `mix()`, `clamp()`, `snap()`
- **MotionValue bridge**: Two-way sync with Motion's MotionValue for React
- **Frame sync**: Bridges Motion's frame API with Scene's RAFScheduler

## Installation

```bash
pnpm add @scene/motion motion
```

## Quick Start

```typescript
import { SceneValue, springs } from '@scene/motion';

// Create an animated value
const offset = new SceneValue(0);

// Bind to GPU uniform
offset.bindTo(material, 'uOffset');

// Animate with spring physics
offset.animateTo(500, springs.snappy);
```

---

## SceneValue

The core animated value type that drives Scene animations.

### Creating Values

```typescript
import { SceneValue, createSceneValue } from '@scene/motion';

// Basic creation
const value = new SceneValue(0);

// With options
const clamped = new SceneValue(50, {
  clamp: { min: 0, max: 100 },  // Clamp during set()
  round: true,                   // Round to integers
  trackVelocity: true,           // Enable velocity tracking
});

// Factory function
const offset = createSceneValue(0, { clamp: { min: 0, max: 1000 } });
```

### Animating

```typescript
import { springs, tweens } from '@scene/motion';

// Spring animation (recommended)
value.animateTo(100, springs.snappy);

// Relative animation
value.animateBy(50, springs.bouncy);

// Tween animation (duration-based)
value.animateTo(100, { duration: 0.3, ease: 'easeOut' });

// Stop animation
value.stop();

// Check if animating
if (value.isAnimating) { /* ... */ }
```

### Subscribing to Changes

```typescript
// Subscribe to value changes
const unsubscribe = value.on('change', (v) => {
  console.log('New value:', v);
});

// Subscribe to velocity (requires trackVelocity option)
const unsubVelocity = value.onVelocityChange((velocity) => {
  console.log('Velocity:', velocity);
});

// Clean up
unsubscribe();
```

### Derived Values

Create computed values that automatically update when the source changes.

```typescript
const scroll = new SceneValue(0);

// Basic derive
const doubled = scroll.derive(v => v * 2);
const progress = scroll.derive(v => v / maxScroll);

// Interpolate between ranges
const opacity = scroll.interpolate({
  inputRange: [0, 500],
  outputRange: [1, 0],
  clamp: true,
});

// Clamp to bounds
const bounded = scroll.clamp(0, 1000);

// Snap to nearest value
const snapped = scroll.snap([0, 100, 200, 300]);

// Mix two values
const start = new SceneValue(0);
const end = new SceneValue(100);
const mixed = start.mix(end, 0.5); // → 50

// Dynamic mix with SceneValue ratio
const ratio = new SceneValue(0);
const blended = start.mix(end, ratio);
ratio.animateTo(1); // blended goes 0 → 100
```

---

## Spring Presets

Pre-configured spring physics for common UI patterns.

### Available Presets

| Preset | Stiffness | Damping | Mass | Use Case |
|--------|-----------|---------|------|----------|
| `default` | 300 | 30 | 1 | General purpose |
| `snappy` | 500 | 35 | 1 | Toggles, tabs |
| `smooth` | 200 | 25 | 1 | Page transitions |
| `bouncy` | 400 | 15 | 1 | Attention-grabbing |
| `stiff` | 700 | 40 | 1 | Micro-interactions |
| `slow` | 100 | 20 | 1 | Background effects |
| `carousel` | 350 | 30 | 1 | Card swiping |
| `inertia` | 150 | 25 | 1 | Momentum scrolling |
| `material` | 400 | 35 | 1 | Android-style |
| `ios` | 500 | 30 | 1 | iOS-style |
| `bounce` | 450 | 10 | 1 | Maximum overshoot |
| `rubber` | 200 | 12 | 0.8 | Elastic overscroll |
| `rigid` | 1000 | 50 | 1 | Near-instant |
| `settle` | 180 | 22 | 1 | Soft landing |
| `wobbly` | 300 | 8 | 1 | Jelly-like |
| `heavy` | 300 | 35 | 2 | Weighty feel |
| `light` | 400 | 25 | 0.5 | Airy, responsive |
| `snap` | 600 | 45 | 1 | Sharp snap |
| `fluid` | 250 | 28 | 1 | Liquid-like |
| `crisp` | 550 | 38 | 1 | Clean, professional |

### Spring Parameter Guidelines

Understanding how spring parameters affect motion:

**Stiffness** (100-1000)
- Higher = faster animation, more "springy"
- Lower = slower, more relaxed motion
- Recommended: 200-500 for UI, 100-200 for background effects

**Damping** (10-50)
- Higher = less oscillation, more controlled
- Lower = more bounce and overshoot
- For no overshoot: damping ≈ 2 × √stiffness

**Mass** (0.5-2)
- Higher = more inertia, "heavier" feel
- Lower = more responsive, "lighter" feel
- Default 1 works for most cases

### Custom Springs

```typescript
import { createSpring } from '@scene/motion';

// Create custom spring
const mySpring = createSpring(450, 25, 1.2);
value.animateTo(100, mySpring);

// Dynamic preset selection
import { fromPreset, type SpringPreset } from '@scene/motion';

const presetName: SpringPreset = userPrefersPlayful ? 'wobbly' : 'crisp';
value.animateTo(100, fromPreset(presetName));
```

---

## GPU Uniform Binding

Scene's primary use case: driving GPU shader uniforms with animated values.

### Basic Binding

```typescript
const offset = new SceneValue(0);

// Bind to material uniform
const unbind = offset.bindTo(material, 'uOffset');

// All changes automatically sync to GPU
offset.animateTo(500, springs.snappy);

// Unbind when done
unbind();

// Or unbind all at once
offset.unbindAll();
```

### Derived Values for Shaders

```typescript
// Create a base value
const scroll = new SceneValue(0);

// Derive multiple shader inputs from one source
const progress = scroll.interpolate({
  inputRange: [0, 1000],
  outputRange: [0, 1],
  clamp: true,
});

const bendAmount = progress.derive(p => p * 0.3);
const distortion = progress.derive(p => Math.sin(p * Math.PI) * 0.5);

// Bind all to material
progress.bindTo(material, 'uProgress');
bendAmount.bindTo(material, 'uBend');
distortion.bindTo(material, 'uDistortion');

// Animating scroll drives all shader uniforms
scroll.animateTo(1000, springs.smooth);
```

### Performance Considerations

```typescript
// ✅ Good: One SceneValue, multiple derived bindings
const master = new SceneValue(0);
const derived1 = master.derive(v => v * 2);
const derived2 = master.derive(v => 1 - v);

// ❌ Avoid: Multiple independent SceneValues for related animations
const value1 = new SceneValue(0);
const value2 = new SceneValue(0);
// Now you have to keep them in sync manually

// ✅ Good: Batch updates by animating source
master.animateTo(1); // Updates all derived at once

// ✅ Good: Clean up when component unmounts
const unbind1 = derived1.bindTo(material, 'u1');
const unbind2 = derived2.bindTo(material, 'u2');

// Later:
unbind1();
unbind2();
master.destroy(); // Cleans up all derived values too
```

---

## Motion Library Bridge

Two-way sync between SceneValue and Motion's MotionValue for React integration.

### Basic Bridge

```typescript
import { SceneValue, createMotionValue, springs } from '@scene/motion';
import { motion } from 'motion/react';

// Create SceneValue for GPU
const offset = new SceneValue(0);
offset.bindTo(material, 'uOffset');

// Create MotionValue that syncs with it
const mv = createMotionValue(offset);

// Use in React component
function AnimatedCard() {
  return <motion.div style={{ x: mv }}>Card</motion.div>;
}

// Animate SceneValue - both GPU and DOM update
offset.animateTo(200, springs.snappy);
```

### From Existing MotionValue

```typescript
import { useMotionValue } from 'motion/react';
import { fromMotionValue } from '@scene/motion';

function GestureEffect({ material }) {
  const x = useMotionValue(0);
  
  // Create SceneValue synced to gesture
  const sceneX = fromMotionValue(x);
  sceneX.bindTo(material, 'uOffsetX');
  
  return <motion.div style={{ x }} drag />;
}
```

### React Hooks

```tsx
import { useMotionBridge, useMotionBridgeMany } from '@scene/react';

// Single value
function AnimatedElement({ sceneValue }) {
  const x = useMotionBridge(sceneValue);
  return <motion.div style={{ x }} />;
}

// Multiple values
function ComplexAnimation({ values }) {
  const { x, y, scale } = useMotionBridgeMany({
    x: values.offsetX,
    y: values.offsetY,
    scale: values.zoom,
  });
  
  return <motion.div style={{ x, y, scale }} />;
}

// With React state tracking
function AnimatedProgress({ sceneValue }) {
  const { motionValue, value } = useMotionBridgeWithState(sceneValue);
  
  return (
    <div>
      <motion.div style={{ scaleX: motionValue }} />
      <span>{Math.round(value * 100)}%</span>
    </div>
  );
}
```

---

## Common Animation Patterns

### Scroll-Linked Animation

```typescript
const scrollY = new SceneValue(0);

// Map scroll to multiple effects
const parallax = scrollY.derive(v => v * 0.5);
const fade = scrollY.interpolate({
  inputRange: [0, 300],
  outputRange: [1, 0],
  clamp: true,
});
const blur = scrollY.interpolate({
  inputRange: [0, 200],
  outputRange: [0, 10],
  clamp: true,
});

// Update on scroll
window.addEventListener('scroll', () => {
  scrollY.set(window.scrollY);
});
```

### Gesture-Driven Motion

```typescript
const dragX = new SceneValue(0, { trackVelocity: true });

// React to velocity for momentum effects
dragX.onVelocityChange((velocity) => {
  const tiltAmount = Math.min(Math.max(velocity / 1000, -1), 1);
  material.setUniform('uTilt', tiltAmount);
});

// Snap to positions after drag
function onDragEnd() {
  const snapped = dragX.snap([0, 100, 200, 300]);
  dragX.animateTo(snapped.get(), springs.snap);
}
```

### Sequenced Animations

```typescript
async function animateSequence() {
  const value = new SceneValue(0);
  
  // Chain animations with await
  await value.animateTo(100, springs.snappy);
  await value.animateTo(50, springs.bouncy);
  await value.animateTo(75, springs.smooth);
}

// Staggered animations
function staggerCards(cards: SceneValue[], target: number) {
  cards.forEach((card, i) => {
    setTimeout(() => {
      card.animateTo(target, springs.snappy);
    }, i * 50);
  });
}
```

### Cross-Fade / Morph

```typescript
const stateA = new SceneValue(1);
const stateB = new SceneValue(0);

// Create blend ratio
const blend = new SceneValue(0);

// Mix states based on blend
const current = stateA.mix(stateB, blend);
current.bindTo(material, 'uState');

// Transition between states
function transitionToB() {
  blend.animateTo(1, springs.smooth);
}
```

---

## API Reference

### SceneValue

| Method | Description |
|--------|-------------|
| `new SceneValue(initial, options?)` | Create animated value |
| `get()` | Get current value |
| `set(value)` | Set immediately |
| `animateTo(target, config?)` | Animate to target |
| `animateBy(delta, config?)` | Animate by relative amount |
| `stop()` | Stop animation |
| `on('change', callback)` | Subscribe to changes |
| `onVelocityChange(callback)` | Subscribe to velocity |
| `bindTo(target, uniform)` | Bind to material |
| `derive(fn)` | Create derived value |
| `interpolate(options)` | Map to range |
| `mix(other, ratio)` | Blend with another value |
| `clamp(min, max)` | Create clamped view |
| `snap(values)` | Snap to nearest |
| `destroy()` | Clean up |

### MotionValueAdapter

| Function | Description |
|----------|-------------|
| `createMotionValue(sceneValue)` | Create synced MotionValue |
| `fromMotionValue(mv, options?)` | Create SceneValue from MotionValue |
| `hasAdapter(mv)` | Check if has adapter |
| `destroyAdapter(value)` | Clean up adapter |

### Springs

| Preset | Description |
|--------|-------------|
| `springs.default` | General purpose |
| `springs.snappy` | Quick, responsive |
| `springs.smooth` | Gentle transitions |
| `springs.bouncy` | Playful bounce |
| `springs.carousel` | Card swiping |
| `springs.snap` | Sharp deceleration |
| See table above for all 20 presets |
