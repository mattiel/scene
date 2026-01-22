/**
 * useSurfaceEffect - Hook for per-surface visual effects
 * 
 * Manages effects applied to individual surfaces, handling lifecycle
 * and cleanup automatically.
 */

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import type { Surface } from '@scene/surfaces';
import type { SurfaceEffect, EffectUniform } from '@scene/surfaces';

/**
 * Built-in surface effect types
 */
export type SurfaceEffectType = 
  | 'blur'
  | 'glow'
  | 'distort'
  | 'refract'
  | 'ripple'
  | 'pixelate'
  | 'custom';

/**
 * Options for useSurfaceEffect hook
 */
export interface UseSurfaceEffectOptions {
  /** Effect type */
  type: SurfaceEffectType;
  /** Whether the effect is enabled (default: true) */
  enabled?: boolean;
  /** Effect intensity (0-1, default: 1) */
  intensity?: number;
  /** Custom effect implementation (required for 'custom' type) */
  customEffect?: SurfaceEffect;
  /** Effect-specific parameters */
  params?: Record<string, number | [number, number] | [number, number, number] | [number, number, number, number]>;
}

/**
 * Return type for useSurfaceEffect hook
 */
export interface UseSurfaceEffectReturn {
  /** The effect instance (null if not created) */
  effect: SurfaceEffect | null;
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
  /** Update effect parameter */
  setParam: (name: string, value: number | number[]) => void;
}

/**
 * Create a built-in surface effect
 */
function createBuiltinEffect(
  type: SurfaceEffectType,
  id: string,
  intensity: number,
  params?: Record<string, number | number[]>
): SurfaceEffect {
  const uniforms: EffectUniform[] = [
    { name: 'intensity', type: 'f32', value: intensity },
  ];

  // Add type-specific uniforms
  switch (type) {
    case 'blur':
      uniforms.push({ name: 'radius', type: 'f32', value: (params?.radius as number) ?? 10 });
      uniforms.push({ name: 'direction', type: 'vec2f', value: (params?.direction as [number, number]) ?? [1, 0] });
      break;
    case 'glow':
      uniforms.push({ name: 'radius', type: 'f32', value: (params?.radius as number) ?? 20 });
      uniforms.push({ name: 'color', type: 'vec3f', value: (params?.color as [number, number, number]) ?? [1, 1, 1] });
      uniforms.push({ name: 'threshold', type: 'f32', value: (params?.threshold as number) ?? 0.5 });
      break;
    case 'distort':
      uniforms.push({ name: 'amount', type: 'f32', value: (params?.amount as number) ?? 0.1 });
      uniforms.push({ name: 'frequency', type: 'f32', value: (params?.frequency as number) ?? 10 });
      break;
    case 'refract':
      uniforms.push({ name: 'ior', type: 'f32', value: (params?.ior as number) ?? 1.5 });
      uniforms.push({ name: 'chromaticAberration', type: 'f32', value: (params?.chromaticAberration as number) ?? 0.02 });
      break;
    case 'ripple':
      uniforms.push({ name: 'amplitude', type: 'f32', value: (params?.amplitude as number) ?? 10 });
      uniforms.push({ name: 'frequency', type: 'f32', value: (params?.frequency as number) ?? 5 });
      uniforms.push({ name: 'speed', type: 'f32', value: (params?.speed as number) ?? 1 });
      uniforms.push({ name: 'center', type: 'vec2f', value: (params?.center as [number, number]) ?? [0.5, 0.5] });
      break;
    case 'pixelate':
      uniforms.push({ name: 'pixelSize', type: 'f32', value: (params?.pixelSize as number) ?? 8 });
      break;
  }

  return {
    id,
    name: `${type}_effect`,
    enabled: true,
    intensity,
    getUniforms: () => uniforms,
    apply: () => {
      // Base implementation - actual GPU rendering handled by SurfaceEffectStack
    },
  };
}

/**
 * Hook to add an effect to a specific surface
 * 
 * @param surface - The surface to apply the effect to
 * @param options - Effect options
 * 
 * @example
 * ```tsx
 * function Card({ surfaceId }: Props) {
 *   const { ref, surface } = useSurface<HTMLDivElement>(surfaceId);
 *   
 *   const { effect, setIntensity, toggle } = useSurfaceEffect(surface, {
 *     type: 'blur',
 *     intensity: 0.5,
 *     params: { radius: 20 },
 *   });
 *   
 *   return (
 *     <div ref={ref} onHover={() => toggle()}>
 *       Content with blur effect
 *     </div>
 *   );
 * }
 * ```
 */
