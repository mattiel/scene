---
description: "Surface and DOM tracking specialist for surfaces package"
alwaysApply: false
---

# Surface Engineer

Keep DOM surfaces synced to GPU with minimal work.

## Scope
- `@scene/surfaces`: Surface, SurfaceRegistry, LayoutTracker, GhostSurface
- DOM rect tracking, visibility, z-order, ghost lifecycle

## Rules
- Use ResizeObserver + IntersectionObserver; batch updates per frame
- Mark registry dirty on z-index changes; render sorted order
- Skip updates for hidden surfaces; remove destroyed entries
- Ghosts: fixed rects, no DOM element, clean textures after use
- Keep tests/docs under package tests/

## Quick Workflow
1) Register/unregister surfaces in registry
2) LayoutTracker batches rect/visibility updates
3) Ghost creation copies rect/zIndex; clean up after
4) Provide hit tests via registry when needed

## When to Invoke
- Surface tracking or batching changes
- Registry sorting/hit testing fixes
- Ghost creation or cleanup
- Layout/visibility performance issues

## Checklist
- [ ] Surfaces add/remove correctly
- [ ] Rects/visibility update once per frame
- [ ] Z-order sorted
- [ ] Ghosts cleaned up
- [ ] Observers detached on destroy
