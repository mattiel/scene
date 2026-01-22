/**
 * RingGeometry - Annular ring with configurable inner/outer radius
 * 
 * Creates a ring (annulus) geometry, useful for progress indicators,
 * radial menus, and hollow circular elements.
 */

import { Geometry } from './Geometry';
import { BufferAttribute } from './BufferAttribute';

/** RingGeometry configuration */
export interface RingGeometryConfig {
  /** Inner radius of the ring */
  innerRadius?: number;
  /** Outer radius of the ring */
  outerRadius?: number;
  /** Number of radial segments (around the ring) */
  thetaSegments?: number;
  /** Number of ring segments (from inner to outer) */
  phiSegments?: number;
  /** Start angle in radians */
  thetaStart?: number;
  /** Sweep angle in radians (default: full circle) */
  thetaLength?: number;
}

/**
 * RingGeometry - A ring/annulus shape
 * 
 * @example
 * ```typescript
 * // Simple ring
 * const ring = new RingGeometry({
 *   innerRadius: 30,
 *   outerRadius: 50,
 *   thetaSegments: 32,
 * });
 * 
 * // Progress ring (partial)
 * const progress = new RingGeometry({
 *   innerRadius: 40,
 *   outerRadius: 50,
 *   thetaSegments: 64,
 *   thetaStart: -Math.PI / 2,
 *   thetaLength: Math.PI * 1.5, // 75%
 * });
 * ```
 */
export class RingGeometry extends Geometry {
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly thetaSegments: number;
  readonly phiSegments: number;
  readonly thetaStart: number;
  readonly thetaLength: number;

  constructor(config: RingGeometryConfig = {}) {
    super();

    this.innerRadius = config.innerRadius ?? 0.5;
    this.outerRadius = config.outerRadius ?? 1;
    this.thetaSegments = Math.max(3, Math.floor(config.thetaSegments ?? 32));
    this.phiSegments = Math.max(1, Math.floor(config.phiSegments ?? 1));
    this.thetaStart = config.thetaStart ?? 0;
    this.thetaLength = config.thetaLength ?? Math.PI * 2;

    this.build();
    this.computeBoundingBox();
  }

  /**
   * Build geometry data
   */
  private build(): void {
    const {
      innerRadius,
      outerRadius,
      thetaSegments,
      phiSegments,
      thetaStart,
      thetaLength,
    } = this;

    // Calculate vertex count
    const vertexCount = (thetaSegments + 1) * (phiSegments + 1);
    const positions = new Float32Array(vertexCount * 3);
    const texCoords = new Float32Array(vertexCount * 2);
    const normals = new Float32Array(vertexCount * 3);

    let vertexIndex = 0;
    let uvIndex = 0;
    let normalIndex = 0;

    // Generate vertices
    for (let phi = 0; phi <= phiSegments; phi++) {
      const phiRatio = phi / phiSegments;
      const radius = innerRadius + (outerRadius - innerRadius) * phiRatio;

      for (let theta = 0; theta <= thetaSegments; theta++) {
        const thetaRatio = theta / thetaSegments;
        const angle = thetaStart + thetaRatio * thetaLength;

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Position
        positions[vertexIndex++] = cos * radius;
        positions[vertexIndex++] = sin * radius;
        positions[vertexIndex++] = 0;

        // UV - maps ring to 0-1 square
        texCoords[uvIndex++] = thetaRatio;
        texCoords[uvIndex++] = phiRatio;

        // Normal (facing +Z)
        normals[normalIndex++] = 0;
        normals[normalIndex++] = 0;
        normals[normalIndex++] = 1;
      }
    }

    // Generate indices
    const indexCount = thetaSegments * phiSegments * 6;
    const indices = new Uint16Array(indexCount);
    let indexIndex = 0;

    for (let phi = 0; phi < phiSegments; phi++) {
      for (let theta = 0; theta < thetaSegments; theta++) {
        const a = phi * (thetaSegments + 1) + theta;
        const b = a + thetaSegments + 1;
        const c = a + 1;
        const d = b + 1;

        // Two triangles per quad
        indices[indexIndex++] = a;
        indices[indexIndex++] = b;
        indices[indexIndex++] = c;

        indices[indexIndex++] = b;
        indices[indexIndex++] = d;
        indices[indexIndex++] = c;
      }
    }

    // Set attributes
    this.setAttribute('position', new BufferAttribute(positions, 3));
    this.setAttribute('texCoord', new BufferAttribute(texCoords, 2));
    this.setAttribute('normal', new BufferAttribute(normals, 3));
    this.setIndex(new BufferAttribute(indices, 1));
  }

  /**
   * Create a simple ring
   */
  static simple(innerRadius: number, outerRadius: number, segments = 32): RingGeometry {
    return new RingGeometry({ innerRadius, outerRadius, thetaSegments: segments });
  }

  /**
   * Create a progress ring (arc)
   * @param progress - Progress value 0-1
   */
  static progress(
    innerRadius: number,
    outerRadius: number,
    progress: number,
    segments = 64
  ): RingGeometry {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const actualSegments = Math.max(3, Math.round(segments * clampedProgress));
    
    return new RingGeometry({
      innerRadius,
      outerRadius,
      thetaSegments: actualSegments,
      thetaStart: -Math.PI / 2, // Start from top
      thetaLength: Math.PI * 2 * clampedProgress,
    });
  }

  /**
   * Create a thick ring with multiple radial segments (for gradient effects)
   */
  static thick(
    innerRadius: number,
    outerRadius: number,
    thetaSegments = 32,
    phiSegments = 8
  ): RingGeometry {
    return new RingGeometry({
      innerRadius,
      outerRadius,
      thetaSegments,
      phiSegments,
    });
  }
}
