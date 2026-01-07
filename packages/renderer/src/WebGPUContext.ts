/**
 * WebGPUContext
 * 
 * Manages WebGPU adapter, device, and context initialization.
 * Provides availability detection and graceful degradation.
 */

/// <reference types="@webgpu/types" />

export interface WebGPUContextOptions {
  canvas: HTMLCanvasElement;
  powerPreference?: GPUPowerPreference;
  alphaMode?: GPUCanvasAlphaMode;
}

export interface WebGPUContextState {
  isAvailable: boolean;
  adapter: GPUAdapter | null;
  device: GPUDevice | null;
  context: GPUCanvasContext | null;
  format: GPUTextureFormat | null;
  canvas: HTMLCanvasElement;
}

export class WebGPUContext {
  private state: WebGPUContextState;

  constructor() {
    this.state = {
      isAvailable: false,
      adapter: null,
      device: null,
      context: null,
      format: null,
      canvas: null as unknown as HTMLCanvasElement
    };
  }

  /**
   * Best-effort teardown of existing GPU state.
   * WebGPU resources are finite; re-initialization must not leak.
   */
  private teardownExistingResources(): void {
    // Unconfigure the canvas context if supported (releases swapchain resources).
    try {
      (this.state.context as unknown as { unconfigure?: () => void } | null)?.unconfigure?.();
    } catch {
      // Ignore; unconfigure is not universally implemented.
    }

    // Destroy the device to release GPU allocations.
    if (this.state.device) {
      try {
        this.state.device.destroy();
      } catch {
        // Ignore double-destroy / already-lost device edge cases.
      }
    }
  }

  /**
   * Check if WebGPU is available in the current environment
   */
  static async checkAvailability(): Promise<boolean> {
    if (!navigator.gpu) {
      console.warn('WebGPU is not supported in this browser');
      return false;
    }

    try {
      const adapter: GPUAdapter | null = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.warn('Failed to get WebGPU adapter');
        return false;
      }
      return true;
    } catch (error: unknown) {
      console.warn('WebGPU availability check failed:', error);
      return false;
    }
  }

  /**
   * Initialize WebGPU context with the provided canvas
   */
  async initialize(options: WebGPUContextOptions): Promise<boolean> {
    // If initialize() is called multiple times on the same instance, ensure we
    // tear down any previously-created GPU resources to avoid leaks.
    if (this.state.device || this.state.context) {
      this.teardownExistingResources();
      this.state = {
        isAvailable: false,
        adapter: null,
        device: null,
        context: null,
        format: null,
        canvas: options.canvas
      };
    }

    // Check if WebGPU is available
    if (!navigator.gpu) {
      console.warn('WebGPU is not supported - Scene will run in degraded mode');
      this.state.isAvailable = false;
      this.state.canvas = options.canvas;
      return false;
    }

    try {
      // Request adapter
      const adapter: GPUAdapter | null = await navigator.gpu.requestAdapter({
        powerPreference: options.powerPreference || 'high-performance'
      });

      if (!adapter) {
        console.warn('Failed to get WebGPU adapter - Scene will run in degraded mode');
        this.state.isAvailable = false;
        this.state.canvas = options.canvas;
        return false;
      }

      // Request device
      const device: GPUDevice = await adapter.requestDevice();

      // Handle device lost
      device.lost.then((info: GPUDeviceLostInfo) => {
        // Avoid clobbering state if this instance has been re-initialized with
        // a different device since this handler was registered.
        if (this.state.device !== device) return;
        console.error(`WebGPU device lost: ${info.message}`);
        this.state.isAvailable = false;
        // Emit error event if EventBus is available
        this.handleDeviceLost(info);
      });

      // Get canvas context
      const context: GPUCanvasContext | null = options.canvas.getContext('webgpu');
      if (!context) {
        console.warn('Failed to get WebGPU canvas context');
        device.destroy(); // Clean up device before returning
        this.state.isAvailable = false;
        this.state.canvas = options.canvas;
        return false;
      }

      // Get preferred format
      const format: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();

      // Configure context
      try {
        context.configure({
          device,
          format,
          alphaMode: options.alphaMode || 'premultiplied',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
        });
      } catch (configError: unknown) {
        console.error('Failed to configure WebGPU context:', configError);
        device.destroy(); // Clean up device before returning
        this.state.isAvailable = false;
        this.state.canvas = options.canvas;
        return false;
      }

      // Update state
      this.state = {
        isAvailable: true,
        adapter,
        device,
        context,
        format,
        canvas: options.canvas
      };

      console.log('WebGPU initialized successfully');
      return true;

    } catch (error: unknown) {
      console.error('WebGPU initialization failed:', error);
      this.state.isAvailable = false;
      this.state.canvas = options.canvas;
      return false;
    }
  }

  /**
   * Handle device lost event
   */
  private handleDeviceLost(info: GPUDeviceLostInfo): void {
    // This will be connected to EventBus in Engine
    console.warn('Device lost reason:', info.reason);
  }

  /**
   * Get the current GPU device
   */
  get device(): GPUDevice | null {
    return this.state.device;
  }

  /**
   * Get the canvas context
   */
  get context(): GPUCanvasContext | null {
    return this.state.context;
  }

  /**
   * Get the preferred texture format
   */
  get format(): GPUTextureFormat | null {
    return this.state.format;
  }

  /**
   * Check if WebGPU is available and initialized
   */
  get isAvailable(): boolean {
    return this.state.isAvailable;
  }

  /**
   * Get the canvas element
   */
  get canvas(): HTMLCanvasElement {
    return this.state.canvas;
  }

  /**
   * Resize the canvas to match its display size
   */
  resize(width: number, height: number, pixelRatio: number = window.devicePixelRatio): void {
    if (!this.state.canvas) return;

    const canvas: HTMLCanvasElement = this.state.canvas;
    const scaledWidth: number = Math.floor(width * pixelRatio);
    const scaledHeight: number = Math.floor(height * pixelRatio);

    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
    }

    // Update canvas CSS size
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  /**
   * Cleanup and destroy the context
   */
  destroy(): void {
    this.teardownExistingResources();

    this.state = {
      isAvailable: false,
      adapter: null,
      device: null,
      context: null,
      format: null,
      canvas: null as unknown as HTMLCanvasElement
    };
  }
}
