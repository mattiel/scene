# Scene Engine Consolidated Plan

> **Updated:** January 20, 2026  
> **Branch:** feat/phase-8-carousel-polish  
> **Author:** Mattie Lee

---

## Design Philosophy

**Primitives over implementations.** Scene provides composable building blocks, not specific implementations. Inspired by motion library.

| Library Provides | Users Compose |
|------------------|---------------|
| `Scrollable` | Carousels, sliders, pickers |
| `Draggable` | Pan viewers, sortable lists, resize handles |
| `SceneValue` | Progress bars, scroll-linked animations |
| Geometry, Material, Mesh | Custom 3D card renderers, effects |
| Deformations | Bend, wave, ripple effects |

---

## Current State Summary

### Completed Packages ✅

| Package | Contents |
|---------|----------|
| @scene/core | Engine, EventBus, RAFScheduler |
| @scene/renderer | WebGPUContext, QuadRenderer, ShaderLibrary, Geometry, Materials, Mesh, Deformations |
| @scene/surfaces | SurfaceRegistry, LayoutTracker, GhostSurface |
| @scene/screen | EffectStack, TransitionShaders, BlurEffect, VignetteEffect |
| @scene/input | PointerManager, Inertia, Picking |
| @scene/navigation | TransitionCoordinator |
| @scene/a11y | A11yManager, DOMMirror, FocusSync, LiveAnnouncer |
| @scene/motion | SceneValue, DerivedSceneValue, springs (15 presets), Motion bridge |
| @scene/controllers | Scrollable, Draggable (generic primitives) |
| @scene/react | SceneProvider, useScene, useSurface, useMotion, useMaterial |

### Recent Additions (Phase 8/9)

**@scene/motion enhancements:**
- ✅ `SceneValue.derive()` - computed values
- ✅ `SceneValue.interpolate()` - range mapping
- ✅ Velocity tracking with `trackVelocity` option
- ✅ 10 new spring presets: bounce, rubber, rigid, settle, wobbly, heavy, light, snap, fluid, crisp
- ✅ `fromPreset()` helper function

**@scene/controllers refactor:**
- ✅ Generic types: Point, Velocity2D, Bounds1D, Bounds2D
- ✅ Configuration types: SnapConfig, InertiaConfig
- ✅ State types: State1D, State2D
- ✅ Removed carousel-specific types (user-level concern)

---

## Phase 8: Controller Primitives Enhancement

**Package:** `@scene/controllers`

**Goals:**
- Rock-solid primitives for building any scroll/drag interaction
- Performance optimized for 60fps
- Full accessibility support

### Tasks

1. **Scrollable Enhancements**
   - [ ] Add `getState(): State1D` for snapshot
   - [ ] Add `spring` option to use spring physics for snap
   - [ ] Add `rubberband` option for overscroll resistance
   - [ ] Improve velocity calculation accuracy
   - [ ] Add `direction: 'horizontal' | 'vertical'` hint for a11y

2. **Draggable Enhancements**
   - [ ] Add `getState(): State2D` for snapshot
   - [ ] Add grid snapping support
   - [ ] Add rotation support (optional)
   - [ ] Add scale constraints
   - [ ] Improve touch gesture handling

3. **Shared Improvements**
   - [ ] Add `reducedMotion` auto-detection from OS
   - [ ] Add debug mode with velocity visualization
   - [ ] Improve TypeScript inference for event callbacks

---

## Phase 9: Motion System Polish

**Package:** `@scene/motion`

**Goals:**
- Seamless integration with Motion library
- GPU uniform binding patterns
- Developer ergonomics

### Tasks

1. **Motion Bridge**
   - [ ] `createMotionValue()` adapter for Motion MotionValue
   - [ ] Two-way sync between SceneValue and MotionValue
   - [ ] `useMotionBridge()` React hook

