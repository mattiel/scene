/**
 * Bridge between Motion and Scene's render loop
 * 
 * Motion has its own `frame` API for batched RAF. This module bridges
 * Motion's frame loop with Scene's RAFScheduler to ensure animations
 * are synchronized with rendering.
 */

import { frame, cancelFrame } from 'motion';
import type { RAFScheduler, FrameCallback } from '@scene/core';

/** Frame data passed to callbacks */
export interface FrameData {
  timestamp: number;
  delta: number;
  isProcessing: boolean;
}

/** Callback for Motion frame events */
export type MotionFrameCallback = (data: FrameData) => void;

/**
 * Bridge between Motion's frame API and Scene's RAFScheduler
 * 
 * This ensures Motion animations are processed at the correct point
 * in Scene's render loop (before rendering, after input).
 */
export class FrameBridge {
  private scheduler: RAFScheduler | null = null;
  private callbackId: number | null = null;
  private motionCallbacks: Set<MotionFrameCallback> = new Set();
  private isRunning = false;

  /**
   * Connect the bridge to a Scene RAFScheduler
   * @param scheduler - Scene's RAF scheduler instance
   * @param priority - Priority level (default: UPDATE = 50)
   */
  connect(scheduler: RAFScheduler, priority = 50): void {
    if (this.scheduler) {
      this.disconnect();
    }

    this.scheduler = scheduler;
    
    // Register with Scene's scheduler at the specified priority
    const frameCallback: FrameCallback = (_deltaTime, timestamp) => {
      // Drive Motion animations by calling registered callbacks
      const frameData: FrameData = {
        timestamp,
        delta: _deltaTime,
        isProcessing: true,
      };
      
      for (const callback of this.motionCallbacks) {
        try {
          callback(frameData);
        } catch (error) {
          console.error('Error in Motion frame callback:', error);
        }
      }
    };

    this.callbackId = scheduler.add(frameCallback, priority);
    this.isRunning = true;
  }

  /**
   * Disconnect from the Scene scheduler
   */
  disconnect(): void {
    if (this.scheduler && this.callbackId !== null) {
      this.scheduler.remove(this.callbackId);
    }
    this.scheduler = null;
    this.callbackId = null;
    this.isRunning = false;
  }

  /**
   * Add a callback to be called each frame
   * @param callback - Function to call with frame data
   * @returns Cleanup function
   */
  onFrame(callback: MotionFrameCallback): () => void {
    this.motionCallbacks.add(callback);
    return () => {
      this.motionCallbacks.delete(callback);
    };
  }

  /**
   * Check if bridge is connected and running
   */
  get connected(): boolean {
    return this.isRunning && this.scheduler !== null;
  }

  /**
   * Get the number of registered callbacks
   */
  get callbackCount(): number {
    return this.motionCallbacks.size;
  }
}

/** Global frame bridge instance */
let globalBridge: FrameBridge | null = null;

/**
 * Get the global frame bridge instance
 */
export function getFrameBridge(): FrameBridge {
  if (!globalBridge) {
    globalBridge = new FrameBridge();
  }
  return globalBridge;
}

/**
 * Sync Motion's frame loop with Scene's RAFScheduler
 * 
 * This is the main entry point for integrating Motion with Scene.
 * Call this once when setting up your Scene engine.
 * 
 * @param scheduler - Scene's RAF scheduler instance
 * @param priority - Priority level for Motion updates (default: 50)
 * 
 * @example
 * ```typescript
 * import { syncFrame } from '@scene/motion';
 * import { RAFScheduler, FramePriority } from '@scene/core';
 * 
 * const scheduler = new RAFScheduler();
 * syncFrame(scheduler, FramePriority.UPDATE);
 * scheduler.start();
 * ```
 */
export function syncFrame(scheduler: RAFScheduler, priority = 50): FrameBridge {
  const bridge = getFrameBridge();
  bridge.connect(scheduler, priority);
  return bridge;
}

/**
 * Disconnect the global frame bridge
 */
export function unsyncFrame(): void {
  if (globalBridge) {
    globalBridge.disconnect();
  }
}

/**
 * Use Motion's native frame API (bypasses Scene scheduler)
 * 
 * This is useful for animations that should run independently
 * of Scene's render loop, or when Scene is not being used.
 * 
 * @param callback - Function to call each frame
 * @returns Cleanup function
 */
export function useMotionFrame(callback: MotionFrameCallback): () => void {
  const process = frame.update(callback, true);
  return () => cancelFrame(process);
}
