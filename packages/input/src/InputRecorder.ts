/**
 * InputRecorder
 *
 * Records and plays back input sequences for testing and debugging.
 * Can serialize recordings to JSON for storage.
 */

import type { NormalizedPointer } from './PointerManager';

/**
 * Recorded input event types
 */
export type RecordedEventType = 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel';

/**
 * Recorded input event
 */
export interface RecordedEvent {
  /** Event type */
  type: RecordedEventType;
  /** Time offset from recording start in ms */
  time: number;
  /** Pointer data */
  pointer: NormalizedPointer;
}

/**
 * Recording metadata
 */
export interface RecordingMetadata {
  /** Recording start timestamp */
  startTime: number;
  /** Total duration in ms */
  duration: number;
  /** Number of events */
  eventCount: number;
  /** Viewport dimensions at recording time */
  viewport: { width: number; height: number };
  /** User agent string */
  userAgent: string;
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Complete recording
 */
export interface InputRecording {
  /** Format version */
  version: 1;
  /** Recording metadata */
  metadata: RecordingMetadata;
  /** Recorded events */
  events: RecordedEvent[];
}

/**
 * Playback callbacks
 */
export interface PlaybackCallbacks {
  /** Called on pointer down during playback */
  onPointerDown?: (pointer: NormalizedPointer) => void;
  /** Called on pointer move during playback */
  onPointerMove?: (pointer: NormalizedPointer) => void;
  /** Called on pointer up during playback */
  onPointerUp?: (pointer: NormalizedPointer) => void;
  /** Called on pointer cancel during playback */
  onPointerCancel?: (pointer: NormalizedPointer) => void;
  /** Called when playback starts */
  onPlaybackStart?: () => void;
  /** Called when playback ends */
  onPlaybackEnd?: () => void;
  /** Called on playback progress (0-1) */
  onPlaybackProgress?: (progress: number) => void;
}

/**
 * Playback options
 */
export interface PlaybackOptions {
  /** Playback speed multiplier (default: 1.0) */
  speed?: number;
  /** Loop playback (default: false) */
  loop?: boolean;
  /** Start time offset in ms (default: 0) */
  startOffset?: number;
  /** End time in ms (default: recording duration) */
  endTime?: number;
}

const DEFAULT_PLAYBACK_OPTIONS: Required<PlaybackOptions> = {
  speed: 1.0,
  loop: false,
  startOffset: 0,
  endTime: Infinity,
};

/**
 * InputRecorder - Record and playback input sequences
 */
export class InputRecorder {
  // Recording state
  private isRecording: boolean = false;
  private recordingStartTime: number = 0;
  private recordedEvents: RecordedEvent[] = [];
  
  // Playback state
  private isPlaying: boolean = false;
  private playbackCallbacks: PlaybackCallbacks = {};
  private playbackOptions: Required<PlaybackOptions> = { ...DEFAULT_PLAYBACK_OPTIONS };
  private currentRecording: InputRecording | null = null;
  private playbackStartTime: number = 0;
  private playbackEventIndex: number = 0;
  private playbackAnimationId: number | null = null;
  private pausedTime: number | null = null;

  /**
   * Start recording
   */
  startRecording(): void {
    if (this.isRecording) {
      console.warn('InputRecorder: Already recording');
      return;
    }
    
    this.isRecording = true;
    this.recordingStartTime = performance.now();
    this.recordedEvents = [];
  }

  /**
   * Stop recording and return the recording
   */
  stopRecording(customMetadata?: Record<string, unknown>): InputRecording {
    if (!this.isRecording) {
      console.warn('InputRecorder: Not recording');
      return this.createEmptyRecording();
    }
    
    this.isRecording = false;
    const duration = performance.now() - this.recordingStartTime;
    
    const recording: InputRecording = {
      version: 1,
      metadata: {
        startTime: this.recordingStartTime,
        duration,
        eventCount: this.recordedEvents.length,
        viewport: {
          width: typeof window !== 'undefined' ? window.innerWidth : 0,
          height: typeof window !== 'undefined' ? window.innerHeight : 0,
        },
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        custom: customMetadata,
      },
      events: [...this.recordedEvents],
    };
    
    this.recordedEvents = [];
    return recording;
  }

