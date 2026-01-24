/**
 * useGPU - Hook for WebGPU context initialization
 * 
 * Provides declarative WebGPU setup with automatic cleanup,
 * fallback handling, and integration with SceneProvider.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { WebGPUContext, ShaderLibrary } from '@scene/renderer';
import { useSceneContext } from './SceneProvider';
import { InteractionMode } from '@scene/core';

type GlobalGPUState = {
  initPromise: Promise<{ context: WebGPUContext; shaderLibrary: ShaderLibrary } | null> | null;
  context: WebGPUContext | null;
  shaderLibrary: ShaderLibrary | null;
  refCount: number;
  destroyTimeout: ReturnType<typeof setTimeout> | null;
};

const getGlobalGPUState = (): GlobalGPUState => {
  const root = globalThis as typeof globalThis & { __sceneGPUState?: GlobalGPUState };
  if (!root.__sceneGPUState) {
    root.__sceneGPUState = {
      initPromise: null,
      context: null,
      shaderLibrary: null,
      refCount: 0,
      destroyTimeout: null,
    };
  }
  return root.__sceneGPUState;
};

/**
 * GPU initialization options
 */
export interface UseGPUOptions {
  /** Power preference for GPU adapter (default: 'high-performance') */
  powerPreference?: 'high-performance' | 'low-power';
  /** Alpha mode for canvas (default: 'premultiplied') */
  alphaMode?: 'opaque' | 'premultiplied';
  /** Custom shader registration callback (called after defaults are registered) */
  onRegisterShaders?: (library: ShaderLibrary) => void;
  /** Callback when GPU is ready */
  onReady?: (context: WebGPUContext, library: ShaderLibrary) => void;
  /** Callback when GPU initialization fails */
  onFallback?: (reason: string) => void;
  /** Force fallback mode for testing (default: false) */
  forceFallback?: boolean;
}

/**
 * GPU initialization progress state
 */
export interface GPUProgress {
  /** Current progress percentage (0-100) */
  percent: number;
  /** Human-readable status message */
  message: string;
  /** Whether initialization is in progress */
  isLoading: boolean;
}

/**
 * GPU state and resources
 */
export interface UseGPUReturn {
  /** The WebGPU context (null if not ready) */
  context: WebGPUContext | null;
  /** The shader library (null if not ready) */
  shaderLibrary: ShaderLibrary | null;
  /** The GPU device (null if not ready) */
  device: GPUDevice | null;
  /** Whether GPU is ready for rendering */
  isReady: boolean;
  /** Whether GPU initialization failed */
  isFallback: boolean;
  /** Fallback reason message */
  fallbackReason: string | null;
  /** Initialization progress */
  progress: GPUProgress;
  /** Browser info for debugging */
  browserInfo: {
    isIOSSafari: boolean;
    iosVersion: { major: number; minor: number } | null;
  } | null;
  /** Re-initialize GPU (useful after context loss) */
  reinitialize: () => Promise<boolean>;
}

