---
description: "Surface and DOM tracking constraints for surfaces package"
alwaysApply: false
---

# Surface Tracking

`[rule: surfaces]` — Constraints for DOM surface sync.

## Allowed Paths
- `packages/surfaces/`

## Scope
- `@scene/surfaces`: Surface, SurfaceRegistry, LayoutTracker, GhostSurface
- DOM rect tracking, visibility, z-order, ghost lifecycle

## Rules
- Use ResizeObserver + IntersectionObserver; batch updates per frame
- Mark registry dirty on z-index changes; render sorted order
- Skip updates for hidden surfaces; remove destroyed entries
- Ghosts: fixed rects, no DOM element, clean textures after use
- Keep tests/docs under package tests/

## Workflow
1) Register/unregister surfaces in registry
2) LayoutTracker batches rect/visibility updates
3) Ghost creation copies rect/zIndex; clean up after
4) Provide hit tests via registry when needed

## Bug Patterns

Look for these when reviewing surfaces code:

- **Observer leak**: ResizeObserver/IntersectionObserver created without disconnect() on destroy
- **Stale registry entry**: surface removed from DOM but not unregistered from registry
- **Missing dirty flag**: z-index change without marking registry dirty for re-sort
- **Ghost texture leak**: ghost destroyed without releasing associated texture
- **Sync outside RAF**: layout reads/writes not batched in requestAnimationFrame
- **getBoundingClientRect in loop**: forced reflow from repeated rect queries
- **Missing weak references**: holding strong refs to DOM elements that may be removed

## Checklist
- [ ] Surfaces add/remove correctly
- [ ] Rects/visibility update once per frame
- [ ] Z-order sorted
- [ ] Ghosts cleaned up
- [ ] Observers detached on destroy
