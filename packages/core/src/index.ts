/**
 * @scene/core - Core engine for Scene
 * 
 * Provides the foundational classes for the Scene engine:
 * - Engine: Main orchestrator and entry point
 * - EventBus: Type-safe event system
 * - RAFScheduler: Batched animation frame scheduler
 */

// Main Engine
export { Engine, InteractionMode, type EngineConfig } from './Engine';

// Event System
export { EventBus, type EventCallback, type EventMap } from './EventBus';

// Scheduler
export { RAFScheduler, FramePriority, type FrameCallback } from './RAFScheduler';
