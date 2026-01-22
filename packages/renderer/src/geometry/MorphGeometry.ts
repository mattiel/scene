/**
 * MorphGeometry - Geometry with morph target support
 * 
 * Enables smooth blending between different geometric states,
 * useful for shape animations, facial expressions, and UI transitions.
 */

import { Geometry, type BoundingBox } from './Geometry';

/** Morph target definition */
export interface MorphTarget {
  /** Name of the morph target */
  name: string;
  /** Position offsets (deltas from base geometry) */
  positions: Float32Array;
  /** Normal offsets (optional) */
  normals?: Float32Array;
}

/** MorphGeometry configuration */
export interface MorphGeometryConfig {
  /** Base geometry to morph */
  base: Geometry;
  /** Morph targets to add */
  targets?: MorphTarget[];
  /** Maximum number of active morph targets (for GPU buffer allocation) */
  maxActiveTargets?: number;
}

/**
 * MorphGeometry - Geometry with morph target blending
 * 
 * Morph targets define position (and optionally normal) deltas
 * that are blended with the base geometry based on weights.
 * 
 * @example
 * ```typescript
 * // Create base geometry
 * const base = new PlaneGeometry({ width: 100, height: 100, widthSegments: 10, heightSegments: 10 });
 * 
 * // Create morph geometry
 * const morph = new MorphGeometry({ base });
 * 
 * // Add morph targets
 * const bulgeTarget = createBulgeTarget(base);
 * morph.addTarget('bulge', bulgeTarget);
 * 
 * // Animate by setting weights
 * morph.setWeight('bulge', 0.5); // 50% bulge
 * morph.apply(); // Update vertex positions
 * ```
 */
export class MorphGeometry extends Geometry {
  /** Base (rest) positions */
  private basePositions: Float32Array;
  /** Base (rest) normals */
  private baseNormals: Float32Array | null = null;
  /** Morph targets by name */
  private targets: Map<string, MorphTarget> = new Map();
  /** Current morph weights by target name */
  private weights: Map<string, number> = new Map();
  /** Working buffer for morphed positions */
  private morphedPositions: Float32Array;
  /** Working buffer for morphed normals */
  private morphedNormals: Float32Array | null = null;
  /** Maximum active targets for GPU optimization */
  readonly maxActiveTargets: number;

  constructor(config: MorphGeometryConfig) {
    super();

    const { base, targets = [], maxActiveTargets = 8 } = config;
    this.maxActiveTargets = maxActiveTargets;

    // Copy base geometry attributes
    for (const [name, attr] of base.attributes) {
      this.setAttribute(name, attr.clone());
    }
    if (base.index) {
      this.setIndex(base.index.clone());
    }

    // Store base positions
    const posAttr = this.getAttribute('position');
    if (!posAttr) {
      throw new Error('MorphGeometry requires position attribute');
    }
    this.basePositions = new Float32Array(posAttr.array);
    this.morphedPositions = new Float32Array(posAttr.array);

    // Store base normals if present
    const normalAttr = this.getAttribute('normal');
    if (normalAttr) {
      this.baseNormals = new Float32Array(normalAttr.array);
      this.morphedNormals = new Float32Array(normalAttr.array);
    }

    // Add initial targets
    for (const target of targets) {
      this.addTarget(target.name, target);
    }

    this.computeBoundingBox();
  }

  /**
   * Add a morph target
   * 
   * @param name - Target name
   * @param target - Target data (positions are deltas from base)
   */
  addTarget(name: string, target: Omit<MorphTarget, 'name'>): this {
    if (target.positions.length !== this.basePositions.length) {
      throw new Error(`Target '${name}' position count doesn't match base geometry`);
    }

    this.targets.set(name, {
      name,
      positions: target.positions,
      normals: target.normals,
    });
    this.weights.set(name, 0);

    return this;
  }

  /**
   * Remove a morph target
   */
  removeTarget(name: string): boolean {
    this.weights.delete(name);
    return this.targets.delete(name);
  }

  /**
   * Set weight for a morph target
   * 
   * @param name - Target name
   * @param weight - Blend weight (0 = base, 1 = fully morphed)
   */
  setWeight(name: string, weight: number): this {
    if (!this.targets.has(name)) {
      console.warn(`Morph target '${name}' not found`);
      return this;
    }
    this.weights.set(name, weight);
    return this;
  }

  /**
   * Get weight for a morph target
   */
  getWeight(name: string): number {
    return this.weights.get(name) ?? 0;
  }

  /**
   * Set multiple weights at once
   */
  setWeights(weights: Record<string, number>): this {
    for (const [name, weight] of Object.entries(weights)) {
      this.setWeight(name, weight);
    }
    return this;
  }

