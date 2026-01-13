# @scene/surfaces

Surface system for Scene - tracks DOM elements and prepares them for GPU augmentation.

## Features

- **Surface**: Links DOM elements to GPU representations
- **SurfaceRegistry**: Manages all surfaces by ID
- **LayoutTracker**: Integrates ResizeObserver and IntersectionObserver for efficient layout tracking
- **GhostSurface**: Temporary GPU-only surfaces from DOM snapshots for navigation transitions

## Usage

```typescript
import { Surface, SurfaceRegistry, LayoutTracker } from '@scene/surfaces';

// Create a surface from a DOM element
const surface = new Surface('my-surface', element);

// Register it
const registry = new SurfaceRegistry();
registry.add(surface);

// Track layout changes
const tracker = new LayoutTracker(registry);
tracker.start();
```

## Architecture

The surfaces package batches layout updates per frame to minimize performance impact. It uses:

- `ResizeObserver` for element size changes
- `IntersectionObserver` for visibility culling
- `MutationObserver` for DOM structure changes (if needed)

All updates are batched and processed once per animation frame via RAF.
