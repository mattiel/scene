/**
 * useScreenEffect - Hook for managing screen-level post-processing effects
 * 
 * Provides React lifecycle management for effects like blur, vignette,
 * color grading, depth of field, etc.
 */

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useSceneContext } from './SceneProvider';

/**
 * Effect instance returned from the stack
 */
export interface Effect {
  id: string;
  type: string;
  enabled: boolean;
}

/**
 * Configuration for creating an effect
 */
export interface EffectConfig {
  type: string;
  id?: string;
  enabled?: boolean;
  intensity?: number;
  params?: Record<string, number>;
}

/**
 * Options for useScreenEffect hook
 */
export interface UseScreenEffectOptions extends Omit<EffectConfig, 'type'> {
  /** Whether the effect is enabled (default: true) */
  enabled?: boolean;
  /** Effect intensity (0-1, default: 1) */
  intensity?: number;
}

/**
 * Return type for useScreenEffect hook
 */
export interface UseScreenEffectReturn {
  /** The effect instance (null if not yet created) */
  effect: Effect | null;
  /** Whether the effect is enabled */
  isEnabled: boolean;
  /** Enable the effect */
  enable: () => void;
  /** Disable the effect */
  disable: () => void;
  /** Toggle the effect */
  toggle: () => void;
  /** Set effect intensity */
  setIntensity: (intensity: number) => void;
  /** Update effect parameters */
  update: (params: Record<string, number>) => void;
}

/**
 * Hook to add a screen effect with React lifecycle management
 * 
 * @param type - Effect type (blur, vignette, chromatic_aberration, etc.)
 * @param options - Effect options
 * 
 * @example
 * ```tsx
 * function CinematicScene() {
 *   const { effect, setIntensity, toggle, isEnabled } = useScreenEffect('vignette', {
 *     intensity: 0.5,
 *     params: { darkness: 0.8, offset: 0.5 },
 *   });
 *   
 *   return (
 *     <div>
 *       <button onClick={toggle}>
 *         Vignette: {isEnabled ? 'ON' : 'OFF'}
 *       </button>
 *       <input
 *         type="range"
 *         min="0"
 *         max="1"
 *         step="0.1"
 *         onChange={(e) => setIntensity(parseFloat(e.target.value))}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function useScreenEffect(
  type: string,
  options: UseScreenEffectOptions = {}
): UseScreenEffectReturn {
  const { effectStack } = useSceneContext();
  const effectRef = useRef<Effect | null>(null);
  const idRef = useRef<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(options.enabled ?? true);

  const { enabled = true, intensity = 1, params, ...restOptions } = options;

  // Create effect on mount
  useEffect(() => {
    if (!effectStack) {
      console.warn('useScreenEffect: No effect stack available in context');
      return;
    }

    // Generate unique ID
    const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    idRef.current = id;

    // Add effect to stack
    const effect = effectStack.add({
      type,
      id,
      enabled,
      intensity,
      params,
      ...restOptions,
    });

    effectRef.current = effect;
    setIsEnabled(effect?.enabled ?? false);

    return () => {
      // Remove effect on unmount
      if (idRef.current) {
        effectStack.remove(idRef.current);
      }
      effectRef.current = null;
      idRef.current = null;
    };
  }, [effectStack, type]); // Only recreate if stack or type changes

  // Update enabled state when options change
  useEffect(() => {
    if (effectRef.current && effectStack) {
      if (enabled) {
        effectStack.enable(effectRef.current.id);
      } else {
        effectStack.disable(effectRef.current.id);
      }
      setIsEnabled(enabled);
    }
  }, [enabled, effectStack]);

  // Update intensity when it changes
  useEffect(() => {
    if (effectRef.current && effectStack) {
      effectStack.setIntensity(effectRef.current.id, intensity);
    }
  }, [intensity, effectStack]);

  // Update params when they change
  useEffect(() => {
    if (effectRef.current && params && effectStack) {
      effectStack.setParams(effectRef.current.id, params);
    }
  }, [params, effectStack]);

  const enable = useCallback(() => {
    if (effectRef.current && effectStack) {
      effectStack.enable(effectRef.current.id);
      setIsEnabled(true);
    }
  }, [effectStack]);

  const disable = useCallback(() => {
    if (effectRef.current && effectStack) {
      effectStack.disable(effectRef.current.id);
      setIsEnabled(false);
    }
  }, [effectStack]);

  const toggle = useCallback(() => {
    if (isEnabled) {
      disable();
    } else {
      enable();
    }
  }, [isEnabled, enable, disable]);

  const setIntensity = useCallback((newIntensity: number) => {
    if (effectRef.current && effectStack) {
      effectStack.setIntensity(effectRef.current.id, newIntensity);
    }
  }, [effectStack]);

  const update = useCallback((newParams: Record<string, number>) => {
    if (effectRef.current && effectStack) {
      effectStack.setParams(effectRef.current.id, newParams);
    }
  }, [effectStack]);

  return useMemo(
    () => ({
      effect: effectRef.current,
      isEnabled,
      enable,
      disable,
      toggle,
      setIntensity,
      update,
    }),
    [effectRef.current, isEnabled, enable, disable, toggle, setIntensity, update]
  );
}

/**
 * Hook to manage multiple screen effects as a group
 * 
 * @param effects - Array of effect configurations
 * 
 * @example
 * ```tsx
 * function CinematicMode() {
 *   const { enableAll, disableAll, isAllEnabled } = useScreenEffects([
 *     { type: 'vignette', intensity: 0.6 },
 *     { type: 'film_grain', intensity: 0.1 },
 *     { type: 'color_grading', params: { saturation: 1.2 } },
 *   ]);
 *   
 *   return (
 *     <button onClick={isAllEnabled ? disableAll : enableAll}>
 *       Cinematic Mode: {isAllEnabled ? 'ON' : 'OFF'}
 *     </button>
 *   );
 * }
 * ```
 */
