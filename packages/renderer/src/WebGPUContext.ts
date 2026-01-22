/**
 * WebGPUContext
 * 
 * Manages WebGPU adapter, device, and context initialization.
 * Provides availability detection and graceful degradation.
 * 
 * Browser Compatibility:
 * - Chrome/Edge 113+: Full support
 * - Firefox 121+: Full support (behind flag in earlier versions)
 * - Safari 17+: Full support (iOS 17.4+ enabled by default, 17.0-17.3 behind flag)
 * - iOS Safari: Requires iOS 17+ (iOS 16 and earlier not supported)
 */

/// <reference types="@webgpu/types" />

/**
 * Browser detection information
 */
export interface BrowserInfo {
  /** Whether the browser is Safari (desktop or iOS) */
  isSafari: boolean;
  /** Whether running on iOS (iPhone/iPad) */
  isIOS: boolean;
  /** Whether running on iPadOS */
  isIPadOS: boolean;
  /** Whether this is iOS Safari specifically */
  isIOSSafari: boolean;
  /** Whether this is a mobile device */
  isMobile: boolean;
  /** Detected iOS version (major.minor) or null */
  iosVersion: { major: number; minor: number } | null;
}

/**
 * WebGPU capability information
 */
export interface WebGPUCapabilities {
  /** Maximum texture dimension (2D) */
  maxTextureDimension2D: number;
  /** Maximum buffer size */
  maxBufferSize: number;
  /** Maximum uniform buffer binding size */
  maxUniformBufferBindingSize: number;
  /** Preferred canvas format */
  preferredFormat: GPUTextureFormat | null;
  /** Available features */
  features: string[];
}

/**
 * Progress information during WebGPU initialization
 */
export interface WebGPUInitProgress {
  /** Current step (0-100) */
  percent: number;
  /** Human-readable status message */
  message: string;
  /** Step identifier for programmatic use */
  step: 'checking' | 'adapter' | 'device' | 'context' | 'configuring' | 'ready' | 'failed';
}

export interface WebGPUContextOptions {
  canvas: HTMLCanvasElement;
  powerPreference?: GPUPowerPreference;
  alphaMode?: GPUCanvasAlphaMode;
  /** Progress callback during initialization */
  onProgress?: (progress: WebGPUInitProgress) => void;
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
  private _browserInfo: BrowserInfo | null = null;
  private _capabilities: WebGPUCapabilities | null = null;

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
   * Detect browser and platform information
   * Useful for Safari/iOS-specific handling
   */
  static detectBrowser(): BrowserInfo {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    
    // iOS detection (iPhone/iPod)
    const isIPhone = /iPhone|iPod/.test(ua);
    
    // iPad detection (including iPadOS 13+ which reports as Mac)
    const isIPad = /iPad/.test(ua) || 
      (typeof navigator !== 'undefined' && 
       navigator.platform === 'MacIntel' && 
       navigator.maxTouchPoints > 1);
    
    const isIOS = isIPhone || isIPad;
    
    // Safari detection (not Chrome/Firefox pretending to be Safari)
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    
    // Mobile detection
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/.test(ua) || isIPad;
    
    // iOS version extraction
    let iosVersion: { major: number; minor: number } | null = null;
    if (isIOS) {
      // Try to extract from "OS X_Y" pattern
      const match = ua.match(/OS (\d+)[_.](\d+)/);
      if (match) {
        iosVersion = {
          major: parseInt(match[1], 10),
          minor: parseInt(match[2], 10)
        };
      }
    }
    
    return {
      isSafari,
      isIOS,
      isIPadOS: isIPad,
      isIOSSafari: isIOS && isSafari,
      isMobile,
      iosVersion
    };
  }

  /**
   * Get cached browser information
   */
  get browserInfo(): BrowserInfo {
    if (!this._browserInfo) {
      this._browserInfo = WebGPUContext.detectBrowser();
    }
    return this._browserInfo;
  }

  /**
   * Check if WebGPU is expected to be supported based on browser version
   * Note: This is a heuristic - actual support depends on runtime checks
   */
  static checkExpectedSupport(): { supported: boolean; reason: string } {
    const browser = WebGPUContext.detectBrowser();
    
    if (browser.isIOSSafari) {
      if (browser.iosVersion) {
        if (browser.iosVersion.major < 17) {
          return {
            supported: false,
            reason: `iOS ${browser.iosVersion.major}.${browser.iosVersion.minor} does not support WebGPU. iOS 17+ required.`
          };
        }
        if (browser.iosVersion.major === 17 && browser.iosVersion.minor < 4) {
          return {
            supported: true,
            reason: `iOS ${browser.iosVersion.major}.${browser.iosVersion.minor} supports WebGPU but may require enabling it in Settings > Safari > Advanced > Feature Flags > WebGPU`
          };
        }
      }
      return {
        supported: true,
        reason: 'iOS Safari 17.4+ has WebGPU enabled by default'
      };
    }
    
    if (browser.isSafari) {
      return {
        supported: true,
        reason: 'Safari 17+ supports WebGPU'
      };
    }
    
    // For other browsers, assume support and let runtime check handle it
    return {
      supported: true,
      reason: 'Modern browsers (Chrome 113+, Firefox 121+, Edge 113+) support WebGPU'
    };
  }

