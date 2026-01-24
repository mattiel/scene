/**
 * useSurface - Hook to register DOM elements as Scene surfaces
 * 
 * Automatically creates and manages a Surface for a DOM element,
 * handling registration/unregistration on mount/unmount.
 */

import { useEffect, useRef, useMemo } from 'react';
import { Surface, type SurfaceOptions, type SurfaceRect } from '@scene/surfaces';
import { useSceneContext } from './SceneProvider';

/**
 * Options for useSurface hook
 */
export interface UseSurfaceOptions extends SurfaceOptions {
  /** Accessibility label for the surface */
  label?: string;
  /** Whether the surface is enabled (default: true) */
  enabled?: boolean;
  /** Callback when layout changes */
  onLayoutChange?: (rect: SurfaceRect) => void;
  /** Callback when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
}

/**
 * Return type for useSurface hook
 */
export interface UseSurfaceReturn<T extends HTMLElement> {
  /** Ref to attach to the DOM element */
  ref: React.RefObject<T | null>;
  /** The Surface instance (null if not yet created) */
  surface: Surface | null;
  /** Current layout rect */
  rect: SurfaceRect | null;
  /** Whether the surface is visible */
  isVisible: boolean;
}

/**
 * Hook to register a DOM element as a Scene surface
 * 
 * @param id - Unique identifier for the surface
 * @param options - Surface options
 * 
 * @example
 * ```tsx
 * function Card({ id, title }: CardProps) {
 *   const { ref, surface, rect } = useSurface<HTMLDivElement>(id, {
 *     label: title,
 *     onLayoutChange: (rect) => console.log('Layout:', rect),
 *   });
 *   
 *   return (
 *     <div ref={ref} className="card">
 *       {title}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSurface<T extends HTMLElement = HTMLElement>(
  id: string,
  options: UseSurfaceOptions = {}
): UseSurfaceReturn<T> {
  const { registry } = useSceneContext();
  const ref = useRef<T | null>(null);
  const surfaceRef = useRef<Surface | null>(null);
  const rectRef = useRef<SurfaceRect | null>(null);
  const isVisibleRef = useRef(true);

  const {
    enabled = true,
    label,
    onLayoutChange,
    onVisibilityChange,
    ...surfaceOptions
  } = options;

  // Create and register surface
  useEffect(() => {
    if (!enabled || !ref.current) {
      return;
    }

    const element = ref.current;

    // Check if surface already exists
    if (registry.has(id)) {
      console.warn(`Surface with id "${id}" already exists, skipping registration`);
      surfaceRef.current = registry.get(id) ?? null;
      return;
    }

    // Create surface
    const surface = new Surface(id, element, surfaceOptions);
    
    // Set initial rect
    rectRef.current = surface.rect;
    isVisibleRef.current = surface.isVisible;

    // Subscribe to changes
    const unsubLayout = surface.onLayoutChange((rect: SurfaceRect) => {
      rectRef.current = rect;
      onLayoutChange?.(rect);
    });

    const unsubVisibility = surface.onVisibilityChange((visible: boolean) => {
      isVisibleRef.current = visible;
      onVisibilityChange?.(visible);
    });

    // Register with registry
    registry.add(surface);
    surfaceRef.current = surface;

    // Store label for accessibility
    if (label) {
      element.setAttribute('data-scene-label', label);
    }

    return () => {
      unsubLayout();
      unsubVisibility();
      
      // Unregister from registry
      registry.remove(id);
      surface.destroy();
      surfaceRef.current = null;
      
      if (label) {
        element.removeAttribute('data-scene-label');
      }
    };
  }, [id, enabled, registry, label, onLayoutChange, onVisibilityChange]);

  return useMemo(
    () => ({
      ref,
      surface: surfaceRef.current,
      rect: rectRef.current,
      isVisible: isVisibleRef.current,
    }),
    [surfaceRef.current, rectRef.current, isVisibleRef.current]
  );
}

/**
 * Hook to get an existing surface by ID
 * 
 * @param id - Surface ID to look up
 * 
 * @example
 * ```tsx
 * function SurfaceInspector({ surfaceId }: Props) {
 *   const surface = useSurfaceById(surfaceId);
 *   
 *   if (!surface) return <p>Surface not found</p>;
 *   
 *   return (
 *     <div>
 *       <p>Position: {surface.rect.x}, {surface.rect.y}</p>
 *       <p>Size: {surface.rect.width} x {surface.rect.height}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSurfaceById(id: string): Surface | null {
  const { registry } = useSceneContext();
  return useMemo(() => registry.get(id) ?? null, [registry, id]);
}

/**
 * Hook to get all surfaces
 * 
 * @example
 * ```tsx
 * function SurfaceList() {
 *   const surfaces = useSurfaces();
 *   
 *   return (
 *     <ul>
 *       {surfaces.map(s => (
 *         <li key={s.id}>{s.id}: {s.rect.width}x{s.rect.height}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useSurfaces(): Surface[] {
  const { registry } = useSceneContext();
  return useMemo(() => registry.all(), [registry]);
}

/**
 * Hook to listen for surface additions/removals
 * 
 * @param onAdd - Called when a surface is added
 * @param onRemove - Called when a surface is removed
 * 
 * @example
 * ```tsx
 * function SurfaceMonitor() {
 *   useSurfaceEvents(
 *     (surface) => console.log('Added:', surface.id),
 *     (surface) => console.log('Removed:', surface.id)
 *   );
 *   
 *   return null;
 * }
 * ```
 */
export function useSurfaceEvents(
  onAdd?: (surface: Surface) => void,
  onRemove?: (surface: Surface) => void
): void {
  const { registry } = useSceneContext();

  useEffect(() => {
    const unsubAdd = onAdd ? registry.onAdd(onAdd) : undefined;
    const unsubRemove = onRemove ? registry.onRemove(onRemove) : undefined;

    return () => {
      unsubAdd?.();
      unsubRemove?.();
    };
  }, [registry, onAdd, onRemove]);
}