  /**
   * Get all current weights
   */
  getWeights(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [name, weight] of this.weights) {
      result[name] = weight;
    }
    return result;
  }

  /**
   * Get available target names
   */
  getTargetNames(): string[] {
    return Array.from(this.targets.keys());
  }

  /**
   * Apply morph weights to update vertex positions
   * 
   * Call this after changing weights to update the geometry.
   * The GPU buffer will be re-uploaded on the next render.
   */
  apply(): this {
    // Reset to base positions
    this.morphedPositions.set(this.basePositions);
    if (this.morphedNormals && this.baseNormals) {
      this.morphedNormals.set(this.baseNormals);
    }

    // Apply weighted morph targets
    for (const [name, target] of this.targets) {
      const weight = this.weights.get(name) ?? 0;
      if (weight === 0) continue;

      // Add weighted position deltas
      for (let i = 0; i < this.morphedPositions.length; i++) {
        this.morphedPositions[i] += target.positions[i] * weight;
      }

      // Add weighted normal deltas
      if (this.morphedNormals && target.normals) {
        for (let i = 0; i < this.morphedNormals.length; i++) {
          this.morphedNormals[i] += target.normals[i] * weight;
        }
      }
    }

    // Update attributes
    const posAttr = this.getAttribute('position');
    if (posAttr) {
      posAttr.array.set(this.morphedPositions);
      posAttr.needsUpdate = true;
    }

    if (this.morphedNormals) {
      const normalAttr = this.getAttribute('normal');
      if (normalAttr) {
        // Renormalize normals
        for (let i = 0; i < this.morphedNormals.length; i += 3) {
          const x = this.morphedNormals[i];
          const y = this.morphedNormals[i + 1];
          const z = this.morphedNormals[i + 2];
          const len = Math.sqrt(x * x + y * y + z * z);
          if (len > 0) {
            this.morphedNormals[i] /= len;
            this.morphedNormals[i + 1] /= len;
            this.morphedNormals[i + 2] /= len;
          }
        }
        normalAttr.array.set(this.morphedNormals);
        normalAttr.needsUpdate = true;
      }
    }

    this.markDirty();
    return this;
  }

  /**
   * Reset all weights to 0 and apply
   */
  reset(): this {
    for (const name of this.weights.keys()) {
      this.weights.set(name, 0);
    }
    return this.apply();
  }

  /**
   * Compute bounding box including all morph targets at full weight
   */
  computeMorphBoundingBox(): BoundingBox {
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };

    const vertexCount = this.basePositions.length / 3;

    for (let i = 0; i < vertexCount; i++) {
      const baseX = this.basePositions[i * 3];
      const baseY = this.basePositions[i * 3 + 1];
      const baseZ = this.basePositions[i * 3 + 2];

      // Start with base position
      let minX = baseX, maxX = baseX;
      let minY = baseY, maxY = baseY;
      let minZ = baseZ, maxZ = baseZ;

      // Expand for each morph target at full weight
      for (const target of this.targets.values()) {
        const dx = target.positions[i * 3];
        const dy = target.positions[i * 3 + 1];
        const dz = target.positions[i * 3 + 2];

        minX = Math.min(minX, baseX + dx);
        maxX = Math.max(maxX, baseX + dx);
        minY = Math.min(minY, baseY + dy);
        maxY = Math.max(maxY, baseY + dy);
        minZ = Math.min(minZ, baseZ + dz);
        maxZ = Math.max(maxZ, baseZ + dz);
      }

      min.x = Math.min(min.x, minX);
      min.y = Math.min(min.y, minY);
      min.z = Math.min(min.z, minZ);
      max.x = Math.max(max.x, maxX);
      max.y = Math.max(max.y, maxY);
      max.z = Math.max(max.z, maxZ);
    }

    return { min, max };
  }
}

/**
 * Create a morph target that scales positions away from center
 */
export function createScaleMorphTarget(
  geometry: Geometry,
  scaleX: number,
  scaleY: number,
  scaleZ = 1
): Omit<MorphTarget, 'name'> {
  const posAttr = geometry.getAttribute('position');
  if (!posAttr) throw new Error('Geometry needs position attribute');

  const positions = new Float32Array(posAttr.array.length);

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i) ?? 0;

    // Store delta (scaled - original)
    positions[i * 3] = x * (scaleX - 1);
    positions[i * 3 + 1] = y * (scaleY - 1);
    positions[i * 3 + 2] = z * (scaleZ - 1);
  }

  return { positions };
}

/**
 * Create a morph target that offsets positions
 */
export function createOffsetMorphTarget(
  geometry: Geometry,
  offsetX: number,
  offsetY: number,
  offsetZ = 0
): Omit<MorphTarget, 'name'> {
  const posAttr = geometry.getAttribute('position');
  if (!posAttr) throw new Error('Geometry needs position attribute');

  const positions = new Float32Array(posAttr.array.length);

  for (let i = 0; i < posAttr.count; i++) {
    positions[i * 3] = offsetX;
    positions[i * 3 + 1] = offsetY;
    positions[i * 3 + 2] = offsetZ;
  }

  return { positions };
}

/**
 * Create a morph target that bulges positions outward from center
 */
export function createBulgeMorphTarget(
  geometry: Geometry,
  strength: number,
  axis: 'x' | 'y' | 'z' = 'z'
): Omit<MorphTarget, 'name'> {
  const posAttr = geometry.getAttribute('position');
  if (!posAttr) throw new Error('Geometry needs position attribute');

  const positions = new Float32Array(posAttr.array.length);

  // Compute center
  let cx = 0, cy = 0;
  for (let i = 0; i < posAttr.count; i++) {
    cx += posAttr.getX(i);
    cy += posAttr.getY(i);
  }
  cx /= posAttr.count;
  cy /= posAttr.count;

  // Compute max distance for normalization
  let maxDist = 0;
  for (let i = 0; i < posAttr.count; i++) {
    const dx = posAttr.getX(i) - cx;
    const dy = posAttr.getY(i) - cy;
    maxDist = Math.max(maxDist, Math.sqrt(dx * dx + dy * dy));
  }

  const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;

  for (let i = 0; i < posAttr.count; i++) {
    const dx = posAttr.getX(i) - cx;
    const dy = posAttr.getY(i) - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const normalized = maxDist > 0 ? dist / maxDist : 0;

    // Bulge formula: more bulge in center, tapering to edges
    const bulge = Math.cos(normalized * Math.PI / 2) * strength;

    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;
    positions[i * 3 + axisIndex] = bulge;
  }

  return { positions };
}
