# @scene/navigation

Navigation transition coordinator for Scene.

## Features
- Orchestrates the navigation protocol: exit → navigate → ready → enter.
- Creates and manages ghost surfaces to preserve visuals between routes.
- Emits lifecycle events and handles timeouts/cancellation.
- Graceful fallback when GPU/surfaces are unavailable.

## Usage
```ts
import { Engine } from '@scene/core';
import { SurfaceRegistry } from '@scene/surfaces';
import { TransitionCoordinator } from '@scene/navigation';

const engine = new Engine();
const registry = new SurfaceRegistry();

const nav = new TransitionCoordinator(engine, {
  surfaceRegistry: registry,
  defaultTimeoutMs: 5000,
});

const ready = () => Promise.resolve();

nav.transition(
  { from: '/home', to: '/product' },
  { navigate: () => router.push('/product'), ready }
);
```

## Scripts
- `pnpm build` - build the package
- `pnpm typecheck` - run TypeScript
- `pnpm lint` - lint the source
- `pnpm dev` - watch mode build