  /**
   * Cancel recording without returning data
   */
  cancelRecording(): void {
    this.isRecording = false;
    this.recordedEvents = [];
  }

  /**
   * Record a pointer down event
   */
  recordPointerDown(pointer: NormalizedPointer): void {
    this.recordEvent('pointerdown', pointer);
  }

  /**
   * Record a pointer move event
   */
  recordPointerMove(pointer: NormalizedPointer): void {
    this.recordEvent('pointermove', pointer);
  }

  /**
   * Record a pointer up event
   */
  recordPointerUp(pointer: NormalizedPointer): void {
    this.recordEvent('pointerup', pointer);
  }

  /**
   * Record a pointer cancel event
   */
  recordPointerCancel(pointer: NormalizedPointer): void {
    this.recordEvent('pointercancel', pointer);
  }

  /**
   * Record an event
   */
  private recordEvent(type: RecordedEventType, pointer: NormalizedPointer): void {
    if (!this.isRecording) return;
    
    this.recordedEvents.push({
      type,
      time: performance.now() - this.recordingStartTime,
      pointer: { ...pointer },
    });
  }

  /**
   * Get recording status
   */
  get recording(): boolean {
    return this.isRecording;
  }

  /**
   * Get current recording event count
   */
  get recordedEventCount(): number {
    return this.recordedEvents.length;
  }

  // --- Playback ---

  /**
   * Start playback of a recording
   */
  startPlayback(
    recording: InputRecording,
    callbacks: PlaybackCallbacks,
    options: PlaybackOptions = {}
  ): void {
    if (this.isPlaying) {
      this.stopPlayback();
    }
    
    this.currentRecording = recording;
    this.playbackCallbacks = callbacks;
    this.playbackOptions = { ...DEFAULT_PLAYBACK_OPTIONS, ...options };
    
    // Set end time if not specified
    if (this.playbackOptions.endTime === Infinity) {
      this.playbackOptions.endTime = recording.metadata.duration;
    }
    
    this.isPlaying = true;
    this.playbackStartTime = performance.now() - (this.playbackOptions.startOffset / this.playbackOptions.speed);
    this.playbackEventIndex = this.findEventIndex(this.playbackOptions.startOffset);
    this.pausedTime = null;
    
    this.playbackCallbacks.onPlaybackStart?.();
    this.playbackAnimationId = requestAnimationFrame(this.playbackLoop);
  }

  /**
   * Stop playback
   */
  stopPlayback(): void {
    if (this.playbackAnimationId !== null) {
      cancelAnimationFrame(this.playbackAnimationId);
      this.playbackAnimationId = null;
    }
    
    if (this.isPlaying) {
      this.isPlaying = false;
      this.playbackCallbacks.onPlaybackEnd?.();
    }
    
    this.currentRecording = null;
    this.playbackCallbacks = {};
    this.pausedTime = null;
  }

  /**
   * Pause playback
   */
  pausePlayback(): void {
    if (!this.isPlaying || this.pausedTime !== null) return;
    
    this.pausedTime = this.getCurrentPlaybackTime();
    
    if (this.playbackAnimationId !== null) {
      cancelAnimationFrame(this.playbackAnimationId);
      this.playbackAnimationId = null;
    }
  }

  /**
   * Resume playback
   */
  resumePlayback(): void {
    if (!this.isPlaying || this.pausedTime === null) return;
    
    this.playbackStartTime = performance.now() - (this.pausedTime / this.playbackOptions.speed);
    this.pausedTime = null;
    this.playbackAnimationId = requestAnimationFrame(this.playbackLoop);
  }

