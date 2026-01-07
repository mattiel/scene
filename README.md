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

## License

MIT © Mattie Lee
