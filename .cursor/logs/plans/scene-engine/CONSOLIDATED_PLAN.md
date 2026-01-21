# Scene Engine Consolidated Plan

> **Consolidation Date:** January 20, 2026  
> **Branch:** feat/phase-1-motion-materials  
> **Author:** Mattie Lee

---

## Release Workflow

### Step 1: Commit Current Work
```bash
git add .
git commit -m "feat: add motion, controllers, and react packages with carousel refactor"
git push origin feat/phase-1-motion-materials
```

### Step 2: Create PR & Merge
```bash
gh pr create --title "feat: Phase 1 motion materials and carousel refactor" \
  --body "Adds @scene/motion, @scene/controllers, @scene/react packages. Refactors carousel to user-level demo."
# After review, merge to main
```

### Step 3: Start Fresh Branch
```bash
git checkout main
git pull origin main
git checkout -b feat/phase-8-carousel-polish
```

---

## Current State Summary

### Completed Phases (1-7) ✅

| Phase | Package | Status |
|-------|---------|--------|
| 1 | @scene/core | Engine, EventBus, RAFScheduler |
| 2 | @scene/renderer | WebGPUContext, QuadRenderer, ShaderLibrary |
| 3 | @scene/surfaces | SurfaceRegistry, LayoutTracker, GhostSurface |
| 4 | @scene/screen | EffectStack, TransitionShaders |
| 5 | @scene/input | PointerManager, Inertia, Picking |
| 6 | @scene/navigation | TransitionCoordinator |
| 7 | @scene/a11y | DOMMirror, FocusSync, LiveAnnouncer |

### New Packages (In Progress)

| Package | Purpose | Status |
|---------|---------|--------|
| @scene/motion | SceneValue, springs, Motion bridge | ✅ Implemented |
| @scene/controllers | Scrollable, Draggable | ✅ Implemented |
| @scene/react | SceneProvider, hooks | ✅ Implemented |

### Worktree Consolidation

The following worktrees have been reviewed and consolidated:

- **feat/phase-1-motion-materials** (HEAD): Contains all new work
- **feat/navigation-review-fixes**: Bug fixes merged into main
- **da68e7c (phase-8-final-tests)**: Tests consolidated
- **72315f1 (phase-5-input)**: Historical checkpoint, no pending work

---

## Part 1: Deep Carousel Refactor

### Current Architecture

```
website/src/lib/carousel/
├── Carousel.ts          # Item-based controller (uses Scrollable)
├── CarouselRenderer.ts  # WebGPU 3D card renderer
├── useCarousel.ts       # React hook
└── index.ts
```

The carousel was moved from `@scene/renderer` to the website as a **user-level implementation** demonstrating how to build with Scene primitives.

### Phase 8A: Carousel API Refinement

**Goals:**
- Clean separation between controller logic and rendering
- Type-safe event system
- Better integration with @scene/motion

**Tasks:**

1. **Controller Layer Cleanup**
   - [ ] Extract shared types to `@scene/controllers/types`
   - [ ] Add generic `CarouselController<T>` interface
   - [ ] Standardize event payload shapes across controllers
   - [ ] Add `Carousel.bindToSceneValue()` for offset syncing

2. **Renderer Abstraction**
   - [ ] Create `CarouselRendererBase` interface in @scene/renderer
   - [ ] Document shader uniform contract (model, bend, opacity, ripple)
   - [ ] Add deformation presets: `bend`, `wave`, `fabric`, `ripple`

3. **React Integration**
   - [ ] Add `useCarouselRenderer` hook
   - [ ] Create `<CarouselCanvas />` component with automatic lifecycle
   - [ ] Add `useCarouselA11y` hook for accessibility mirror

### Phase 8B: GPU Effects Enhancement

**Goals:**
- More sophisticated deformations
- Unified global state for fabric-like effects
- Performance optimization

**Tasks:**

1. **Deformation System**
   - [ ] Move deformations to `@scene/renderer/deformations/`
   - [ ] Implement `DeformationStack` (composable deformations)
   - [ ] Add presets: `FabricDeformation`, `WaveDeformation`, `BendDeformation`

2. **Global Uniform Manager**
   - [ ] Create `GlobalUniformBuffer` for shared state
   - [ ] Support world-space wave calculations
   - [ ] Add scroll ripple as a built-in global effect

3. **Performance**
   - [ ] Add geometry LOD (16 vs 32 vs 64 segments based on deformation intensity)
   - [ ] Implement frustum culling for off-screen cards
   - [ ] Add texture atlas support for card textures

### Phase 8C: Carousel Demo Polish

**Goals:**
- Production-ready demo experience
- Mobile touch support
- Full accessibility

**Tasks:**

1. **Touch & Input**
   - [ ] Improve touch gesture recognition (swipe vs drag)
   - [ ] Add momentum threshold tuning for mobile
   - [ ] Support pinch-to-zoom on expanded card

2. **Visual Polish**
   - [ ] Add shadow/glow effect on center card
   - [ ] Implement depth-of-field blur on distant cards
   - [ ] Add particle effects on card tap

3. **Accessibility**
   - [ ] Full keyboard navigation (arrows, Enter, Escape, Home, End)
   - [ ] Screen reader announcements for card changes
   - [ ] Reduced motion mode with graceful fallback

---

## Part 2: Scene Library Enhancement

### Phase 9: Motion System Maturity

**Package:** `@scene/motion`

**Goals:**
- First-class animation primitives
- Seamless integration with Motion library
- GPU uniform binding

**Tasks:**

