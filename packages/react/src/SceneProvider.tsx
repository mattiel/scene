/**
 * SceneProvider - React context for Scene engine
 * 
 * Provides the Scene engine, surface registry, and layout tracking
 * to all child components.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { Engine, InteractionMode, type EngineConfig } from '@scene/core';
import { SurfaceRegistry, LayoutTracker, type LayoutTrackerOptions } from '@scene/surfaces';

/**
 * Effect stack interface (for useScreenEffect)
 */
export interface EffectStackInterface {
  add: (config: { type: string; id?: string; enabled?: boolean; intensity?: number; params?: Record<string, number> }) => { id: string; type: string; enabled: boolean } | null;
  remove: (id: string) => boolean;
  enable: (id: string) => void;
  disable: (id: string) => void;
  setIntensity: (id: string, intensity: number) => void;
  setParams: (id: string, params: Record<string, number>) => void;
}

/**
 * Transition coordinator interface (for useTransition)
 */
export interface TransitionCoordinatorInterface {
  startExit?: (type: string, config?: Record<string, unknown>) => void;
  startEnter?: (type: string, config?: Record<string, unknown>) => void;
  setProgress?: (progress: number) => void;
  cancel?: () => void;
}

/**
 * Scene context value
 */
export interface SceneContextValue {
  /** The Scene engine instance */
  engine: Engine;
  /** The surface registry */
  registry: SurfaceRegistry;
  /** The layout tracker */
  layoutTracker: LayoutTracker;
  /** Whether the engine is ready (renderer initialized) */
  isReady: boolean;
  /** Whether WebGPU is available */
  isGPUEnabled: boolean;
  /** Current interaction mode */
  mode: InteractionMode;
  /** Set the interaction mode */
  setMode: (mode: InteractionMode) => void;
  /** Set the canvas element */
  setCanvas: (canvas: HTMLCanvasElement | null) => void;
  /** Screen effect stack (optional - set by user) */
  effectStack?: EffectStackInterface;
  /** Transition coordinator (optional - set by user) */
  transitionCoordinator?: TransitionCoordinatorInterface;
  /** Set the effect stack */
  setEffectStack: (stack: EffectStackInterface | undefined) => void;
  /** Set the transition coordinator */
  setTransitionCoordinator: (coordinator: TransitionCoordinatorInterface | undefined) => void;
}

const SceneContext = createContext<SceneContextValue | null>(null);

/**
 * Props for SceneProvider
 */
export interface SceneProviderProps {
  children: ReactNode;
  /** Initial interaction mode */
  mode?: InteractionMode | 'dom-interactive' | 'canvas-interactive';
  /** Enable FPS tracking */
  trackFPS?: boolean;
  /** Auto-start render loop (default: true) */
  autoStart?: boolean;
  /** Layout tracker options */
  layoutOptions?: LayoutTrackerOptions;
  /** Called when engine is ready */
  onReady?: () => void;
  /** Called when mode changes */
  onModeChange?: (mode: InteractionMode) => void;
}

/**
 * Normalize mode string to InteractionMode enum
 */
function normalizeMode(mode: InteractionMode | 'dom-interactive' | 'canvas-interactive'): InteractionMode {
  if (mode === 'dom-interactive') return InteractionMode.DOM_INTERACTIVE;
  if (mode === 'canvas-interactive') return InteractionMode.CANVAS_INTERACTIVE;
  return mode;
}

/**
 * SceneProvider - Provides Scene context to child components
 * 
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <SceneProvider mode="canvas-interactive">
 *       <Canvas />
 *       <MyComponents />
 *     </SceneProvider>
 *   );
 * }
 * ```
 */
