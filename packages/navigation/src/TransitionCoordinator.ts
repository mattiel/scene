import type { Engine } from '@scene/core';
import type { SurfaceRegistry, Surface } from '@scene/surfaces';
import { createGhostFromSurface } from '@scene/surfaces';

export interface TransitionRequest {
  from: string;
  to: string;
  // TODO: Add effect config when screen integration is wired
}

export type TransitionStatus = 'completed' | 'cancelled' | 'timeout' | 'failed';

export interface TransitionResult {
  status: TransitionStatus;
  from: string;
  to: string;
  error?: unknown;
}

export interface TransitionCallbacks {
  navigate: () => void | Promise<void>;
  ready: () => void | Promise<void>;
  timeoutMs?: number;
  signal?: AbortSignal;
  onCancel?: () => void;
}

export interface TransitionOptions {
  surfaceRegistry: SurfaceRegistry;
  defaultTimeoutMs?: number;
}

interface ActiveTransition {
  request: TransitionRequest;
  abortController: AbortController;
  timeoutId: number | null;
  ghosts: Surface[];
  cleanupSignals: () => void;
  transitionId: number; // Unique ID per transition (prevents race condition cleanup)
}

/**
 * TransitionCoordinator
 *
 * Implements the navigation protocol:
 * 1. Exit visuals (ghost surfaces)
 * 2. navigate()
 * 3. wait for ready()
 * 4. cleanup + emit completion
 *
 * Supports timeout override, cancellation, and emits events
 * via Engine's EventBus.
 */
export class TransitionCoordinator {
  private engine: Engine;
  private registry: SurfaceRegistry;
  private defaultTimeoutMs: number;
  private active: ActiveTransition | null = null;
  private ghostCounter = 0;
  private transitionCounter = 0; // Unique ID generator for transitions