  /**
   * Seek to a specific time in ms
   */
  seekTo(time: number): void {
    if (!this.currentRecording) return;
    
    const clampedTime = Math.max(0, Math.min(time, this.currentRecording.metadata.duration));
    
    if (this.pausedTime !== null) {
      this.pausedTime = clampedTime;
    } else {
      this.playbackStartTime = performance.now() - (clampedTime / this.playbackOptions.speed);
    }
    
    this.playbackEventIndex = this.findEventIndex(clampedTime);
  }

  /**
   * Get playback status
   */
  get playing(): boolean {
    return this.isPlaying && this.pausedTime === null;
  }

  /**
   * Get paused status
   */
  get paused(): boolean {
    return this.isPlaying && this.pausedTime !== null;
  }

  /**
   * Get current playback time in ms
   */
  getCurrentPlaybackTime(): number {
    if (this.pausedTime !== null) {
      return this.pausedTime;
    }
    if (!this.isPlaying) {
      return 0;
    }
    return (performance.now() - this.playbackStartTime) * this.playbackOptions.speed;
  }

  /**
   * Get playback progress (0-1)
   */
  getPlaybackProgress(): number {
    if (!this.currentRecording) return 0;
    const time = this.getCurrentPlaybackTime();
    const start = this.playbackOptions.startOffset;
    const end = this.playbackOptions.endTime;
    return (time - start) / (end - start);
  }

  /**
   * Find event index for a given time
   */
  private findEventIndex(time: number): number {
    if (!this.currentRecording) return 0;
    
    const events = this.currentRecording.events;
    for (let i = 0; i < events.length; i++) {
      if (events[i].time >= time) {
        return i;
      }
    }
    return events.length;
  }

  /**
   * Playback loop
   */
  private playbackLoop = (): void => {
    if (!this.isPlaying || !this.currentRecording || this.pausedTime !== null) {
      return;
    }
    
    const currentTime = this.getCurrentPlaybackTime();
    const events = this.currentRecording.events;
    
    // Process events up to current time
    while (this.playbackEventIndex < events.length) {
      const event = events[this.playbackEventIndex];
      
      if (event.time > currentTime) {
        break;
      }
      
      if (event.time <= this.playbackOptions.endTime) {
        this.dispatchEvent(event);
      }
      
      this.playbackEventIndex++;
    }
    
    // Report progress
    this.playbackCallbacks.onPlaybackProgress?.(this.getPlaybackProgress());
    
    // Check if playback is complete
    if (currentTime >= this.playbackOptions.endTime) {
      if (this.playbackOptions.loop) {
        // Reset for loop
        this.playbackStartTime = performance.now() - (this.playbackOptions.startOffset / this.playbackOptions.speed);
        this.playbackEventIndex = this.findEventIndex(this.playbackOptions.startOffset);
      } else {
        this.stopPlayback();
        return;
      }
    }
    
    this.playbackAnimationId = requestAnimationFrame(this.playbackLoop);
  };

  /**
   * Dispatch a recorded event
   */
  private dispatchEvent(event: RecordedEvent): void {
    switch (event.type) {
      case 'pointerdown':
        this.playbackCallbacks.onPointerDown?.(event.pointer);
        break;
      case 'pointermove':
        this.playbackCallbacks.onPointerMove?.(event.pointer);
        break;
      case 'pointerup':
        this.playbackCallbacks.onPointerUp?.(event.pointer);
        break;
      case 'pointercancel':
        this.playbackCallbacks.onPointerCancel?.(event.pointer);
        break;
    }
  }

  /**
   * Create an empty recording
   */
  private createEmptyRecording(): InputRecording {
    return {
      version: 1,
      metadata: {
        startTime: 0,
        duration: 0,
        eventCount: 0,
        viewport: { width: 0, height: 0 },
        userAgent: '',
      },
      events: [],
    };
  }

  // --- Serialization ---

  /**
   * Serialize a recording to JSON string
   */
  static serialize(recording: InputRecording): string {
    return JSON.stringify(recording);
  }

