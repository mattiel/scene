/**
 * Type-safe event emitter for Scene engine
 * Supports typed events with payload validation
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventCallback<T = any> = (payload: T) => void;

export interface EventMap {
  // Core lifecycle events
  ready: void;
  render: { deltaTime: number; timestamp: number };
  resize: { width: number; height: number };
  error: { message: string; error: Error };
  
  // Mode events
  'mode:changed': { from: string; to: string };
  
  // Surface events
  'surface:added': { id: string };
  'surface:removed': { id: string };
  'surface:updated': { id: string };
  
  // Navigation events
  'transition:start': { from: string; to: string };
  'transition:complete': { to: string };
  
  // Input events
  'pointer:down': { x: number; y: number; surfaceId?: string };
  'pointer:move': { x: number; y: number; surfaceId?: string };
  'pointer:up': { x: number; y: number; surfaceId?: string };
  'pointer:cancel': { x: number; y: number; surfaceId?: string };
}

interface EventListener {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: EventCallback<any>;
  once: boolean;
}

/**
 * EventBus - Central event dispatcher for Scene engine
 * 
 * Provides type-safe event handling with support for:
 * - Multiple listeners per event
 * - One-time listeners
 * - Wildcard listeners (*)
 * - Event payload validation via TypeScript
 */
export class EventBus {
  private listeners: Map<string, EventListener[]> = new Map();
  private wildcardListeners: EventListener[] = [];

  /**
   * Subscribe to an event
   * @param event - Event name or '*' for all events
   * @param callback - Handler function
   * @returns Unsubscribe function
   */
  on<K extends keyof EventMap>(
    event: K | '*',
    callback: EventCallback<EventMap[K]>
  ): () => void {
    if (event === '*') {
      const listener: EventListener = { callback, once: false };
      this.wildcardListeners.push(listener);
      return () => {
        const index = this.wildcardListeners.indexOf(listener);
        if (index !== -1) {
          this.wildcardListeners.splice(index, 1);
        }
      };
    }

    const eventKey = event as string;
    if (!this.listeners.has(eventKey)) {
      this.listeners.set(eventKey, []);
    }

    const listener: EventListener = { callback, once: false };
    this.listeners.get(eventKey)!.push(listener);

    return () => {
      const listeners = this.listeners.get(eventKey);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Subscribe to an event, automatically unsubscribe after first trigger
   * @param event - Event name
   * @param callback - Handler function
   * @returns Unsubscribe function
   */
  once<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>
  ): () => void {
    const eventKey = event as string;
    if (!this.listeners.has(eventKey)) {
      this.listeners.set(eventKey, []);
    }

    const listener: EventListener = { callback, once: true };
    this.listeners.get(eventKey)!.push(listener);

    return () => {
      const listeners = this.listeners.get(eventKey);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Unsubscribe from an event
   * @param event - Event name or '*' for all events
   * @param callback - Handler function to remove
   */
  off<K extends keyof EventMap>(
    event: K | '*',
    callback?: EventCallback<EventMap[K]>
  ): void {
    if (event === '*') {
      if (callback) {
        this.wildcardListeners = this.wildcardListeners.filter(
          (l) => l.callback !== callback
        );
      } else {
        this.wildcardListeners = [];
      }
      return;
    }

    const eventKey = event as string;
    const listeners = this.listeners.get(eventKey);
    if (!listeners) return;

    if (callback) {
      const filtered = listeners.filter((l) => l.callback !== callback);
      if (filtered.length === 0) {
        this.listeners.delete(eventKey);
      } else {
        this.listeners.set(eventKey, filtered);
      }
    } else {
      this.listeners.delete(eventKey);
    }
  }

  /**
   * Emit an event to all subscribers
   * @param event - Event name
   * @param payload - Event data
   */
  emit<K extends keyof EventMap>(
    event: K,
    ...args: EventMap[K] extends void ? [] : [EventMap[K]]
  ): void {
    const payload = args[0];
    const eventKey = event as string;

    // Call event-specific listeners
    const listeners = this.listeners.get(eventKey);
    if (listeners) {
      // Create a copy to avoid issues if listeners modify the array
      const listenersToCall = [...listeners];
      
      for (const listener of listenersToCall) {
        try {
          listener.callback(payload);
        } catch (error) {
          console.error(`Error in event listener for "${eventKey}":`, error);
        }

        // Remove one-time listeners
        if (listener.once) {
          const index = listeners.indexOf(listener);
          if (index !== -1) {
            listeners.splice(index, 1);
          }
        }
      }

      // Clean up empty listener arrays
      if (listeners.length === 0) {
        this.listeners.delete(eventKey);
      }
    }

    // Call wildcard listeners
    if (this.wildcardListeners.length > 0) {
      const wildcardToCall = [...this.wildcardListeners];
      for (const listener of wildcardToCall) {
        try {
          listener.callback(payload);
        } catch (error) {
          console.error(`Error in wildcard listener for "${eventKey}":`, error);
        }
      }
    }
  }

  /**
   * Remove all event listeners
   */
  clear(): void {
    this.listeners.clear();
    this.wildcardListeners = [];
  }

  /**
   * Get count of listeners for an event
   * @param event - Event name or '*' for wildcard listeners
   */
  listenerCount(event: keyof EventMap | '*'): number {
    if (event === '*') {
      return this.wildcardListeners.length;
    }
    return this.listeners.get(event as string)?.length ?? 0;
  }

  /**
   * Check if an event has any listeners
   * @param event - Event name
   */
  hasListeners(event: keyof EventMap): boolean {
    return this.listenerCount(event) > 0;
  }
}
