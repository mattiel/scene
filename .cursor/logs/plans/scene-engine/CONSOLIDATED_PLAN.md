# Scene Engine Consolidated Plan

> **Updated:** January 20, 2026  
> **Branch:** feat/phase-8-carousel-polish  
> **Author:** Mattie Lee

---

## Design Philosophy

**Primitives over implementations.** Scene provides composable building blocks, not specific implementations. Inspired by motion library.

**Progressive enhancement.** Library evolves through real implementations. When demos reveal gaps in primitives, we enhance the library—not work around limitations. See `@enhancement` rule.

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
| @scene/react | SceneProvider, useScene, useSurface, useMotion, useMaterial, useScreenEffect, useSurfaceEffect, useTransition, useScrollable, useDraggable, useMotionBridge |

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

## Phase 8: Controller Primitives Enhancement ✅

**Package:** `@scene/controllers`

**Status:** COMPLETE

### Completed Tasks

1. **Scrollable Enhancements** ✅
   - [x] `getState(): State1D` for snapshot
   - [x] `useSpringSnap` + `snapSpring` options for spring physics
   - [x] `rubberband` + `rubberbandFactor` options for overscroll resistance
   - [x] Velocity tracking with sample window
   - [x] `direction: 'horizontal' | 'vertical'` hint for a11y

2. **Draggable Enhancements** ✅
   - [x] `getState(): State2D` for snapshot
   - [x] Grid snapping support (`grid`, `gridSnapMode`)
   - [x] Scale constraints (`scaleConstraints`)
   - [x] Velocity tracking with sample window

3. **Shared Improvements** ✅
   - [x] `prefersReducedMotion()` auto-detection
   - [x] `onReducedMotionChange()` subscription helper
   - [x] TypeScript inference via function overloads

---

## Phase 9: Motion System Polish ✅

**Package:** `@scene/motion`

**Status:** COMPLETE

### Completed Tasks

1. **Motion Bridge** ✅
   - [x] `MotionValueAdapter` class for two-way sync
   - [x] `createMotionValue()` factory function
   - [x] `fromMotionValue()` reverse adapter
   - [x] `useMotionBridge()` React hook
   - [x] `useMotionBridgeMany()` for multiple values
   - [x] `useMotionBridgeWithState()` for React state sync

2. **SceneValue Utilities** ✅
   - [x] `SceneValue.mix()` - blend between values (static & dynamic ratio)
   - [x] `SceneValue.clamp()` - derived clamped value
   - [x] `SceneValue.snap()` - snap to nearest value in array
   - [x] `MultiSourceDerivedSceneValue` for multi-source derives

---

## Phase 10: Geometry & Materials System ✅

**Package:** `@scene/renderer`

**Status:** COMPLETE

### Completed Tasks

1. **Geometry System** ✅
   - [x] `CircleGeometry` with segments, theta range, pie helper
   - [x] `RingGeometry` with inner/outer radius, progress helper
   - [x] `MorphGeometry` with morph targets, weights, apply()
   - [x] Helper functions: `createScaleMorphTarget`, `createOffsetMorphTarget`, `createBulgeMorphTarget`
   - [x] Normal calculation in all geometries

2. **Material System** ✅
   - [x] `StandardMaterial` with color, opacity, texture, normal map, emissive
   - [x] Material blending modes in base Material class
   - [x] Factory functions: `createColorMaterial`, `createTexturedMaterial`, `createEmissiveMaterial`

3. **Mesh Rendering** ✅
   - [x] `MeshRenderer` for batch rendering
   - [x] Multiple sort modes: none, front-to-back, back-to-front, by-material, by-render-order
   - [x] `renderOpaque()` and `renderTransparent()` helpers
   - [x] Render statistics tracking

---

## Phase 11: Surface Effects Pipeline ✅

**Package:** `@scene/surfaces`

**Status:** COMPLETE

### Completed Tasks

1. **Surface Effects** ✅
   - [x] `SurfaceEffect` interface with init, apply, destroy lifecycle
   - [x] `BaseSurfaceEffect` base class with common functionality
   - [x] `SurfaceEffectStack` for per-surface effect management
   - [x] Built-in effects: blur, glow, distort, refract, ripple, pixelate

2. **DOM Sync** ✅
   - [x] `LayoutTracker` with precise rect tracking
   - [x] `TransformUtils` with CSS transform decomposition
   - [x] Mutation batching in surface registry

3. **GhostSurface Enhancement** ✅
   - [x] `GhostPool` for texture caching and ghost pooling
   - [x] `cacheTexture()` / `getTexture()` / `releaseTexture()` API
   - [x] `acquire()` / `release()` for ghost pooling
   - [x] `createMorphGhost()` for interpolated ghost transitions

---

## Phase 12: Advanced Screen Effects ✅

**Package:** `@scene/screen`

**Status:** COMPLETE

### Completed Tasks

1. **New Effects** ✅
   - [x] `DepthOfFieldEffect` with focus point, range, bokeh
   - [x] `MotionBlurEffect` with velocity-based blur, samples
   - [x] `FilmGrainEffect` with intensity, luminance response, presets
   - [x] `ColorGradingEffect` with lift/gamma/gain, temperature, tint, presets

2. **Transition Library** ✅
   - [x] Multiple transition types: dissolve, slide, zoom, fade
   - [x] `TransitionTimeline` for sequenced transitions
   - [x] `Easings` library with 16 easing functions
   - [x] Factory functions: `createDissolveTimeline`, `createSlideFadeTimeline`, etc.