2. **SceneValue Utilities**
   - [ ] `SceneValue.mix()` - blend between values
   - [ ] `SceneValue.clamp()` - runtime bounds
   - [ ] `SceneValue.snap()` - snap to nearest value in array

3. **Documentation**
   - [ ] Spring parameter guidelines
   - [ ] Common animation patterns
   - [ ] GPU uniform binding examples

---

## Phase 10: Geometry & Materials System

**Package:** `@scene/renderer`

**Goals:**
- Flexible geometry primitives
- Material abstraction layer
- Shader composition

**Already Implemented:**
- ✅ `Geometry` base class with `BufferAttribute`
- ✅ `PlaneGeometry` with configurable segments
- ✅ `Material` base class
- ✅ `ShaderMaterial` for custom shaders
- ✅ `Mesh` combining geometry + material
- ✅ Deformations: Bend, Wave, Ripple

### Tasks

1. **Geometry System**
   - [ ] Add `CircleGeometry`, `RingGeometry`
   - [ ] Implement `MorphGeometry` for animated meshes
   - [ ] Add normal/tangent calculation utilities

2. **Material System**
   - [ ] Create `StandardMaterial` with common uniforms
   - [ ] Add material blending modes
   - [ ] Implement material instancing

3. **Mesh Rendering**
   - [ ] Add `MeshRenderer` for efficient batch rendering
   - [ ] Support instanced rendering
   - [ ] Add mesh sorting (back-to-front for transparency)

---

## Phase 11: Surface Effects Pipeline

**Package:** `@scene/surfaces`

**Goals:**
- Per-surface GPU effects
- Effect composition
- DOM-GPU synchronization

### Tasks

1. **Surface Effects**
   - [ ] Add `Surface.addEffect(effect)` API
   - [ ] Implement effect stack per surface
   - [ ] Built-in effects: `blur`, `glow`, `distort`, `refract`

2. **DOM Sync**
   - [ ] Improve layout tracking precision
   - [ ] Add mutation batching for performance
   - [ ] Support CSS transform decomposition

3. **GhostSurface Enhancement**
   - [ ] Add texture caching for repeated ghosts
   - [ ] Implement ghost pooling
   - [ ] Add ghost morphing between states

---

## Phase 12: Advanced Screen Effects

**Package:** `@scene/screen`

**Goals:**
- Cinematic post-processing
- Transition library
- Effect composition

### Tasks

1. **New Effects**
   - [ ] Depth of field (configurable focus plane)
   - [ ] Motion blur (velocity-based)
   - [ ] Film grain (noise texture)
   - [ ] Color grading (LUT support)

2. **Transition Library**
   - [ ] Expand transitions: `slide`, `flip`, `cube`, `morph`
   - [ ] Add `TransitionTimeline` for sequenced effects
   - [ ] Support custom transition shaders

3. **Effect Composition**
   - [ ] Add effect dependencies
   - [ ] Implement render target pooling
   - [ ] Add conditional effect execution

---

## Phase 13: Input System Expansion

**Package:** `@scene/input`

**Goals:**
- Multi-touch support
- Gesture recognition
- Input recording/playback

### Tasks

1. **Multi-touch**
   - [ ] Track multiple pointers simultaneously
   - [ ] Add pinch/rotate gesture detection
   - [ ] Support touch pressure/tilt where available

2. **Gestures**
   - [ ] Create `GestureRecognizer` class
   - [ ] Built-in gestures: swipe, pinch, rotate, long-press
   - [ ] Custom gesture definition API

3. **Developer Tools**
   - [ ] Add input visualization overlay
   - [ ] Implement input recording/playback
   - [ ] Add touch simulation for testing

---

## Phase 14: React Framework Polish

**Package:** `@scene/react`

**Goals:**
- Complete hook library
- Server component compatibility
- DevTools integration

### Tasks

1. **Core Hooks**
   - [ ] Improve `useMotion()` - connect SceneValue to component state
   - [ ] Improve `useSurface()` - declarative surface registration
   - [ ] Improve `useMaterial()` - material creation and lifecycle