  /**
   * Deserialize a recording from JSON string
   */
  static deserialize(json: string): InputRecording {
    const data = JSON.parse(json);
    
    // Validate structure
    if (data.version !== 1) {
      throw new Error(`Unsupported recording version: ${data.version}`);
    }
    
    if (!data.metadata || !Array.isArray(data.events)) {
      throw new Error('Invalid recording format');
    }
    
    return data as InputRecording;
  }

  // --- Touch Simulation ---

  /**
   * Create a simulated tap recording
   */
  static createTap(x: number, y: number, options: {
    duration?: number;
    pointerId?: number;
    type?: 'mouse' | 'touch' | 'pen';
  } = {}): InputRecording {
    const duration = options.duration ?? 50;
    const pointerId = options.pointerId ?? 1;
    const type = options.type ?? 'touch';
    
    const basePointer: NormalizedPointer = {
      id: pointerId,
      x,
      y,
      clientX: x,
      clientY: y,
      deltaX: 0,
      deltaY: 0,
      type,
      pressure: type === 'mouse' ? 0 : 0.5,
      isPrimary: true,
      timestamp: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      width: type === 'touch' ? 20 : 1,
      height: type === 'touch' ? 20 : 1,
    };
    
    return {
      version: 1,
      metadata: {
        startTime: performance.now(),
        duration,
        eventCount: 2,
        viewport: { width: window?.innerWidth ?? 0, height: window?.innerHeight ?? 0 },
        userAgent: navigator?.userAgent ?? '',
      },
      events: [
        { type: 'pointerdown', time: 0, pointer: { ...basePointer, timestamp: 0 } },
        { type: 'pointerup', time: duration, pointer: { ...basePointer, timestamp: duration } },
      ],
    };
  }

  /**
   * Create a simulated drag recording
   */
  static createDrag(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options: {
      duration?: number;
      steps?: number;
      pointerId?: number;
      type?: 'mouse' | 'touch' | 'pen';
    } = {}
  ): InputRecording {
    const duration = options.duration ?? 300;
    const steps = options.steps ?? 20;
    const pointerId = options.pointerId ?? 1;
    const type = options.type ?? 'touch';
    
    const events: RecordedEvent[] = [];
    
    // Down event
    events.push({
      type: 'pointerdown',
      time: 0,
      pointer: {
        id: pointerId,
        x: startX,
        y: startY,
        clientX: startX,
        clientY: startY,
        deltaX: 0,
        deltaY: 0,
        type,
        pressure: type === 'mouse' ? 0 : 0.5,
        isPrimary: true,
        timestamp: 0,
        tiltX: 0,
        tiltY: 0,
        twist: 0,
        width: type === 'touch' ? 20 : 1,
        height: type === 'touch' ? 20 : 1,
      },
    });
    
    // Move events
    let prevX = startX;
    let prevY = startY;
    
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const time = duration * t;
      const x = startX + (endX - startX) * t;
      const y = startY + (endY - startY) * t;
      
      events.push({
        type: 'pointermove',
        time,
        pointer: {
          id: pointerId,
          x,
          y,
          clientX: x,
          clientY: y,
          deltaX: x - prevX,
          deltaY: y - prevY,
          type,
          pressure: type === 'mouse' ? 0 : 0.5,
          isPrimary: true,
          timestamp: time,
          tiltX: 0,
          tiltY: 0,
          twist: 0,
          width: type === 'touch' ? 20 : 1,
          height: type === 'touch' ? 20 : 1,
        },
      });
      
      prevX = x;
      prevY = y;
    }
    
    // Up event
    events.push({
      type: 'pointerup',
      time: duration,
      pointer: {
        id: pointerId,
        x: endX,
        y: endY,
        clientX: endX,
        clientY: endY,
        deltaX: 0,
        deltaY: 0,
        type,
        pressure: 0,
        isPrimary: true,
        timestamp: duration,
        tiltX: 0,
        tiltY: 0,
        twist: 0,
        width: type === 'touch' ? 20 : 1,
        height: type === 'touch' ? 20 : 1,
      },
    });
    
