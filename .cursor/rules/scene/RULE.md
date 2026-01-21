---
description: "Scene context - DOM-first cinematic effects engine using WebGPU"
alwaysApply: true
---

# Scene

You are working on **Scene**, a DOM-first cinematic effects engine for the web.

## Core Design Principles (Non-Negotiable)

1. **DOM is canonical** - All content, text, links, and semantics live in the DOM. Accessibility and SEO must work without Scene.
2. **GPU is visual-only** - WebGPU is used for distortion, refraction, noise, post-processing. No GPU text rendering. No GPU-owned semantics.
3. **Motion controls time** - Scene does not own easing or timelines. Motion values drive transitions, progress, intensities.
4. **Router-agnostic** - Scene never imports a router. Navigation is a host concern.
5. **Primitives over implementations** - Library provides composable building blocks (Scrollable, Draggable, SceneValue), not specific implementations (carousels, sliders). Users compose primitives. Inspired by motion library.

## Key References

Always consult these files for project context:
- `@SCENE_SPEC.md` - Full product and engineering specification
- `@.cursor/logs/plans/scene-engine/CONSOLIDATED_PLAN.md` - Implementation phases and architecture

## Package Structure

```
packages/
├─ core/        # Engine, EventBus, RAFScheduler
├─ renderer/    # WebGPU context, Geometry, Materials, Mesh, Deformations
├─ surfaces/    # SurfaceRegistry, LayoutTracker, GhostSurface
├─ screen/      # EffectStack, TransitionShaders
├─ input/       # PointerManager, Inertia, Picking
├─ navigation/  # TransitionCoordinator
├─ a11y/        # DOMMirror, FocusSync, LiveAnnouncer
├─ motion/      # SceneValue, springs, Motion bridge
├─ controllers/ # Scrollable, Draggable (generic primitives)
└─ react/       # SceneProvider, hooks
```

## Library vs User Code

**Library provides primitives:**
- `Scrollable` - 1D scroll/drag with bounds, snap, inertia
- `Draggable` - 2D drag with constraints, inertia
- `SceneValue` - Animated values with derive/interpolate
- Geometry, Material, Mesh, Deformations

**Users compose implementations:**
- Carousels = Scrollable + snap points + item rendering
- Sliders = Scrollable + bounds + value mapping
- Galleries = Draggable + grid constraints + zoom
- Custom interactions = primitives + domain logic

## Interaction Modes

- **Mode A (DOM-Interactive)**: Canvas has `pointer-events: none`. DOM handles all interaction.
- **Mode B (Canvas-Interactive)**: Canvas has `pointer-events: auto`. Scene owns pointer input.

## Domain Rule Reference

| Task | Rule |
|------|------|
| WebGPU/shaders/rendering | `@webgpu` |
| Surface tracking/DOM sync | `@surfaces` |
| Pointer/picking/inertia | `@input` |
| Accessibility/keyboard | `@a11y` |
| Create/refine rules | `@ruler` |

## Graceful Degradation

When WebGPU is unavailable:
- Scene still mounts and tracks DOM
- Skip GPU rendering entirely
- Motion callbacks still fire
- Expose `scene.isGPUEnabled` flag
