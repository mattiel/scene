# Memory Leak Fixes - @scene/renderer

## Issue Summary

Two GPU resource memory leak issues were identified and fixed in the renderer package:

### 1. ScreenPass.createEffect() Memory Leak
**Location:** `packages/renderer/src/ScreenPass.ts:96-141`

**Problem:**
- Uniform buffer created (lines 98-105)
- If `createRenderPipeline()` throws (line 108), buffer never destroyed
- Repeated failures accumulate leaked GPU memory
- Can occur with user-provided invalid shader names

**Solution:**
Wrapped pipeline creation in try-catch block that destroys uniform buffer on error:

```typescript
let pipeline: GPURenderPipeline;
try {
  pipeline = device.createRenderPipeline({
    // ... pipeline config ...
  });
} catch (error: unknown) {
  // Cleanup uniform buffer if pipeline creation failed
  uniformBuffer?.destroy();
  throw error;
}
```

### 2. QuadRenderer.initialize() Memory Leak
**Location:** `packages/renderer/src/QuadRenderer.ts:52-67`

**Problem:**
- Buffers created in `createBuffers()` (line 59)
- Sampler created in `createSampler()` (line 60)
- If `createPipeline()` fails (line 61), resources leak
- No cleanup of partially initialized resources

**Solution:**
1. Added `cleanup()` method for resource cleanup
2. Call `cleanup()` in catch block on initialization failure
3. Reuse `cleanup()` in `destroy()` method for DRY principle

```typescript
initialize(): boolean {
  try {
    this.createBuffers();
    this.createSampler();
    this.createPipeline();
    this.initialized = true;
    return true;
  } catch (error: unknown) {
    console.error('QuadRenderer initialization failed:', error);
    // Cleanup any resources that were created before the error
    this.cleanup();
    return false;
  }
}

private cleanup(): void {
  this.vertexBuffer?.destroy();
  this.indexBuffer?.destroy();
  
  this.pipeline = null;
  this.vertexBuffer = null;
  this.indexBuffer = null;
  this.sampler = null;
  this.initialized = false;
}

destroy(): void {
  this.cleanup();
}
```

## Testing

A comprehensive test suite was created at `packages/renderer/test-memory-leak-fix.html` that verifies:

1. **ScreenPass Test:**
   - Attempts to create effect with invalid shader name
   - Verifies error is caught and resources cleaned up
   - Confirms system still works after error

2. **QuadRenderer Test:**
   - Attempts initialization with empty shader library (missing required shaders)
   - Verifies initialization fails gracefully with cleanup
   - Confirms new instance can initialize successfully afterward

## Impact

These fixes prevent GPU memory leaks in scenarios where:
- Users provide invalid or misconfigured shader names
- Pipeline creation fails due to shader compilation errors
- Initialization fails due to missing dependencies

The fixes ensure all GPU resources (`GPUBuffer`, specifically) are properly destroyed when errors occur, preventing memory accumulation during error conditions.

## Type Safety

All fixes maintain strict TypeScript type safety:
- Explicit type annotations on all variables
- Proper error typing as `unknown`
- No use of `any` types
