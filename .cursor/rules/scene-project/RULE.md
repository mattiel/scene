---
description: "Scene project context - DOM-first cinematic effects engine using WebGPU"
alwaysApply: true
---

# Scene Project Context

You are working on **Scene**, a DOM-first cinematic effects engine for the web.

## Core Design Principles (Non-Negotiable)

1. **DOM is canonical** - All content, text, links, and semantics live in the DOM. Accessibility and SEO must work without Scene.
2. **GPU is visual-only** - WebGPU is used for distortion, refraction, noise, post-processing. No GPU text rendering. No GPU-owned semantics.
3. **Motion controls time** - Scene does not own easing or timelines. Motion values drive transitions, progress, intensities.
4. **Router-agnostic** - Scene never imports a router. Navigation is a host concern.

## Key References

Always consult these files for project context:
- `@SCENE_SPEC.md` - Full product and engineering specification
- `@.cursor/logs/plans/scene-engine/PLAN.md` - Implementation phases and architecture

## Package Structure

```
packages/
├─ core/       # Engine, EventBus, ModeManager, RAF Scheduler
├─ renderer/   # WebGPU context, QuadRenderer, ShaderLibrary
├─ surfaces/   # SurfaceRegistry, LayoutTracker, GhostSurface
├─ screen/     # EffectStack, TransitionShaders
├─ input/      # PointerManager, Inertia, Picking
├─ navigation/ # TransitionCoordinator
└─ a11y/       # DOMMirror, FocusSync
```

## Interaction Modes

- **Mode A (DOM-Interactive)**: Canvas has `pointer-events: none`. DOM handles all interaction.
- **Mode B (Canvas-Interactive)**: Canvas has `pointer-events: auto`. Scene owns pointer input.

## Agent Invocation Guide

When building specific features, invoke the appropriate specialist:

| Task | Agent |
|------|-------|
| WebGPU/shaders/rendering | `@webgpu-engineer` |
| Surface tracking/DOM sync | `@surface-engineer` |
| Pointer/picking/inertia | `@input-engineer` |
| Accessibility/keyboard | `@a11y-engineer` |
| Orchestrate a build phase | `@build` |
| Create/refine agent rules | `@agent-ruler` |

## Graceful Degradation

When WebGPU is unavailable:
- Scene still mounts and tracks DOM
- Skip GPU rendering entirely
- Motion callbacks still fire
- Expose `scene.isGPUEnabled` flag
