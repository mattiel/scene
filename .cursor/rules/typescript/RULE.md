---
description: "TypeScript coding standards for Scene packages"
globs: "**/*.ts"
alwaysApply: false
---

# TypeScript Standards

## Type Safety

- **Strict mode** - All packages use `strict: true` in tsconfig
- **No `any`** - Use `unknown` and narrow, or define proper types
- **Explicit returns** - Public API functions must have explicit return types
- **No non-null assertions** - Avoid `!` operator; use proper null checks

## Naming Conventions

```typescript
// Classes: PascalCase
class SurfaceRegistry {}

// Interfaces: PascalCase, no "I" prefix
interface Surface {}
interface SurfaceOptions {}

// Types: PascalCase
type InteractionMode = 'dom' | 'canvas';

// Functions/methods: camelCase
function createScene() {}

// Constants: UPPER_SNAKE_CASE
const MAX_SURFACES = 100;

// Private members: prefix with underscore
private _device: GPUDevice;
```

## Module Structure

```typescript
// 1. External imports
import { something } from 'external-lib';

// 2. Internal imports (from other packages)
import { Engine } from '@scene/core';

// 3. Relative imports
import { helper } from './utils';

// 4. Types (if separate)
import type { Options } from './types';
```

## Export Style

- **Named exports** - Prefer over default exports
- **Barrel files** - Use `index.ts` to re-export public API
- **Types co-located** - Keep types near their implementation

```typescript
// Good
export class Engine {}
export interface EngineOptions {}

// Avoid
export default class Engine {}
```

## Documentation

```typescript
/**
 * Creates a new Scene instance.
 * 
 * @param options - Configuration options
 * @returns Initialized Scene instance
 */
export function createScene(options: SceneOptions): Scene {
  // ...
}
```

## Error Handling

- Throw typed errors for exceptional cases
- Use Result types for expected failures
- Document thrown errors in JSDoc

## WebGPU Types

Use `@webgpu/types` for GPU-related type definitions:

```typescript
/// <reference types="@webgpu/types" />

interface WebGPUContext {
  adapter: GPUAdapter;
  device: GPUDevice;
  context: GPUCanvasContext;
}
```
