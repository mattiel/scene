/**
 * useTransition - Hook for navigation transition control
 * 
 * Provides React-friendly access to Scene's transition system,
 * enabling cinematic page transitions with GPU effects.
 */

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useSceneContext } from './SceneProvider';

/**
 * Transition type identifier
 */
export type TransitionType = 
  | 'dissolve'
  | 'fade'
  | 'fade_to_black'
  | 'wipe'
  | 'slide'
  | 'zoom'
  | 'flip'
  | 'cube'
  | 'morph'
  | string; // Allow custom types

/**
 * Configuration for a transition
 */
export interface TransitionConfig {
  /** Duration in milliseconds */
  duration?: number;
  /** Easing function name or custom function */
  easing?: string | ((t: number) => number);
  /** Direction for directional transitions */
  direction?: 'left' | 'right' | 'up' | 'down';
  /** Additional parameters */
  [key: string]: unknown;
}

/**
 * Transition state
 */
export type TransitionState = 'idle' | 'exiting' | 'entering' | 'complete';

/**
 * Options for useTransition hook
 */
export interface UseTransitionOptions {
  /** Transition type (dissolve, slide, zoom, fade_to_black, etc.) */
  type?: TransitionType;
  /** Transition duration in milliseconds */
  duration?: number;
  /** Additional transition configuration */
  config?: Partial<TransitionConfig>;
  /** Callback when exit transition starts */
  onExitStart?: () => void;
  /** Callback when exit transition completes */
  onExitComplete?: () => void;
  /** Callback when enter transition starts */
  onEnterStart?: () => void;
  /** Callback when enter transition completes */
  onEnterComplete?: () => void;
}

/**
 * Return type for useTransition hook
 */
export interface UseTransitionReturn {
  /** Current transition state */
  state: TransitionState;
  /** Current transition progress (0-1) */
  progress: number;
  /** Whether a transition is active */
  isTransitioning: boolean;
  /** Start exit transition (call before navigation) */
  startExit: () => Promise<void>;
  /** Start enter transition (call after navigation) */
  startEnter: () => Promise<void>;
  /** Skip/cancel current transition */
  skip: () => void;
  /** Set transition type */
  setType: (type: TransitionType) => void;
  /** Set transition duration */
  setDuration: (duration: number) => void;
}

/**
 * Hook for managing page transitions
 * 
 * @param options - Transition options
 * 
 * @example
 * ```tsx
 * function Page() {
 *   const { state, startExit, startEnter, progress } = useTransition({
 *     type: 'dissolve',
 *     duration: 500,
 *     onExitComplete: () => console.log('Exit done'),
 *   });
 *   
 *   const navigate = useNavigate();
 *   
 *   const handleNavigate = async (to: string) => {
 *     await startExit();
 *     navigate(to);
 *     startEnter();
 *   };
 *   
 *   return (
 *     <div style={{ opacity: state === 'exiting' ? 1 - progress : 1 }}>
 *       <button onClick={() => handleNavigate('/other')}>
 *         Navigate
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTransition(
  options: UseTransitionOptions = {}
): UseTransitionReturn {
  const { transitionCoordinator } = useSceneContext();
  const [state, setState] = useState<TransitionState>('idle');
  const [progress, setProgress] = useState(0);
  
  const typeRef = useRef<TransitionType>(options.type ?? 'dissolve');
  const durationRef = useRef(options.duration ?? 500);
  const configRef = useRef(options.config);
  
  const exitResolveRef = useRef<(() => void) | null>(null);
  const enterResolveRef = useRef<(() => void) | null>(null);
  const animationRef = useRef<number | null>(null);

  // Store callbacks
  const callbacksRef = useRef(options);
  useEffect(() => {
    callbacksRef.current = options;
  }, [options]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const animateProgress = useCallback((
    from: number,
    to: number,
    duration: number,
    onUpdate: (progress: number) => void,
    onComplete: () => void
  ) => {
    const startTime = performance.now();
    
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      
      // EaseInOut curve
      const eased = t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
      
      const currentProgress = from + (to - from) * eased;
      onUpdate(currentProgress);
      
      if (t < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
        onComplete();
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  }, []);

  const startExit = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      setState('exiting');
      setProgress(0);
      exitResolveRef.current = resolve;
      
      callbacksRef.current.onExitStart?.();
      
      // Notify coordinator if available
      if (transitionCoordinator) {
        transitionCoordinator.startExit?.(typeRef.current, configRef.current);
      }
      
      animateProgress(
        0,
        1,
        durationRef.current,
        (p) => {
          setProgress(p);
          if (transitionCoordinator) {
            transitionCoordinator.setProgress?.(p);
          }
        },
        () => {
          callbacksRef.current.onExitComplete?.();
          exitResolveRef.current?.();
          exitResolveRef.current = null;
        }
      );
    });
  }, [transitionCoordinator, animateProgress]);

  const startEnter = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      setState('entering');
      setProgress(1);
      enterResolveRef.current = resolve;
      
      callbacksRef.current.onEnterStart?.();
      
      // Notify coordinator if available
      if (transitionCoordinator) {
        transitionCoordinator.startEnter?.(typeRef.current, configRef.current);
      }
      
      animateProgress(
        1,
        0,
        durationRef.current,
        (p) => {
          setProgress(p);
          if (transitionCoordinator) {
            transitionCoordinator.setProgress?.(p);
          }
        },
        () => {
          setState('complete');
          setProgress(0);
          callbacksRef.current.onEnterComplete?.();
          enterResolveRef.current?.();
          enterResolveRef.current = null;
          
          // Reset to idle after a frame
          requestAnimationFrame(() => setState('idle'));
        }
      );
    });
  }, [transitionCoordinator, animateProgress]);

  const skip = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    setState('idle');
    setProgress(0);
    
    // Resolve any pending promises
    exitResolveRef.current?.();
    enterResolveRef.current?.();
    exitResolveRef.current = null;
    enterResolveRef.current = null;
    
    if (transitionCoordinator) {
      transitionCoordinator.cancel?.();
    }
  }, [transitionCoordinator]);

  const setType = useCallback((type: TransitionType) => {
    typeRef.current = type;
  }, []);

  const setDuration = useCallback((duration: number) => {
    durationRef.current = duration;
  }, []);

  const isTransitioning = state === 'exiting' || state === 'entering';

  return useMemo(
    () => ({
      state,
      progress,
      isTransitioning,
      startExit,
      startEnter,
      skip,
      setType,
      setDuration,
    }),
    [state, progress, isTransitioning, startExit, startEnter, skip, setType, setDuration]
  );
}

/**
 * Hook to get transition-aware styles
 * 
 * @param transition - UseTransitionReturn from useTransition
 * @param options - Style options
 * 
 * @example
 * ```tsx
 * function Page() {
 *   const transition = useTransition({ type: 'slide' });
 *   const style = useTransitionStyle(transition, {
 *     property: 'transform',
 *     exitValue: 'translateX(-100%)',
 *     enterValue: 'translateX(100%)',
 *     idleValue: 'translateX(0)',
 *   });
 *   
 *   return <div style={style}>Page content</div>;
 * }
 * ```
 */
