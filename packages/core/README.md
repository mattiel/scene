# @scene/core

Core engine for Scene - DOM-first cinematic effects engine.

## Overview

The core package provides the foundational classes for the Scene engine:

- **Engine**: Main orchestrator and entry point for Scene
- **EventBus**: Type-safe event system for inter-system communication
- **RAFScheduler**: Batched animation frame scheduler with priority support

## Installation

```bash
pnpm add @scene/core
```

## Usage

### Basic Setup

```typescript
import { Engine, InteractionMode } from '@scene/core';

// Create engine instance
const scene = new Engine({
  canvas: '#scene-canvas',
  mode: InteractionMode.DOM_INTERACTIVE,
  trackFPS: true,
  autoStart: true,
});

// Listen to events
scene.on('ready', () => {
  console.log('Scene is ready!');
});

scene.on('render', ({ deltaTime, timestamp }) => {
  console.log(`Frame rendered: ${deltaTime}ms`);
});
```

### Event System

```typescript
import { EventBus } from '@scene/core';

const events = new EventBus();

// Subscribe to events
const unsubscribe = events.on('render', ({ deltaTime }) => {
  console.log('Render:', deltaTime);
});

// One-time listeners
events.once('ready', () => {
  console.log('Ready!');
});

// Emit events
events.emit('render', { deltaTime: 16.7, timestamp: 1000 });

// Unsubscribe
unsubscribe();
```

### RAF Scheduler

```typescript
import { RAFScheduler, FramePriority } from '@scene/core';

const scheduler = new RAFScheduler({ trackFPS: true });

// Add frame callback
const id = scheduler.add((deltaTime, timestamp) => {
  console.log('Frame:', deltaTime);
}, FramePriority.UPDATE);

// Remove callback
scheduler.remove(id);

// Control playback
scheduler.pause();
scheduler.resume();
scheduler.stop();
```

## API

### Engine

Main orchestrator for the Scene engine.

**Constructor Options:**
- `canvas?: HTMLCanvasElement | string` - Canvas element or selector
- `mode?: InteractionMode` - Initial interaction mode
- `trackFPS?: boolean` - Enable FPS tracking
- `autoStart?: boolean` - Auto-start render loop (default: true)

**Properties:**
- `canvas: HTMLCanvasElement | null` - Canvas element
- `events: EventBus` - Event bus instance
- `scheduler: RAFScheduler` - RAF scheduler instance
- `mode: InteractionMode` - Current interaction mode
- `isReady: boolean` - Engine ready state
- `fps: number` - Current FPS (if tracking enabled)
- `isRunning: boolean` - Render loop status

**Methods:**
- `start()` - Start render loop
- `stop()` - Stop render loop
- `pause()` - Pause render loop
- `resume()` - Resume render loop
- `on(event, callback)` - Subscribe to event
- `once(event, callback)` - Subscribe once
- `off(event, callback?)` - Unsubscribe
- `destroy()` - Clean up resources

### EventBus

Type-safe event dispatcher with wildcard support.

**Methods:**
- `on<K>(event, callback)` - Subscribe to event
- `once<K>(event, callback)` - Subscribe once
- `off<K>(event, callback?)` - Unsubscribe
- `emit<K>(event, payload)` - Emit event
- `clear()` - Remove all listeners
- `listenerCount(event)` - Get listener count
- `hasListeners(event)` - Check if event has listeners

### RAFScheduler

Batched requestAnimationFrame scheduler.

**Constructor Options:**
- `trackFPS?: boolean` - Enable FPS tracking

**Properties:**
- `running: boolean` - Scheduler status
- `fps: number` - Current FPS (if tracking enabled)
- `callbackCount: number` - Number of registered callbacks

**Methods:**
- `add(callback, priority?)` - Add frame callback
- `remove(id)` - Remove callback
- `start()` - Start scheduler
- `stop()` - Stop scheduler
- `pause()` - Pause scheduler
- `resume()` - Resume scheduler
- `once(callback, priority?)` - Execute once on next frame
- `clear()` - Remove all callbacks

### InteractionMode

Enum for interaction modes:
- `DOM_INTERACTIVE` - DOM handles input, canvas is pointer-events: none
- `CANVAS_INTERACTIVE` - Canvas handles input, DOM is pointer-events: none

### FramePriority

Enum for frame callback priorities:
- `INPUT = 100` - Input handling (runs first)
- `LAYOUT = 75` - Layout updates and DOM measurements
- `UPDATE = 50` - Surface updates and GPU state preparation
- `RENDER = 25` - Rendering to GPU
- `CLEANUP = 0` - Post-render cleanup and analytics

## Events

The EventBus supports the following events:

- `ready` - Engine initialized and ready
- `render` - Frame rendered `{ deltaTime: number, timestamp: number }`
- `resize` - Canvas resized `{ width: number, height: number }`
- `error` - Error occurred `{ message: string, error: Error }`
- `mode:changed` - Interaction mode changed `{ from: string, to: string }`
- `surface:added` - Surface added `{ id: string }`
- `surface:removed` - Surface removed `{ id: string }`
- `surface:updated` - Surface updated `{ id: string }`
- `transition:start` - Navigation transition started `{ from: string, to: string }`
- `transition:complete` - Navigation transition completed `{ to: string }`
- `pointer:down` - Pointer down `{ x: number, y: number, surfaceId?: string }`
- `pointer:move` - Pointer move `{ x: number, y: number, surfaceId?: string }`
- `pointer:up` - Pointer up `{ x: number, y: number, surfaceId?: string }`

## License

MIT