/**
 * Hook for WebGPU context management
 * 
 * Handles:
 * - WebGPU context creation and initialization
 * - ShaderLibrary setup with default + transition shaders
 * - Canvas binding and resize handling
 * - Graceful fallback for unsupported browsers
 * - Automatic cleanup on unmount
 * 
 * @param canvasRef - Ref to the canvas element
 * @param options - GPU initialization options
 * 
 * @example
 * ```tsx
 * function GPUScene() {
 *   const canvasRef = useRef<HTMLCanvasElement>(null);
 *   const { context, shaderLibrary, isReady, isFallback, fallbackReason } = useGPU(canvasRef, {
 *     powerPreference: 'high-performance',
 *     onReady: (ctx, lib) => {
 *       // Set up your renderer here
 *       myRenderer.initialize(ctx, lib);
 *     },
 *     onFallback: (reason) => {
 *       console.warn('WebGPU unavailable:', reason);
 *     },
 *   });
 *   
 *   return (
 *     <div>
 *       <canvas ref={canvasRef} />
 *       {isFallback && <p>{fallbackReason}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useGPU(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: UseGPUOptions = {}
): UseGPUReturn {
  const {
    powerPreference = 'high-performance',
    alphaMode = 'premultiplied',
    onRegisterShaders,
    onReady,
    onFallback,
    forceFallback = false,
  } = options;

  const globalState = getGlobalGPUState();

  // Get scene context for mode management
  const { engine } = useSceneContext();

  // Refs for stable instances
  const contextRef = useRef<WebGPUContext | null>(null);
  const shaderLibraryRef = useRef<ShaderLibrary | null>(null);
  const initIdRef = useRef(0);
  const initializingRef = useRef(false);

  // State
  const [isReady, setIsReady] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [browserInfo, setBrowserInfo] = useState<UseGPUReturn['browserInfo']>(null);
  // Store context in state so React properly tracks changes for consumers
  const [gpuContext, setGpuContext] = useState<WebGPUContext | null>(null);
  const [shaderLib, setShaderLib] = useState<ShaderLibrary | null>(null);
  // Progress tracking
  const [progress, setProgress] = useState<GPUProgress>({
    percent: 0,
    message: 'Initializing',
    isLoading: true,
  });

  // Stable callback refs (avoids re-initialization when callbacks change)
  const onReadyRef = useRef(onReady);
  const onFallbackRef = useRef(onFallback);
  const onRegisterShadersRef = useRef(onRegisterShaders);
  onReadyRef.current = onReady;
  onFallbackRef.current = onFallback;
  onRegisterShadersRef.current = onRegisterShaders;

  /**
   * Initialize WebGPU context and shaders (uses module-level singleton)
   */
  const initialize = useCallback(async (): Promise<boolean> => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    if (initializingRef.current) return false;

    const initId = ++initIdRef.current;
    initializingRef.current = true;

    // Ensure the engine is aware of the canvas element
    engine.setCanvas(canvas);

    // Reset progress at start
    setProgress({ percent: 0, message: 'Initializing', isLoading: true });

    const isCurrent = (): boolean => initId === initIdRef.current;

    const scheduleGlobalDestroy = (): void => {
      if (globalState.destroyTimeout) {
        clearTimeout(globalState.destroyTimeout);
      }
      globalState.destroyTimeout = setTimeout(() => {
        if (globalState.refCount > 0) return;
        globalState.context?.destroy();
        globalState.context = null;
        globalState.shaderLibrary = null;
        globalState.initPromise = null;
        globalState.refCount = 0;
        globalState.destroyTimeout = null;
      }, 250);
    };

    // Helper to apply result to this component's state
    const applyResult = (result: { context: WebGPUContext; shaderLibrary: ShaderLibrary }): void => {
      if (!isCurrent()) {
        initializingRef.current = false;
        return;
      }
      globalState.refCount++;
      contextRef.current = result.context;
      shaderLibraryRef.current = result.shaderLibrary;
      
      result.context.reconfigure(canvas);
      
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);

      setBrowserInfo({
        isIOSSafari: result.context.browserInfo.isIOSSafari,
        iosVersion: result.context.browserInfo.iosVersion,
      });
      setGpuContext(result.context);
      setShaderLib(result.shaderLibrary);
      setIsReady(true);
      setIsFallback(false);
      setFallbackReason(null);
      setProgress({ percent: 100, message: 'Ready', isLoading: false });
      
      onReadyRef.current?.(result.context, result.shaderLibrary);
      initializingRef.current = false;
    };

    // Helper to handle failure
    const handleFailure = (reason: string): void => {
      if (!isCurrent()) {
        initializingRef.current = false;
        return;
      }
      setGpuContext(null);
      setShaderLib(null);
      setFallbackReason(reason);
      setIsFallback(true);
      setIsReady(false);
      setProgress({ percent: 100, message: reason, isLoading: false });
      engine.mode = InteractionMode.DOM_INTERACTIVE;
      onFallbackRef.current?.(reason);
      initializingRef.current = false;
    };

    // Force fallback mode for testing
    if (forceFallback) {
      handleFailure('Forced fallback mode (testing)');
      return false;
    }

    try {
      // Check if we already have a global context we can reuse
      if (globalState.context?.isAvailable && globalState.context.device && globalState.shaderLibrary) {
        if (globalState.destroyTimeout) {
          clearTimeout(globalState.destroyTimeout);
          globalState.destroyTimeout = null;
        }
        applyResult({ context: globalState.context, shaderLibrary: globalState.shaderLibrary });
        return true;
      }

      // Check if someone else is already initializing - wait for them
      if (globalState.initPromise) {
        const result = await globalState.initPromise;
        if (initId !== initIdRef.current) {
          initializingRef.current = false;
          return false;
        }
        
        if (result) {
          if (globalState.destroyTimeout) {
            clearTimeout(globalState.destroyTimeout);
            globalState.destroyTimeout = null;
          }
          applyResult(result);
          return true;
        }
        // Previous init failed, we'll retry below
        globalState.initPromise = null;
      }

      // Create promise SYNCHRONOUSLY to claim the lock before any await
      // This prevents race conditions where two components both start initializing
      let resolveInit!: (result: { context: WebGPUContext; shaderLibrary: ShaderLibrary } | null) => void;
      globalState.initPromise = new Promise((resolve) => {
        resolveInit = resolve;
      });

      // Now do the actual async initialization
      const context = new WebGPUContext();

      const initialized = await context.initialize({
        canvas,
        powerPreference,
        alphaMode,
        onProgress: (p: { percent: number; message: string; step: string }) => {
          setProgress({
            percent: p.percent,
            message: p.message,
            isLoading: p.step !== 'ready' && p.step !== 'failed',
          });
        },
      });

      // Bail out if component unmounted or was replaced
      if (!initialized || !context.device) {
        context.destroy();
        resolveInit(null);
        globalState.initPromise = null;
        handleFailure('WebGPU unavailable. Running in DOM-only mode.');
        return false;
      }

      const shaderLibrary = new ShaderLibrary();
      shaderLibrary.setDevice(context.device);
      shaderLibrary.registerDefaults();
      onRegisterShadersRef.current?.(shaderLibrary);

      globalState.context = context;
      globalState.shaderLibrary = shaderLibrary;
      if (globalState.destroyTimeout) {
        clearTimeout(globalState.destroyTimeout);
        globalState.destroyTimeout = null;
      }
      
      const result = { context, shaderLibrary };
      resolveInit(result);

      if (!isCurrent()) {
        initializingRef.current = false;
        if (globalState.refCount === 0) {
          scheduleGlobalDestroy();
        }
        return true;
      }

      applyResult(result);
      return true;
    } catch (error) {
      console.error('[useGPU] Initialization failed:', error);
      globalState.initPromise = null;
      handleFailure(error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }, [canvasRef, powerPreference, alphaMode, engine, forceFallback]);

  /**
   * Reinitialize GPU (useful after context loss)
   */
  const reinitialize = useCallback(async (): Promise<boolean> => {
    // Decrement ref count and potentially destroy global context
    if (contextRef.current === globalState.context) {
      globalState.refCount--;
      if (globalState.refCount <= 0) {
        if (globalState.destroyTimeout) {
          clearTimeout(globalState.destroyTimeout);
          globalState.destroyTimeout = null;
        }
        globalState.context?.destroy();
        globalState.context = null;
        globalState.shaderLibrary = null;
        globalState.initPromise = null;
        globalState.refCount = 0;
      }
    }
    
    contextRef.current = null;
    shaderLibraryRef.current = null;
    
    setGpuContext(null);
    setShaderLib(null);
    setIsReady(false);
    
    return initialize();
  }, [initialize]);

  // Initialize when canvas is available
  // Uses RAF polling to handle the case where canvas ref is set after initial render
  useEffect(() => {
    let cancelled = false;
    let rafId: number | null = null;
    
    const isCanvasReady = (): HTMLCanvasElement | null => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.isConnected) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      return canvas;
    };

    const attemptInit = (): void => {
      if (cancelled) return;

      const readyCanvas = isCanvasReady();
      if (readyCanvas) {
        initialize();
        return;
      }

      // Canvas not yet available/laid out, try again next frame
      rafId = requestAnimationFrame(attemptInit);
    };
    
    attemptInit();

    return () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      // Invalidate any in-flight initialization so stale results are ignored
      initIdRef.current += 1;
      initializingRef.current = false;
      
      // Decrement ref count - only destroy global context when no consumers remain
      if (contextRef.current === globalState.context) {
        globalState.refCount--;
        if (globalState.refCount <= 0) {
          if (globalState.destroyTimeout) {
            clearTimeout(globalState.destroyTimeout);
          }
          globalState.destroyTimeout = setTimeout(() => {
            if (globalState.refCount > 0) return;
            globalState.context?.destroy();
            globalState.context = null;
            globalState.shaderLibrary = null;
            globalState.initPromise = null;
            globalState.refCount = 0;
            globalState.destroyTimeout = null;
          }, 250);
        }
      }
      
      contextRef.current = null;
      shaderLibraryRef.current = null;
      // Reset state so consumers don't see a destroyed context
      setGpuContext(null);
      setShaderLib(null);
      setIsReady(false);
      setIsFallback(false);
      setFallbackReason(null);
    };
  }, [initialize]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context || !isReady) return;

    const handleResize = (): void => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || window.innerWidth;
      const height = rect.height || window.innerHeight;
      if (width === 0 || height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      
      context.resize(width, height, dpr);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [canvasRef, isReady]);

  return useMemo(
    () => ({
      context: gpuContext,
      shaderLibrary: shaderLib,
      device: gpuContext?.device ?? null,
      isReady,
      isFallback,
      fallbackReason,
      progress,
      browserInfo,
      reinitialize,
    }),
    [gpuContext, shaderLib, isReady, isFallback, fallbackReason, progress, browserInfo, reinitialize]
  );
}

/**
 * Simplified hook that just checks WebGPU availability
 * 
 * @returns Whether WebGPU is available in this browser
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const hasWebGPU = useWebGPUAvailable();
 *   
 *   if (!hasWebGPU) {
 *     return <FallbackUI />;
 *   }
 *   
 *   return <GPUScene />;
 * }
 * ```
 */
/** @returns Whether WebGPU is available */
export function useWebGPUAvailable(): boolean {
  const [available, setAvailable] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    return 'gpu' in navigator;
  });

  useEffect(() => {
    setAvailable('gpu' in navigator);
  }, []);

  return available;
}
