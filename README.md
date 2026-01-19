# Scene Engine

A DOM-first cinematic effects engine for the web, powered by WebGPU.

## Architecture

Scene is a monorepo built with pnpm workspaces and Turborepo for optimal build performance.

### Packages

- **[@scene/core](./packages/core)** - Core engine with event system and render loop

### Coming Soon

- `@scene/renderer` - WebGPU rendering layer
- `@scene/surfaces` - DOM element tracking and GPU augmentation
- `@scene/screen` - Fullscreen post-processing effects
- `@scene/input` - Pointer input management
- `@scene/navigation` - Navigation transitions
- `@scene/a11y` - Accessibility layer

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run typechecking
pnpm typecheck

# Lint code
pnpm lint

# Clean build artifacts
pnpm clean
```

## Development

This monorepo uses Turborepo for intelligent build caching and orchestration:

- **Parallel Execution**: Tasks run in parallel across packages
- **Smart Caching**: Unchanged packages are skipped (22ms vs 1.7s builds!)
- **Dependency Graph**: Builds respect package dependencies
- **Incremental Builds**: Only rebuilds what changed

### Commands

```bash
# Development mode (watch)
pnpm dev

# Build all packages
pnpm build

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format

# Clean everything
pnpm clean
```

### Performance

Turborepo provides dramatic speedups through caching:

- **First build**: ~1.7s
- **Cached build**: ~22ms (77x faster!)
- **First typecheck**: ~500ms
- **Cached typecheck**: ~22ms (23x faster!)

## Tech Stack

- **TypeScript** - Type-safe codebase
- **pnpm** - Fast, disk-efficient package manager
- **Turborepo** - High-performance monorepo build system
- **Vite** - Lightning-fast build tool
- **ESLint** - Code quality
- **Prettier** - Code formatting

## Project Status

**Current Phase**: Phase 1 Complete ✅

- ✅ Monorepo foundation with Turborepo
- ✅ Core engine with event system
- ✅ RAF scheduler with priorities
- ⏳ WebGPU renderer (Phase 2)
- ⏳ Surface tracking system (Phase 3)
- ⏳ Screen effects (Phase 4)
- ⏳ Input management (Phase 5)
- ⏳ Navigation transitions (Phase 6)
- ⏳ Accessibility layer (Phase 7)
- ⏳ 3D Carousel demo (Phase 8)

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed roadmap.

## Documentation

- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Development roadmap
- [Scene Specification](./SCENE_SPEC.md) - Product requirements
- [Phase 1 Summary](./PHASE1_COMPLETE.md) - Core package completion
- [Core Package](./packages/core/README.md) - API documentation

## Requirements

- Node.js >= 18.0.0
- pnpm >= 8.0.0

## Browser Compatibility

Scene uses WebGPU for GPU-accelerated rendering. When WebGPU is not available, Scene gracefully degrades to DOM-only mode.

### WebGPU Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 113+ | ✅ Full support |
| Edge | 113+ | ✅ Full support |
| Firefox | 121+ | ✅ Full support |
| Safari (macOS) | 17+ | ✅ Full support |
| Safari (iOS) | 17.4+ | ✅ Full support (enabled by default) |
| Safari (iOS) | 17.0-17.3 | ⚠️ Requires enabling in Settings |
| Safari (iOS) | 16 and earlier | ❌ Not supported |

### iOS Safari Notes

- **iOS 17.4+**: WebGPU is enabled by default
- **iOS 17.0-17.3**: WebGPU available but requires manual enable:
  1. Open **Settings** > **Safari** > **Advanced** > **Feature Flags**
  2. Enable **WebGPU**
- **iOS 16 and earlier**: WebGPU not available; Scene will run in degraded mode (DOM-only)

### Graceful Degradation

When WebGPU is not available, Scene automatically degrades:

```typescript
import { WebGPUContext } from '@scene/renderer';

const context = new WebGPUContext();
const initialized = await context.initialize({ canvas });

if (!context.isAvailable) {
  // Scene continues to work with:
  // - DOM tracking and layout observation
  // - Motion callbacks still fire
  // - No GPU rendering (visual effects disabled)
  console.log('Running in degraded mode');
}

// Check browser info for debugging
const browser = WebGPUContext.detectBrowser();
if (browser.isIOSSafari) {
  console.log(`iOS Safari ${browser.iosVersion?.major}.${browser.iosVersion?.minor}`);
}
```

### Feature Detection

```typescript
// Check expected support before initialization
const support = WebGPUContext.checkExpectedSupport();
if (!support.supported) {
  console.warn(support.reason);
}

// After initialization, check capabilities
if (context.capabilities) {
  console.log('Max texture size:', context.capabilities.maxTextureDimension2D);
  console.log('Canvas format:', context.capabilities.preferredFormat);
}
```

## License

MIT © Mattie Lee
