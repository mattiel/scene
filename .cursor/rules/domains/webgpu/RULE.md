---
description: "WebGPU rendering constraints for renderer and screen packages"
alwaysApply: false
---

# WebGPU Rendering

`[rule: webgpu]` — Constraints for renderer/screen GPU work.

## Allowed Paths
- `packages/renderer/`
- `packages/screen/`

## Scope
- WebGPU init/device and feature checks
- WGSL shaders, pipelines, passes
- Buffers/textures/samplers
- Screen/post effects and performance

## Rules
- Check availability; provide safe no-op fallback
- Cache pipelines/bind group layouts; reuse targets
- Batch uploads; use staging for GPU-only data
- Prefer formats: rgba8unorm (color), bgra8unorm (canvas), depth24plus (depth), rgba16float (HDR)
- Track memory and release resources on destroy
- Handle device loss: listen, recreate device/pipelines/buffers

## Workflow
1) Get adapter/device with needed features
2) Build pipelines once; cache layouts
3) Record passes, batch draws, minimize barriers
4) Cleanup resources on teardown

## Bug Patterns

Look for these when reviewing renderer/screen code:

- **Leaked GPU resources**: buffer/texture created without corresponding destroy() in cleanup
- **Missing device loss handler**: device used without deviceLost listener registered
- **Stale pipeline**: pipeline created before device ready or after device lost
- **Unguarded GPU calls**: writeBuffer/submit without checking device validity
- **Texture format mismatch**: source/target formats don't match pipeline expectations
- **Missing await on async init**: using context/device before initialize() resolves
- **Bind group reuse**: creating new bind groups per frame instead of caching
- **Missing encoder finish**: commandEncoder.finish() not called before submit

## Checklist
- [ ] Fallback path works
- [ ] No validation errors
- [ ] Device loss handled
- [ ] Resources released
- [ ] Frame times acceptable