export function SceneProvider({
  children,
  mode = InteractionMode.DOM_INTERACTIVE,
  trackFPS = false,
  autoStart = true,
  layoutOptions,
  onReady,
  onModeChange,
}: SceneProviderProps): React.ReactElement {
  // Refs for stable instances
  const engineRef = useRef<Engine | null>(null);
  const registryRef = useRef<SurfaceRegistry | null>(null);
  const layoutTrackerRef = useRef<LayoutTracker | null>(null);
  
  // State
  const [isReady, setIsReady] = useState(false);
  const [isGPUEnabled, setIsGPUEnabled] = useState(false);
  const [currentMode, setCurrentMode] = useState<InteractionMode>(normalizeMode(mode));
  const [effectStack, setEffectStackState] = useState<EffectStackInterface | undefined>();
  const [transitionCoordinator, setTransitionCoordinatorState] = useState<TransitionCoordinatorInterface | undefined>();

  const shouldAutoStart = autoStart && typeof requestAnimationFrame === 'function';
  
  // Initialize engine and related systems
  if (!engineRef.current) {
    const config: EngineConfig = {
      mode: normalizeMode(mode),
      trackFPS,
      autoStart: shouldAutoStart,
    };
    
    engineRef.current = new Engine(config);
    registryRef.current = new SurfaceRegistry();
    layoutTrackerRef.current = new LayoutTracker(
      registryRef.current,
      layoutOptions
    );
  }

  const engine = engineRef.current;
  const registry = registryRef.current!;
  const layoutTracker = layoutTrackerRef.current!;

  // Handle mode changes
  const handleSetMode = useCallback((newMode: InteractionMode) => {
    if (engine) {
      engine.mode = newMode;
      setCurrentMode(newMode);
      onModeChange?.(newMode);
    }
  }, [engine, onModeChange]);

  // Handle canvas setting
  const setCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (engine && canvas) {
      engine.setCanvas(canvas);
    }
  }, [engine]);

  // Handle effect stack setting
  const setEffectStack = useCallback((stack: EffectStackInterface | undefined) => {
    setEffectStackState(stack);
  }, []);

  // Handle transition coordinator setting
  const setTransitionCoordinator = useCallback((coordinator: TransitionCoordinatorInterface | undefined) => {
    setTransitionCoordinatorState(coordinator);
  }, []);

  // Set up event listeners
  useEffect(() => {
    if (!engine) return;

    // Listen for ready event
    const unsubReady = engine.on('ready', () => {
      setIsReady(true);
      setIsGPUEnabled(true);
      onReady?.();
    });

    // Listen for mode changes
    const unsubMode = engine.on('mode:changed', ({ to }) => {
      setCurrentMode(to as InteractionMode);
      onModeChange?.(to as InteractionMode);
    });

    return () => {
      unsubReady();
      unsubMode();
    };
  }, [engine, onReady, onModeChange]);
  
  // Start layout tracking after mount (avoids SSR side effects)
  useEffect(() => {
    const tracker = layoutTrackerRef.current;
    if (!tracker) return;
    
    tracker.start();
    
    return () => {
      tracker.stop();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      layoutTrackerRef.current?.stop();
      registryRef.current?.clear();
      engineRef.current?.destroy();
    };
  }, []);

  // Sync mode prop changes
  useEffect(() => {
    const normalized = normalizeMode(mode);
    if (engine && engine.mode !== normalized) {
      engine.mode = normalized;
      setCurrentMode(normalized);
    }
  }, [mode, engine]);

  const contextValue: SceneContextValue = {
    engine,
    registry,
    layoutTracker,
    isReady,
    isGPUEnabled,
    mode: currentMode,
    setMode: handleSetMode,
    setCanvas,
    effectStack,
    transitionCoordinator,
    setEffectStack,
    setTransitionCoordinator,
  };

  return (
    <SceneContext.Provider value={contextValue}>
      {children}
    </SceneContext.Provider>
  );
}

/**
 * Hook to access the Scene context
 * 
 * @throws Error if used outside of SceneProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { engine, registry, isReady } = useSceneContext();
 *   // ...
 * }
 * ```
 */
export function useSceneContext(): SceneContextValue {
  const context = useContext(SceneContext);
  if (!context) {
    throw new Error('useSceneContext must be used within a SceneProvider');
  }
  return context;
}

/**
 * Hook to check if inside a SceneProvider (doesn't throw)
 */
export function useSceneContextOptional(): SceneContextValue | null {
  return useContext(SceneContext);
}