  /**
   * Get WebGPU capabilities (after initialization)
   */
  get capabilities(): WebGPUCapabilities | null {
    return this._capabilities;
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
      // Provide helpful message for iOS Safari users
      const browser = WebGPUContext.detectBrowser();
      if (browser.isIOSSafari) {
        const support = WebGPUContext.checkExpectedSupport();
        console.warn(`WebGPU not available: ${support.reason}`);
      } else {
        console.warn('WebGPU is not supported in this browser');
      }
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
   * Populate WebGPU capabilities from adapter/device
   */
  private populateCapabilities(adapter: GPUAdapter, device: GPUDevice): void {
    const limits = device.limits;
    const features: string[] = [];
    
    // Collect supported features
    adapter.features.forEach((feature: string) => {
      features.push(feature);
    });
    
    this._capabilities = {
      maxTextureDimension2D: limits.maxTextureDimension2D,
      maxBufferSize: limits.maxBufferSize,
      maxUniformBufferBindingSize: limits.maxUniformBufferBindingSize,
      preferredFormat: navigator.gpu?.getPreferredCanvasFormat() ?? null,
      features
    };
  }

  /**
   * Initialize WebGPU context with the provided canvas
   */
  async initialize(options: WebGPUContextOptions): Promise<boolean> {
    const { onProgress } = options;
    
    const reportProgress = (percent: number, message: string, step: WebGPUInitProgress['step']) => {
      onProgress?.({ percent, message, step });
    };

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
    const browser = this.browserInfo;
    
    reportProgress(5, 'Checking WebGPU support', 'checking');
    
    // Enhanced diagnostics for debugging
    console.info(`[WebGPU] Browser: ${browser.isIOSSafari ? 'iOS Safari' : browser.isSafari ? 'Safari' : 'Other'}${browser.iosVersion ? ` (iOS ${browser.iosVersion.major}.${browser.iosVersion.minor})` : ''}`);
    console.info(`[WebGPU] Secure context (HTTPS): ${window.isSecureContext}`);
    console.info(`[WebGPU] navigator.gpu exists: ${!!navigator.gpu}`);
    
    if (!navigator.gpu) {
      const support = WebGPUContext.checkExpectedSupport();
      console.warn(`[WebGPU] Not available: ${support.reason}`);
      reportProgress(100, 'WebGPU not available', 'failed');
      this.state.isAvailable = false;
      this.state.canvas = options.canvas;
      return false;
    }

    try {
      // Request adapter with appropriate power preference
      // On mobile Safari, prefer low-power to conserve battery unless explicitly requested
      const powerPref = options.powerPreference || 
        (browser.isMobile ? 'low-power' : 'high-performance');
      
      reportProgress(15, 'Requesting adapter', 'adapter');
      console.info(`[WebGPU] Requesting adapter (powerPreference: ${powerPref})...`);
      const adapter: GPUAdapter | null = await navigator.gpu.requestAdapter({
        powerPreference: powerPref
      });

      if (!adapter) {
        console.warn('[WebGPU] requestAdapter() returned null - no suitable GPU found');
        reportProgress(100, 'No suitable GPU found', 'failed');
        this.state.isAvailable = false;
        this.state.canvas = options.canvas;
        return false;
      }
      
      console.info(`[WebGPU] Adapter acquired, features: ${[...adapter.features].join(', ') || 'none'}`);
      
      reportProgress(35, 'Requesting device', 'device');
      console.info(`[WebGPU] Requesting device...`);

      // Request device
      const device: GPUDevice = await adapter.requestDevice();
      console.info('[WebGPU] Device acquired');

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
      reportProgress(55, 'Getting canvas context', 'context');
      console.info('[WebGPU] Getting canvas context...');
      const context: GPUCanvasContext | null = options.canvas.getContext('webgpu');
      if (!context) {
        console.warn('[WebGPU] canvas.getContext("webgpu") returned null');
        reportProgress(100, 'Canvas context unavailable', 'failed');
        device.destroy(); // Clean up device before returning
        this.state.isAvailable = false;
        this.state.canvas = options.canvas;
        return false;
      }

      // Get preferred format
      const format: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();

      // Configure context
      reportProgress(75, 'Configuring context', 'configuring');
      console.info(`[WebGPU] Configuring context (format: ${format})...`);
      try {
        context.configure({
          device,
          format,
          alphaMode: options.alphaMode || 'premultiplied',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
        });
      } catch (configError: unknown) {
        console.error('[WebGPU] context.configure() failed:', configError);
        reportProgress(100, 'Context configuration failed', 'failed');
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

      // Populate capabilities for feature detection
      this.populateCapabilities(adapter, device);

      reportProgress(100, 'Ready', 'ready');
      console.info(`[WebGPU] Initialized successfully`);
      return true;

    } catch (error: unknown) {
      console.error('[WebGPU] Initialization failed:', error);
      reportProgress(100, 'Initialization failed', 'failed');
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
   * Reconfigure the context for a different canvas element.
   * Reuses the existing adapter and device, avoiding full re-initialization.
   * Useful when the component remounts but we want to keep the same GPU context.
   */
  reconfigure(canvas: HTMLCanvasElement, alphaMode: GPUCanvasAlphaMode = 'premultiplied'): boolean {
    if (!this.state.device || !this.state.format) {
      console.warn('[WebGPU] Cannot reconfigure: device not initialized');
      return false;
    }

    // Unconfigure old context if it exists
    try {
      (this.state.context as unknown as { unconfigure?: () => void } | null)?.unconfigure?.();
    } catch {
      // Ignore; unconfigure is not universally implemented
    }

    // Get new canvas context
    const context = canvas.getContext('webgpu');
    if (!context) {
      console.warn('[WebGPU] canvas.getContext("webgpu") returned null during reconfigure');
      return false;
    }

    // Configure new context with existing device
    try {
      context.configure({
        device: this.state.device,
        format: this.state.format,
        alphaMode,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
      });
    } catch (error) {
      console.error('[WebGPU] reconfigure() failed:', error);
      return false;
    }

    // Update state
    this.state.canvas = canvas;
    this.state.context = context;
    
    return true;
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