export interface UseTransitionStyleOptions {
  /** CSS property to animate */
  property: string;
  /** Value when exiting (at progress=1) */
  exitValue: string;
  /** Value when entering (at progress=1) */
  enterValue: string;
  /** Value when idle */
  idleValue: string;
}

export function useTransitionStyle(
  transition: UseTransitionReturn,
  options: UseTransitionStyleOptions
): React.CSSProperties {
  const { state, progress } = transition;
  const { property, exitValue, enterValue, idleValue } = options;

  return useMemo(() => {
    if (state === 'idle' || state === 'complete') {
      return { [property]: idleValue };
    }

    if (state === 'exiting') {
      // Interpolate from idle to exit
      return {
        [property]: progress > 0.5 ? exitValue : idleValue,
        transition: 'none',
      };
    }

    if (state === 'entering') {
      // Interpolate from enter to idle
      return {
        [property]: progress > 0.5 ? enterValue : idleValue,
        transition: 'none',
      };
    }

    return { [property]: idleValue };
  }, [state, progress, property, exitValue, enterValue, idleValue]);
}

/**
 * Hook for coordinated multi-element transitions
 * 
 * @param transition - UseTransitionReturn from useTransition
 * @param elementIndex - Index of this element (for staggering)
 * @param totalElements - Total number of elements
 * 
 * @example
 * ```tsx
 * function ListItem({ index, total }: Props) {
 *   const transition = useTransition();
 *   const { progress, isActive } = useStaggeredTransition(transition, index, total);
 *   
 *   return (
 *     <div style={{ 
 *       opacity: isActive ? 1 - progress : 1,
 *       transform: isActive ? `translateY(${progress * 20}px)` : 'none',
 *     }}>
 *       Item {index}
 *     </div>
 *   );
 * }
 * ```
 */
export interface UseStaggeredTransitionReturn {
  /** Progress for this specific element (0-1) */
  progress: number;
  /** Whether this element's transition is currently active */
  isActive: boolean;
  /** Delay before this element starts (in ms equivalent) */
  delay: number;
}

export function useStaggeredTransition(
  transition: UseTransitionReturn,
  elementIndex: number,
  totalElements: number,
  staggerAmount = 0.1
): UseStaggeredTransitionReturn {
  const { progress: globalProgress, isTransitioning, state } = transition;

  return useMemo(() => {
    if (!isTransitioning) {
      return { progress: 0, isActive: false, delay: 0 };
    }

    // Calculate stagger offset
    const maxStagger = staggerAmount * (totalElements - 1);
    const elementOffset = staggerAmount * elementIndex;
    
    // For exit: later elements exit first
    // For enter: earlier elements enter first
    const adjustedOffset = state === 'exiting'
      ? maxStagger - elementOffset
      : elementOffset;
    
    // Scale global progress to this element's window
    const windowStart = adjustedOffset / (1 + maxStagger);
    const windowEnd = (1 + adjustedOffset) / (1 + maxStagger);
    
    const localProgress = Math.max(0, Math.min(1,
      (globalProgress - windowStart) / (windowEnd - windowStart)
    ));
    
    const isActive = globalProgress >= windowStart && globalProgress <= windowEnd;
    
    return {
      progress: localProgress,
      isActive,
      delay: adjustedOffset * 100, // Approximate ms
    };
  }, [globalProgress, isTransitioning, state, elementIndex, totalElements, staggerAmount]);
}
