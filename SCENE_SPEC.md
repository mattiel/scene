# Scene — Internal Product & Engineering Spec
*(Working document for implementation)*

> Author: Mattie Lee  
> Repo: github.com/mattiel/scene  
> Status: Pre-MVP / Build Phase

---

## 1. Product definition

**Scene** is a DOM-first cinematic effects engine for the web.

It augments real HTML with:
- WebGPU-powered visual effects
- Motion-driven transitions
- Optional canvas-interactive 3D scenes

Scene never replaces the DOM.  
Scene never owns routing.  
Scene never renders text.

---

## 2. Core design rules (non-negotiable)

### DOM is canonical
- All content, text, links, and semantics live in the DOM
- Accessibility and SEO must work without Scene

### GPU is visual-only
- WebGPU is used for:
  - distortion
  - refraction
  - noise
  - post-processing
- No GPU text rendering
- No GPU-owned semantics

### Motion controls time
- Scene does not own easing or timelines
- Motion values (Framer Motion / Motion) drive:
  - transitions
  - progress
  - intensities

### Router-agnostic
- Scene never imports a router
- Navigation is a host concern
- Scene coordinates visual continuity only

---

## 3. Interaction modes

### Mode A — DOM-Interactive (default)
- Canvas has `pointer-events: none`
- DOM handles all clicks/hover/focus
- Scene tracks DOM layout and renders GPU effects

Use for:
- cards
- typography effects
- layout transitions
- most pages

### Mode B — Canvas-Interactive (explicit)
- Canvas has `pointer-events: auto`
- Scene owns pointer input and picking
- DOM acts as semantic mirror (a11y, keyboard)

Use for:
- true 3D carousels
- rotated planes
- canvas-driven scenes

---

## 4. Engine architecture

### High-level modules

```
Scene
├─ Core
│  ├─ Engine
│  ├─ EventBus
│  └─ ModeManager
│
├─ Renderer (WebGPU)
│  ├─ WebGPUContext
│  ├─ QuadRenderer
│  ├─ ScreenPass
│  └─ ShaderLibrary
│
├─ Surfaces
│  ├─ SurfaceRegistry
│  ├─ LayoutTracker
│  ├─ GhostSurface
│  └─ SurfaceEffects
│
├─ Screen
│  ├─ EffectStack
│  └─ TransitionShaders
│
├─ Input
│  ├─ PointerManager
│  ├─ Inertia
│  └─ Picking
│
├─ Navigation
│  └─ TransitionCoordinator
│
├─ A11y
│  ├─ DOMMirror
│  └─ FocusSync
│
└─ Utils
   ├─ Math
   ├─ Curves
   └─ RAF Scheduler
```

---

## 5. Core abstractions

### Scene instance
```ts
createScene(options) → Scene
```

Owns:
- render loop
- mode
- surface registry
- screen effects
- input routing

### Surface
Represents a DOM element augmented by GPU.

Properties:
- id
- DOM element
- rect (tracked)
- effect type
- shader params

### GhostSurface
Temporary GPU-only surface created from a DOM element.

Used when:
- DOM element must disappear
- visuals must continue

Lifecycle:
- create → animate → destroy

---

## 6. Navigation transition protocol

```ts
scene.nav.transition(
  request,
  { navigate, ready }
)
```

Scene does:
1. exit visuals
2. call `navigate`
3. wait for `ready`
4. refresh bindings
5. enter visuals

---

## 7. Canvas-Interactive mode

### Input ownership
- Canvas receives pointer, wheel, drag
- Scene maps input → state

### Picking (v1)
- CPU ray-plane intersection
- Emits:
  - `intent:select`
  - `intent:activate`

Scene never navigates directly.

### Accessibility contract
- Requires DOM mirror
- Selection synced
- Keyboard supported

---

## 8. Motion integration

Scene consumes scalar values:
- `t ∈ [0..1]`
- hover intensity
- scroll progress

Motion produces values.  
Scene maps them to shader uniforms.

---

## 9. First build demo — 3D Carousel Scene

### Goals
- Canvas-Interactive mode
- GPU picking
- Motion-driven transitions
- DOM accessibility mirror

### Behavior
1. Scroll/drag rotates carousel
2. Center card pops forward
3. Click activates item
4. Fullscreen dissolve transition
5. Navigate to detail view
6. Transition resolves

---

## 10. Repo structure

```
scene/
├─ packages/
│  ├─ core/
│  ├─ renderer/
│  ├─ surfaces/
│  ├─ input/
│  ├─ navigation/
│  └─ a11y/
│
├─ demos/
│  └─ carousel/
│
├─ docs/
│  └─ SCENE_SPEC.md
│
└─ package.json
```

---

## 11. What NOT to build yet

- GPU text rendering
- UI frameworks
- Routers
- Physics
- Plugin systems

---

## 12. Success criteria

- 60fps carousel
- Accurate picking
- No DOM reflow glitches
- Screen reader works
- Keyboard works
- Transitions feel continuous

---

## Final rule

If something should be solved in the DOM, solve it in the DOM.

Scene exists only to do what the DOM cannot do well.