export interface UseScreenEffectsOptions {
  type: string;
  id?: string;
  enabled?: boolean;
  intensity?: number;
  params?: Record<string, number>;
}

export interface UseScreenEffectsReturn {
  /** All effect instances */
  effects: Effect[];
  /** Enable all effects */
  enableAll: () => void;
  /** Disable all effects */
  disableAll: () => void;
  /** Whether all effects are enabled */
  isAllEnabled: boolean;
  /** Get a specific effect by type */
  getByType: (type: string) => Effect | undefined;
}

export function useScreenEffects(
  effectConfigs: UseScreenEffectsOptions[]
): UseScreenEffectsReturn {
  const { effectStack } = useSceneContext();
  const effectsRef = useRef<Effect[]>([]);
  const [isAllEnabled, setIsAllEnabled] = useState(true);

  useEffect(() => {
    if (!effectStack) return;

    const effects: Effect[] = [];

    for (const config of effectConfigs) {
      const id = config.id ?? `${config.type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      
      const effect = effectStack.add({
        ...config,
        id,
        enabled: config.enabled ?? true,
        intensity: config.intensity ?? 1,
      });

      if (effect) {
        effects.push(effect);
      }
    }

    effectsRef.current = effects;

    return () => {
      for (const effect of effects) {
        effectStack.remove(effect.id);
      }
      effectsRef.current = [];
    };
  }, [effectStack, effectConfigs]);

  const enableAll = useCallback(() => {
    if (!effectStack) return;
    for (const effect of effectsRef.current) {
      effectStack.enable(effect.id);
    }
    setIsAllEnabled(true);
  }, [effectStack]);

  const disableAll = useCallback(() => {
    if (!effectStack) return;
    for (const effect of effectsRef.current) {
      effectStack.disable(effect.id);
    }
    setIsAllEnabled(false);
  }, [effectStack]);

  const getByType = useCallback((type: string) => {
    return effectsRef.current.find(e => e.type === type);
  }, []);

  return useMemo(
    () => ({
      effects: effectsRef.current,
      enableAll,
      disableAll,
      isAllEnabled,
      getByType,
    }),
    [effectsRef.current, enableAll, disableAll, isAllEnabled, getByType]
  );
}
