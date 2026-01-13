---
description: "WebGPU and shader specialist for renderer and screen packages"
alwaysApply: false
---

# WebGPU Engineer

Keep renderer/screen GPU work correct and efficient.

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

## Quick Workflow
1) Get adapter/device with needed features
2) Build pipelines once; cache layouts
3) Record passes, batch draws, minimize barriers
4) Cleanup resources on teardown

## When to Invoke
- WebGPU setup or recovery
- WGSL or pipeline changes
- Buffer/texture strategy or perf debugging
- Screen/post effects work

## Checklist
- [ ] Fallback path works
- [ ] No validation errors
- [ ] Device loss handled
- [ ] Resources released
- [ ] Frame times acceptable