  constructor(engine: Engine, options: TransitionOptions) {
    this.engine = engine;
    this.registry = options.surfaceRegistry;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 5000;

    // Expose on engine for scene.nav usage
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.engine as any)._setNavigation?.(this);
  }

  /**
   * Start a navigation transition.
   * Throws if another transition is already running.
   */
  async transition(
    request: TransitionRequest,
    callbacks: TransitionCallbacks
  ): Promise<TransitionResult> {
    if (this.active) {
      return {
        status: 'failed',
        from: request.from,
        to: request.to,
        error: new Error('Transition already in progress'),
      };
    }

    const abortController = new AbortController();
    const { signal: mergedSignal, cleanup: cleanupSignals } = this.mergeSignals(
      callbacks.signal,
      abortController.signal
    );

    const timeoutMs = callbacks.timeoutMs ?? this.defaultTimeoutMs;
    const timeoutId =
      timeoutMs > 0
        ? window.setTimeout(() => {
            this.cancel('timeout');
          }, timeoutMs)
        : null;

    const ghosts = this.captureGhostSurfaces();
    this.transitionCounter += 1;
    const transitionId = this.transitionCounter;
    this.active = {
      request,
      abortController,
      timeoutId,
      ghosts,
      cleanupSignals,
      transitionId,
    };

    this.engine.events.emit('transition:start', { from: request.from, to: request.to });

    try {
      await this.runStep('navigate', callbacks.navigate, mergedSignal);
      await this.runStep('ready', callbacks.ready, mergedSignal);

      if (mergedSignal.aborted) {
        const reason = mergedSignal.reason ?? 'cancelled';
        callbacks.onCancel?.();
        this.cleanup(transitionId);
        return {
          status: reason === 'timeout' ? 'timeout' : 'cancelled',
          from: request.from,
          to: request.to,
        };
      }

      this.cleanup(transitionId);
      this.engine.events.emit('transition:complete', { to: request.to });
      return { status: 'completed', from: request.from, to: request.to };
    } catch (error) {
      this.cleanup(transitionId);

      // Check if this was an abort (internal timeout/cancel OR user signal)
      if (mergedSignal.aborted) {
        callbacks.onCancel?.();
        // Internal timeout sets reason to 'timeout'; all other aborts are cancellations
        const isTimeout = mergedSignal.reason === 'timeout';
        return {
          status: isTimeout ? 'timeout' : 'cancelled',
          from: request.from,
          to: request.to,
        };
      }

      // Real error (not abort-related)
      this.engine.events.emit('error', {
        message: 'Navigation transition failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return { status: 'failed', from: request.from, to: request.to, error };
    }
  }

  /**
   * Cancel the active transition.
   */
  cancel(reason: 'timeout' | 'manual' = 'manual'): void {
    if (!this.active) return;
    this.active.abortController.abort(reason);
  }

  private async runStep(
    label: string,
    step: () => void | Promise<void>,
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) {
      throw signal.reason ?? new Error(`${label} aborted`);
    }
    const result = step();
    if (result instanceof Promise) {
      let abortHandler: (() => void) | undefined;
      const abortPromise = new Promise<void>((_, reject) => {
        abortHandler = () => reject(signal.reason ?? 'aborted');
        signal.addEventListener('abort', abortHandler, { once: true });
      });

      try {
        await Promise.race([result, abortPromise]);
      } finally {
        // Remove listener to prevent unhandled rejection if abort fires after step completes
        if (abortHandler) {
          signal.removeEventListener('abort', abortHandler);
        }
      }
    }
  }

  private mergeSignals(
    signalA: AbortSignal | undefined,
    signalB: AbortSignal
  ): { signal: AbortSignal; cleanup: () => void } {
    if (!signalA) return { signal: signalB, cleanup: () => {} };
    if (signalA.aborted) return { signal: signalA, cleanup: () => {} };

    const controller = new AbortController();
    const listeners: Array<{ signal: AbortSignal; handler: () => void }> = [];

    const forwardAbort = (signal: AbortSignal) => {
      const handler = () => controller.abort(signal.reason);
      signal.addEventListener('abort', handler, { once: true });
      listeners.push({ signal, handler });
    };

    forwardAbort(signalA);
    forwardAbort(signalB);

    const cleanup = () => {
      for (const { signal, handler } of listeners) {
        signal.removeEventListener('abort', handler);
      }
    };

    return { signal: controller.signal, cleanup };
  }

  /**
   * Capture ghost surfaces from all regular surfaces.
   */
  private captureGhostSurfaces(): Surface[] {
    const ghosts: Surface[] = [];
    const regularSurfaces = this.registry.regular();

    for (const surface of regularSurfaces) {
      try {
        const ghostId = this.makeGhostId(surface.id);
        const ghost = createGhostFromSurface(ghostId, surface);
        this.registry.add(ghost);
        ghosts.push(ghost);
      } catch (error) {
        console.warn('Failed to create ghost surface', error);
      }
    }

    return ghosts;
  }

  private makeGhostId(sourceId: string): string {
    this.ghostCounter += 1;
    return `ghost-${sourceId}-${this.ghostCounter}`;
  }

  /**
   * Cleanup active transition: remove ghosts, clear timeout, remove signal listeners.
   * @param ownerId - If provided, only cleanup if this.active.transitionId matches (prevents race condition)
   */
  private cleanup(ownerId?: number): void {
    if (!this.active) return;
    
    // If ownerId provided, only cleanup if we own this transition (prevents race condition)
    if (ownerId !== undefined && this.active.transitionId !== ownerId) {
      return;
    }

    if (this.active.timeoutId !== null) {
      clearTimeout(this.active.timeoutId);
    }

    for (const ghost of this.active.ghosts) {
      try {
        this.registry.remove(ghost.id);
        ghost.destroy();
      } catch (e) {
        console.warn('Failed to cleanup ghost', ghost.id, e);
      }
    }

    this.active.cleanupSignals();
    this.active = null;
  }

  /**
   * Destroy the coordinator and cancel any active transition.
   */
  destroy(): void {
    if (this.active) {
      this.cancel('manual');
      this.cleanup();
    }
    this.ghostCounter = 0;
  }
}