3. **Effect Composition** ✅
   - [x] `ConditionalEffectStack` with conditions, dependencies, groups
   - [x] `RenderTargetPool` for texture pooling
   - [x] Effect priority sorting
   - [x] Group enable/disable/toggle

---

## Phase 13: Input System Expansion ✅

**Package:** `@scene/input`

**Status:** COMPLETE

### Completed Tasks

1. **Multi-touch** ✅
   - [x] Track multiple pointers simultaneously via `MultiTouch` class
   - [x] Add pinch/rotate gesture detection with scale/rotation deltas
   - [x] Support touch pressure/tilt/twist via extended `NormalizedPointer`

2. **Gestures** ✅
   - [x] Create `GestureRecognizer` class
   - [x] Built-in gestures: tap, doubleTap, longPress, swipe (with direction)
   - [x] Custom gesture definition API via `registerGesture()`

3. **Developer Tools** ✅
   - [x] `InputVisualizer` - debug overlay showing touch points, trails, gesture labels
   - [x] `InputRecorder` - recording/playback with serialize/deserialize
   - [x] Touch simulation: `createTap()`, `createDrag()`, `createPinch()` helpers

### New Exports

- `MultiTouch`, `TouchPoint`, `MultiTouchState`, `MultiTouchCallbacks`, `MultiTouchOptions`
- `GestureRecognizer`, `GestureEvent`, `SwipeDirection`, `CustomGestureDefinition`
- `InputRecorder`, `InputRecording`, `PlaybackCallbacks`, `PlaybackOptions`
- `InputVisualizer`, `InputVisualizerOptions`

### New InputManager Intents

- `multiTouchStart`, `multiTouchMove`, `multiTouchEnd` - multi-touch lifecycle
- `pinch`, `rotate` - two-finger gesture events
- `gesture` - recognized discrete gestures (tap, swipe, longPress, etc.)

---

## Phase 14: React Framework Polish ✅

**Package:** `@scene/react`

**Status:** COMPLETE

### Completed Tasks

1. **Core Hooks** ✅
   - [x] Improved `useMotion()` - event-based animation tracking, reduced polling
   - [x] Improved `useSurface()` - declarative surface registration
   - [x] Improved `useMaterial()` - optimized initialization detection

2. **Effect Hooks** ✅
   - [x] `useScreenEffect()` - add/remove screen effects with enable/disable/toggle
   - [x] `useScreenEffects()` - batch multiple screen effects
   - [x] `useSurfaceEffect()` - per-surface effects (blur, glow, distort, etc.)
   - [x] `useSurfaceEffects()` - batch multiple surface effects
   - [x] `useTransition()` - navigation transition control with state machine
   - [x] `useTransitionStyle()` - transition-aware CSS styles
   - [x] `useStaggeredTransition()` - coordinated multi-element transitions

3. **Controller Hooks** ✅
   - [x] `useScrollable()` - React hook for 1D scroll/drag with snap, bounds, inertia
   - [x] `useDraggable()` - React hook for 2D drag with constraints, inertia

4. **Motion Bridge** ✅
   - [x] `useMotionBridge()` - SceneValue ↔ MotionValue sync
   - [x] `useMotionBridgeMany()` - batch multiple bridges
   - [x] `useMotionBridgeWithState()` - bridge with React state tracking

### Framework Integration (Deferred)
Framework examples (Next.js, Remix) deferred to documentation phase.

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

### All Phases Complete ✅

1. Phase 8: Controller Primitives Enhancement ✅
2. Phase 9: Motion System Polish ✅
3. Phase 10: Geometry & Materials System ✅
4. Phase 11: Surface Effects Pipeline ✅
5. Phase 12: Advanced Screen Effects ✅
6. Phase 13: Input System Expansion ✅
7. Phase 14: React Framework Polish ✅
8. Phase 15: Documentation & Examples ✅
   - Motion primitives demo (springs, derived values, 2D motion)
   - Scrollable primitive demo (bounds, snap, inertia, wheel)
   - Draggable primitive demo (bounds, axis, grid, inertia)
   - Package READMEs updated with API docs
   - Website demos index updated

**Status: v0.1.0 feature-complete. Ready for production polish and v1.0.0 release.**

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
- Demos drive library evolution (gap → enhance → compose)

---

## Demo Strategy

Demos live in `website/` and showcase **composition** of primitives:

| Demo | Primitives Used |
|------|-----------------|
| Carousel | Scrollable + snap + PlaneGeometry + BendDeformation |
| Gallery | Draggable + bounds + zoom |
| Slider | Scrollable + bounds + SceneValue.interpolate |
| Page Transitions | TransitionCoordinator + screen effects |

Demos are **not** part of the library—they demonstrate how users compose primitives.

### Enhancement Workflow

When building demos reveals missing primitive capabilities:

1. **Identify** - Document gap: what's missing, why it's needed
2. **Evaluate** - Is it reusable (2+ implementations)? If yes, enhance library
3. **Enhance** - Add to appropriate package via domain rule (`@webgpu`, `@surfaces`, etc.)
4. **Compose** - Update demo to use new primitive, no workarounds

Example: If carousel needs velocity-aware opacity that `SceneValue` doesn't support → enhance `@scene/motion` with the capability → carousel uses it via composition.

---

## Version Milestones

| Version | Contents |
|---------|----------|
| v0.1.0 | Core engine + all packages (current) |
| v0.2.0 | Controller/motion polish |
| v0.3.0 | Surface effects + screen enhancements |
| v1.0.0 | Production-ready with full documentation |
