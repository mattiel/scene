/**
 * useMaterial - Hook for Scene materials
 * 
 * Provides React lifecycle management for materials,
 * handling creation, updates, and cleanup.
 */

/// <reference types="@webgpu/types" />

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  ShaderMaterial,
  type ShaderMaterialConfig,
  type UniformValue,
} from '@scene/renderer';

/**
 * Return type for useMaterial hook
 */
export interface UseMaterialReturn {
  /** The material instance (null if not yet created) */
  material: ShaderMaterial | null;
  /** Whether the material is initialized on GPU */
  isInitialized: boolean;
  /** Set a uniform value */
  setUniform: (name: string, value: UniformValue) => void;
  /** Get a uniform value */
  getUniform: (name: string) => number | Float32Array | null;
  /** Set a texture */
  setTexture: (name: string, texture: GPUTexture) => void;
}

/**
 * Hook to create and manage a ShaderMaterial
 * 
 * @param config - ShaderMaterial configuration
 * @param deps - Dependencies that should trigger material recreation
 * 
 * @example
 * ```tsx
 * function Card({ texture }: CardProps) {
 *   const { material, setUniform, isInitialized } = useMaterial({
 *     name: 'CardMaterial',
 *     vertexShader: VERTEX_SHADER,
 *     fragmentShader: FRAGMENT_SHADER,
 *     uniforms: {
 *       uOpacity: { type: 'f32', default: 1.0 },
 *       uBend: { type: 'f32', default: 0.0 },
 *     },
 *   });
 *   
 *   useEffect(() => {
 *     setUniform('uBend', bendAmount);
 *   }, [bendAmount, setUniform]);
 *   
 *   return (
 *     <div>
 *       {isInitialized ? 'Material ready' : 'Loading...'}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMaterial(
  config: ShaderMaterialConfig,
  deps: React.DependencyList = []
): UseMaterialReturn {
  const materialRef = useRef<ShaderMaterial | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Create material
  useEffect(() => {
    const material = new ShaderMaterial(config);
    materialRef.current = material;

    // Note: Material initialization requires a GPU device, which happens
    // when the material is first used by the renderer. We track this state
    // but can't initialize proactively without device access.

    return () => {
      material.destroy();
      materialRef.current = null;
      setIsInitialized(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Track initialization state
  useEffect(() => {
    const checkInitialized = () => {
      if (materialRef.current?.isInitialized && !isInitialized) {
        setIsInitialized(true);
      }
    };

    const intervalId = setInterval(checkInitialized, 100);
    return () => clearInterval(intervalId);
  }, [isInitialized]);

  const setUniform = useCallback((name: string, value: UniformValue) => {
    materialRef.current?.setUniform(name, value);
  }, []);

  const getUniform = useCallback((name: string) => {
    return materialRef.current?.getUniform(name) ?? null;
  }, []);

  const setTexture = useCallback((name: string, texture: GPUTexture) => {
    materialRef.current?.setTexture(name, texture);
  }, []);

  return useMemo(
    () => ({
      material: materialRef.current,
      isInitialized,
      setUniform,
      getUniform,
      setTexture,
    }),
    [materialRef.current, isInitialized, setUniform, getUniform, setTexture]
  );
}

/**
 * Hook to track and update a material uniform
 * 
 * @param material - The material to update
 * @param uniformName - Name of the uniform
 * @param value - Value to set
 * 
 * @example
 * ```tsx
 * function AnimatedCard({ material, opacity }: Props) {
 *   useMaterialUniform(material, 'uOpacity', opacity);
 *   // Uniform is automatically updated when opacity changes
 *   return <div>...</div>;
 * }
 * ```
 */
export function useMaterialUniform(
  material: ShaderMaterial | null,
  uniformName: string,
  value: UniformValue
): void {
  useEffect(() => {
    if (material) {
      material.setUniform(uniformName, value);
    }
  }, [material, uniformName, value]);
}

/**
 * Hook to batch multiple uniform updates
 * 
 * @param material - The material to update
 * @param uniforms - Object of uniform name -> value pairs
 * 
 * @example
 * ```tsx
 * function Card({ material, opacity, bend, scale }: Props) {
 *   useMaterialUniforms(material, {
 *     uOpacity: opacity,
 *     uBend: bend,
 *     uScale: scale,
 *   });
 *   return <div>...</div>;
 * }
 * ```
 */
export function useMaterialUniforms(
  material: ShaderMaterial | null,
  uniforms: Record<string, UniformValue>
): void {
  useEffect(() => {
    if (!material) return;
    
    for (const [name, value] of Object.entries(uniforms)) {
      material.setUniform(name, value);
    }
  }, [material, uniforms]);
}

/**
 * Hook for materials with deformations
 * 
 * Combines material management with deformation configuration.
 * 
 * @param config - Material configuration including deformations
 * 
 * @example
 * ```tsx
 * function BendingCard() {
 *   const { material, setDeformationUniform } = useDeformableMaterial({
 *     name: 'BendingCard',
 *     vertexShader: BEND_VERTEX,
 *     fragmentShader: CARD_FRAGMENT,
 *     uniforms: {
 *       uBendAmount: { type: 'f32', default: 0 },
 *       uBendOrigin: { type: 'vec2', default: [0.5, 0.5] },
 *     },
 *   });
 *   
 *   const handleDrag = (velocity: number) => {
 *     setDeformationUniform('uBendAmount', velocity * 0.01);
 *   };
 *   
 *   return <div onDrag={handleDrag}>...</div>;
 * }
 * ```
 */
export interface UseDeformableMaterialReturn extends UseMaterialReturn {
  /** Set a deformation-related uniform with spring animation */
  setDeformationUniform: (name: string, value: number, animated?: boolean) => void;
}

export function useDeformableMaterial(
  config: ShaderMaterialConfig
): UseDeformableMaterialReturn {
  const base = useMaterial(config);
  
  // Track target values for animated uniforms
  const targetValuesRef = useRef<Map<string, number>>(new Map());
  const currentValuesRef = useRef<Map<string, number>>(new Map());

  // Animation loop for smooth uniform updates
  useEffect(() => {
    let animationId: number;
    
    const animate = () => {
      const { material } = base;
      if (!material) {
        animationId = requestAnimationFrame(animate);
        return;
      }

      // Lerp each animated uniform toward its target
      for (const [name, target] of targetValuesRef.current) {
        const current = currentValuesRef.current.get(name) ?? 0;
        const newValue = current + (target - current) * 0.1;
        
        if (Math.abs(newValue - target) < 0.001) {
          currentValuesRef.current.set(name, target);
          material.setUniform(name, target);
        } else {
          currentValuesRef.current.set(name, newValue);
          material.setUniform(name, newValue);
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [base]);

  const setDeformationUniform = useCallback(
    (name: string, value: number, animated = true) => {
      if (animated) {
        targetValuesRef.current.set(name, value);
        if (!currentValuesRef.current.has(name)) {
          currentValuesRef.current.set(name, 0);
        }
      } else {
        targetValuesRef.current.set(name, value);
        currentValuesRef.current.set(name, value);
        base.material?.setUniform(name, value);
      }
    },
    [base.material]
  );

  return useMemo(
    () => ({
      ...base,
      setDeformationUniform,
    }),
    [base, setDeformationUniform]
  );
}