export function useSurfaceEffect(
  surface: Surface | null,
  options: UseSurfaceEffectOptions
): UseSurfaceEffectReturn {
  const effectRef = useRef<SurfaceEffect | null>(null);
  const [isEnabled, setIsEnabled] = useState(options.enabled ?? true);

  const { type, enabled = true, intensity = 1, customEffect, params } = options;

  // Create and attach effect
  useEffect(() => {
    if (!surface) return;

    // Generate unique ID
    const id = `${type}_${surface.id}_${Date.now()}`;

    // Create effect
    const effect = type === 'custom' && customEffect
      ? customEffect
      : createBuiltinEffect(type, id, intensity, params);

    effect.enabled = enabled;
    effect.intensity = intensity;

    // Add effect to surface
    if (surface.addEffect) {
      surface.addEffect(effect);
    }

    effectRef.current = effect;
    setIsEnabled(enabled);

    return () => {
      if (surface.removeEffect && effectRef.current) {
        surface.removeEffect(effectRef.current.id);
      }
      effectRef.current = null;
    };
  }, [surface, type, customEffect]);

  // Update enabled state
  useEffect(() => {
    if (effectRef.current) {
      effectRef.current.enabled = enabled;
      setIsEnabled(enabled);
    }
  }, [enabled]);

  // Update intensity
  useEffect(() => {
    if (effectRef.current) {
      effectRef.current.intensity = intensity;
    }
  }, [intensity]);

  const enable = useCallback(() => {
    if (effectRef.current) {
      effectRef.current.enabled = true;
      setIsEnabled(true);
    }
  }, []);

  const disable = useCallback(() => {
    if (effectRef.current) {
      effectRef.current.enabled = false;
      setIsEnabled(false);
    }
  }, []);

  const toggle = useCallback(() => {
    if (effectRef.current) {
      effectRef.current.enabled = !effectRef.current.enabled;
      setIsEnabled(effectRef.current.enabled);
    }
  }, []);

  const setIntensity = useCallback((newIntensity: number) => {
    if (effectRef.current) {
      effectRef.current.intensity = newIntensity;
    }
  }, []);

  const setParam = useCallback((name: string, value: number | number[]) => {
    if (effectRef.current) {
      const uniforms = effectRef.current.getUniforms();
      const uniform = uniforms.find(u => u.name === name);
      if (uniform) {
        uniform.value = value as typeof uniform.value;
      }
    }
  }, []);

  return useMemo(
    () => ({
      effect: effectRef.current,
      isEnabled,
      enable,
      disable,
      toggle,
      setIntensity,
      setParam,
    }),
    [effectRef.current, isEnabled, enable, disable, toggle, setIntensity, setParam]
  );
}

/**
 * Hook to apply multiple effects to a surface
 * 
 * @param surface - The surface to apply effects to
 * @param effects - Array of effect configurations
 * 
 * @example
 * ```tsx
 * function GlassCard({ surface }: Props) {
 *   const { effects, enableAll, disableAll } = useSurfaceEffects(surface, [
 *     { type: 'blur', intensity: 0.3, params: { radius: 10 } },
 *     { type: 'refract', intensity: 0.5 },
 *   ]);
 *   
 *   return <div>Glass effect card</div>;
 * }
 * ```
 */
export interface UseSurfaceEffectsReturn {
  /** All effect instances */
  effects: SurfaceEffect[];
  /** Enable all effects */
  enableAll: () => void;
  /** Disable all effects */
  disableAll: () => void;
  /** Get effect by type */
  getByType: (type: SurfaceEffectType) => SurfaceEffect | undefined;
}

export function useSurfaceEffects(
  surface: Surface | null,
  effectConfigs: UseSurfaceEffectOptions[]
): UseSurfaceEffectsReturn {
  const effectsRef = useRef<SurfaceEffect[]>([]);

  useEffect(() => {
    if (!surface) return;

    const effects: SurfaceEffect[] = [];

    for (const config of effectConfigs) {
      const id = `${config.type}_${surface.id}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      
      const effect = config.type === 'custom' && config.customEffect
        ? config.customEffect
        : createBuiltinEffect(config.type, id, config.intensity ?? 1, config.params);

      effect.enabled = config.enabled ?? true;

      if (surface.addEffect) {
        surface.addEffect(effect);
      }

      effects.push(effect);
    }

    effectsRef.current = effects;

    return () => {
      for (const effect of effects) {
        if (surface.removeEffect) {
          surface.removeEffect(effect.id);
        }
      }
      effectsRef.current = [];
    };
  }, [surface, effectConfigs]);

  const enableAll = useCallback(() => {
    for (const effect of effectsRef.current) {
      effect.enabled = true;
    }
  }, []);

  const disableAll = useCallback(() => {
    for (const effect of effectsRef.current) {
      effect.enabled = false;
    }
  }, []);

  const getByType = useCallback((type: SurfaceEffectType) => {
    return effectsRef.current.find(e => e.name.startsWith(type));
  }, []);

  return useMemo(
    () => ({
      effects: effectsRef.current,
      enableAll,
      disableAll,
      getByType,
    }),
    [effectsRef.current, enableAll, disableAll, getByType]
  );
}