2. **Effect Hooks**
   - [ ] `useScreenEffect()` - add/remove screen effects
   - [ ] `useSurfaceEffect()` - per-surface effects
   - [ ] `useTransition()` - navigation transition control

3. **Framework Integration**
   - [ ] Add Next.js example with App Router
   - [ ] Add Remix example
   - [ ] Document SSR considerations

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Application                         │
│  (Carousels, Sliders, Galleries - composed from primitives)    │
├─────────────────────────────────────────────────────────────────┤
│  @scene/react                                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │SceneProvider│ │ useScene()  │ │ useSurface()│ ...           │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
├─────────────────────────────────────────────────────────────────┤
│  @scene/controllers                    @scene/motion            │
│  ┌─────────────┐ ┌─────────────┐      ┌─────────────┐          │
│  │ Scrollable  │ │ Draggable   │      │ SceneValue  │          │
│  │ (primitive) │ │ (primitive) │      │ springs     │          │
│  └─────────────┘ └─────────────┘      └─────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│  @scene/core                                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │   Engine    │ │  EventBus   │ │RAFScheduler │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
├─────────────────────────────────────────────────────────────────┤
│  @scene/surfaces        @scene/input        @scene/a11y        │
│  ┌──────────────┐      ┌──────────────┐    ┌──────────────┐    │
│  │SurfaceRegistry│      │PointerManager│    │ A11yManager  │    │
│  │ LayoutTracker │      │   Picking    │    │  DOMMirror   │    │
│  │ GhostSurface │      │   Inertia    │    │  FocusSync   │    │
│  └──────────────┘      └──────────────┘    └──────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  @scene/renderer                      @scene/screen             │
│  ┌──────────────┐ ┌──────────────┐   ┌──────────────┐          │
│  │WebGPUContext │ │ Geometry     │   │ EffectStack  │          │
│  │ QuadRenderer │ │ Material     │   │TransitionShader│         │
│  │ShaderLibrary │ │ Mesh         │   │ ScreenEffects │          │
│  │ Deformations │ │              │   │              │          │
│  └──────────────┘ └──────────────┘   └──────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│  @scene/navigation                                              │
│  ┌──────────────────────┐                                      │
│  │ TransitionCoordinator│                                       │
│  └──────────────────────┘                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Priority Order

### Immediate
1. Phase 8: Controller Primitives Enhancement
2. Phase 9: Motion System Polish

### Short-term
3. Phase 10: Geometry & Materials System
4. Phase 11: Surface Effects Pipeline

### Medium-term
5. Phase 12: Advanced Screen Effects
6. Phase 14: React Framework Polish

### Long-term
7. Phase 13: Input System Expansion
8. Documentation & Examples

---

## Success Metrics

### Technical
- 60fps on mid-range mobile devices
- < 2ms per frame for controller updates
- < 5ms GPU render time for complex scenes
- 0 layout thrashing from DOM sync

### API Quality
- Type-safe events and callbacks
- Consistent naming conventions
- Comprehensive JSDoc comments
- Working examples for each primitive

### Composability
- Any interaction buildable from primitives
- Clear separation: library vs user code
- No implementation-specific types in library

---

## Demo Strategy

Demos live in `website/` and showcase **composition** of primitives:

| Demo | Primitives Used |
|------|-----------------|
| Carousel | Scrollable + snap + PlaneGeometry + BendDeformation |
| Gallery | Draggable + bounds + zoom |
| Slider | Scrollable + bounds + SceneValue.interpolate |
| Page Transitions | TransitionCoordinator + screen effects |

Demos are **not** part of the library - they demonstrate how users compose primitives.

---

## Version Milestones

| Version | Contents |
|---------|----------|
| v0.1.0 | Core engine + all packages (current) |
| v0.2.0 | Controller/motion polish |
| v0.3.0 | Surface effects + screen enhancements |
| v1.0.0 | Production-ready with full documentation |