    return {
      version: 1,
      metadata: {
        startTime: performance.now(),
        duration,
        eventCount: events.length,
        viewport: { width: window?.innerWidth ?? 0, height: window?.innerHeight ?? 0 },
        userAgent: navigator?.userAgent ?? '',
      },
      events,
    };
  }

  /**
   * Create a simulated pinch recording
   */
  static createPinch(
    centerX: number,
    centerY: number,
    startDistance: number,
    endDistance: number,
    options: {
      duration?: number;
      steps?: number;
      rotation?: number; // radians
    } = {}
  ): InputRecording {
    const duration = options.duration ?? 300;
    const steps = options.steps ?? 20;
    const rotation = options.rotation ?? 0;
    
    const events: RecordedEvent[] = [];
    
    // Calculate start and end positions for two fingers
    const getFingerPositions = (distance: number, angle: number) => {
      const halfDist = distance / 2;
      return {
        finger1: {
          x: centerX - Math.cos(angle) * halfDist,
          y: centerY - Math.sin(angle) * halfDist,
        },
        finger2: {
          x: centerX + Math.cos(angle) * halfDist,
          y: centerY + Math.sin(angle) * halfDist,
        },
      };
    };
    
    const startAngle = 0;
    const startPos = getFingerPositions(startDistance, startAngle);
    
    // Down events for both fingers
    const createPointer = (id: number, x: number, y: number, time: number, deltaX = 0, deltaY = 0): NormalizedPointer => ({
      id,
      x,
      y,
      clientX: x,
      clientY: y,
      deltaX,
      deltaY,
      type: 'touch',
      pressure: 0.5,
      isPrimary: id === 1,
      timestamp: time,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      width: 20,
      height: 20,
    });
    
    events.push({ type: 'pointerdown', time: 0, pointer: createPointer(1, startPos.finger1.x, startPos.finger1.y, 0) });
    events.push({ type: 'pointerdown', time: 0, pointer: createPointer(2, startPos.finger2.x, startPos.finger2.y, 0) });
    
    // Move events
    let prevPos = startPos;
    
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const time = duration * t;
      const currentDistance = startDistance + (endDistance - startDistance) * t;
      const currentAngle = startAngle + rotation * t;
      const pos = getFingerPositions(currentDistance, currentAngle);
      
      events.push({
        type: 'pointermove',
        time,
        pointer: createPointer(
          1,
          pos.finger1.x,
          pos.finger1.y,
          time,
          pos.finger1.x - prevPos.finger1.x,
          pos.finger1.y - prevPos.finger1.y
        ),
      });
      
      events.push({
        type: 'pointermove',
        time,
        pointer: createPointer(
          2,
          pos.finger2.x,
          pos.finger2.y,
          time,
          pos.finger2.x - prevPos.finger2.x,
          pos.finger2.y - prevPos.finger2.y
        ),
      });
      
      prevPos = pos;
    }
    
    // Up events
    const endPos = getFingerPositions(endDistance, startAngle + rotation);
    events.push({ type: 'pointerup', time: duration, pointer: createPointer(1, endPos.finger1.x, endPos.finger1.y, duration) });
    events.push({ type: 'pointerup', time: duration, pointer: createPointer(2, endPos.finger2.x, endPos.finger2.y, duration) });
    
    return {
      version: 1,
      metadata: {
        startTime: performance.now(),
        duration,
        eventCount: events.length,
        viewport: { width: window?.innerWidth ?? 0, height: window?.innerHeight ?? 0 },
        userAgent: navigator?.userAgent ?? '',
      },
      events,
    };
  }

  /**
   * Destroy the recorder
   */
  destroy(): void {
    this.cancelRecording();
    this.stopPlayback();
  }
}