1. **SceneValue Enhancements**
   - [ ] Add `SceneValue.derive()` for computed values
   - [ ] Add `SceneValue.interpolate()` for range mapping
   - [ ] Support velocity tracking for physics-based effects

2. **Spring Presets**
   - [ ] Expand spring library: `springs.bounce`, `springs.rubber`, `springs.stiff`
   - [ ] Add `springs.fromPreset(name)` with named presets
   - [ ] Document spring parameter guidelines

3. **Motion Bridge**
   - [ ] Create `createMotionValue()` adapter for Motion MotionValue
   - [ ] Two-way sync between SceneValue and MotionValue
   - [ ] Add `useMotionBridge()` React hook

### Phase 10: Geometry & Materials System

**Package:** `@scene/renderer`

**Goals:**
- Flexible geometry primitives
- Material abstraction layer
- Shader composition

**Implemented:**
- ✅ `Geometry` base class with `BufferAttribute`
- ✅ `PlaneGeometry` with configurable segments
- ✅ `Material` base class
- ✅ `ShaderMaterial` for custom shaders
- ✅ `Mesh` combining geometry + material

**Tasks:**

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

### Phase 11: Surface Effects Pipeline

**Package:** `@scene/surfaces`

**Goals:**
- Per-surface GPU effects
- Effect composition
- DOM-GPU synchronization

**Tasks:**

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

### Phase 12: Advanced Screen Effects

**Package:** `@scene/screen`

**Goals:**
- Cinematic post-processing
- Transition library
- Effect composition

**Tasks:**

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

### Phase 13: Input System Expansion

**Package:** `@scene/input`

**Goals:**
- Multi-touch support
- Gesture recognition
- Input recording/playback

**Tasks:**

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

### Phase 14: React Framework Polish

**Package:** `@scene/react`

**Goals:**
- Complete hook library
- Server component compatibility
- DevTools integration

**Tasks:**

1. **Core Hooks**
   - [ ] `useMotion()` - connect SceneValue to component state
   - [ ] `useSurface()` - declarative surface registration
   - [ ] `useMaterial()` - material creation and lifecycle

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
├─────────────────────────────────────────────────────────────────┤
│  @scene/react                                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │SceneProvider│ │ useScene()  │ │ useSurface()│ ...           │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
├─────────────────────────────────────────────────────────────────┤
│  @scene/controllers                    @scene/motion            │
│  ┌─────────────┐ ┌─────────────┐      ┌─────────────┐          │
│  │ Scrollable  │ │ Draggable   │      │ SceneValue  │          │
│  └─────────────┘ └─────────────┘      │  springs    │          │
│                                        └─────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│  @scene/core                                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │   Engine    │ │  EventBus   │ │RAFScheduler │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
├─────────────────────────────────────────────────────────────────┤
│  @scene/surfaces        @scene/input        @scene/a11y        │
│  ┌──────────────┐      ┌──────────────┐    ┌──────────────┐    │
│  │SurfaceRegistry│      │PointerManager│    │ A11yManager  │    │
│  │LayoutTracker │      │   Picking    │    │  DOMMirror   │    │
│  │ GhostSurface │      │   Inertia    │    │  FocusSync   │    │
│  └──────────────┘      └──────────────┘    └──────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  @scene/renderer                      @scene/screen             │
│  ┌──────────────┐ ┌──────────────┐   ┌──────────────┐          │
│  │WebGPUContext │ │ Geometry     │   │ EffectStack  │          │
│  │ QuadRenderer │ │ Material     │   │TransitionShader│         │
│  │ShaderLibrary │ │ Mesh         │   │ScreenEffects │          │
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

### Immediate (This Week)
1. Phase 8A: Carousel API Refinement
2. Phase 9: Motion System Maturity (core features)

### Short-term (Next 2 Weeks)
3. Phase 8B: GPU Effects Enhancement
4. Phase 10: Geometry & Materials System
5. Phase 8C: Carousel Demo Polish

### Medium-term (Month 2)
6. Phase 11: Surface Effects Pipeline
7. Phase 12: Advanced Screen Effects
8. Phase 14: React Framework Polish

### Long-term (Month 3+)
9. Phase 13: Input System Expansion
10. Documentation & Examples

---

## Success Metrics

### Technical
- 60fps on mid-range mobile devices
- < 2ms per frame for controller updates
- < 5ms GPU render time for 10-card carousel
- 0 layout thrashing from DOM sync

### API Quality
- Type-safe events and callbacks
- Consistent naming conventions
- Comprehensive JSDoc comments
- Working examples for each feature

### Demo Quality
- Smooth touch interactions
- Accessible via keyboard + screen reader
- Graceful degradation without WebGPU
- Production-ready visual polish

---

## Notes

### Worktree Status

✅ All stale worktrees have been pruned. Only the main workspace remains:
```
/Users/mattie/Dev/scene  [feat/phase-1-motion-materials]
```

### Branch Strategy

- `main`: Stable releases only
- `feat/phase-*`: Feature development
- `fix/*`: Bug fixes
- `chore/*`: Maintenance tasks

### Next Branch After Merge

After merging `feat/phase-1-motion-materials` to main:

```bash
git checkout -b feat/phase-8-carousel-polish
```

This branch will focus on:
- Phase 8A: Carousel API Refinement
- Phase 8B: GPU Effects Enhancement
- Phase 8C: Carousel Demo Polish

### Version Milestones

| Version | Contents |
|---------|----------|
| v0.1.0 | Core engine + all packages (after this merge) |
| v0.2.0 | Carousel polish + motion maturity |
| v0.3.0 | Surface effects + screen enhancements |
| v1.0.0 | Production-ready with full documentation |
