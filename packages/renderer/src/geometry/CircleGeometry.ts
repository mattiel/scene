/**
 * CircleGeometry - Filled circle with configurable segments
 * 
 * Creates a disc geometry using triangular fan pattern,
 * useful for radial effects, spotlights, and circular UI elements.
 */

import { Geometry } from './Geometry';
import { BufferAttribute } from './BufferAttribute';

/** CircleGeometry configuration */
export interface CircleGeometryConfig {
  /** Radius of the circle */
  radius?: number;
  /** Number of segments (more = smoother) */
  segments?: number;
  /** Start angle in radians */
  thetaStart?: number;
  /** Sweep angle in radians (default: full circle) */
  thetaLength?: number;
}

/**
 * CircleGeometry - A filled circle/disc
 * 
 * @example
 * ```typescript
 * // Full circle
 * const circle = new CircleGeometry({ radius: 50, segments: 32 });
 * 
 * // Half circle (semicircle)
 * const semi = new CircleGeometry({
 *   radius: 50,
 *   segments: 16,
 *   thetaLength: Math.PI,
 * });
 * ```
 */
export class CircleGeometry extends Geometry {
  readonly radius: number;
  readonly segments: number;
  readonly thetaStart: number;
  readonly thetaLength: number;

  constructor(config: CircleGeometryConfig = {}) {
    super();

    this.radius = config.radius ?? 1;
    this.segments = Math.max(3, Math.floor(config.segments ?? 32));
    this.thetaStart = config.thetaStart ?? 0;
    this.thetaLength = config.thetaLength ?? Math.PI * 2;

    this.build();
    this.computeBoundingBox();
  }

  /**
   * Build geometry data
   */
  private build(): void {
    const { radius, segments, thetaStart, thetaLength } = this;

    // Center vertex + perimeter vertices
    const vertexCount = segments + 2;
    const positions = new Float32Array(vertexCount * 3);
    const texCoords = new Float32Array(vertexCount * 2);
    const normals = new Float32Array(vertexCount * 3);

    // Center vertex
    positions[0] = 0;
    positions[1] = 0;
    positions[2] = 0;
    texCoords[0] = 0.5;
    texCoords[1] = 0.5;
    normals[0] = 0;
    normals[1] = 0;
    normals[2] = 1;

    // Perimeter vertices
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const theta = thetaStart + t * thetaLength;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      const vi = (i + 1) * 3;
      const ui = (i + 1) * 2;

      positions[vi] = cos * radius;
      positions[vi + 1] = sin * radius;
      positions[vi + 2] = 0;

      // UV maps from -1,1 to 0,1
      texCoords[ui] = (cos + 1) / 2;
      texCoords[ui + 1] = (sin + 1) / 2;

      normals[vi] = 0;
      normals[vi + 1] = 0;
      normals[vi + 2] = 1;
    }

    // Triangle fan indices
    const indexCount = segments * 3;
    const indices = new Uint16Array(indexCount);

    for (let i = 0; i < segments; i++) {
      const ii = i * 3;
      indices[ii] = 0; // Center
      indices[ii + 1] = i + 1;
      indices[ii + 2] = i + 2;
    }

    // Set attributes
    this.setAttribute('position', new BufferAttribute(positions, 3));
    this.setAttribute('texCoord', new BufferAttribute(texCoords, 2));
    this.setAttribute('normal', new BufferAttribute(normals, 3));
    this.setIndex(new BufferAttribute(indices, 1));
  }

  /**
   * Create a simple circle with default settings
   */
  static simple(radius = 1, segments = 32): CircleGeometry {
    return new CircleGeometry({ radius, segments });
  }

  /**
   * Create a pie/wedge shape
   */
  static pie(
    radius: number,
    startAngle: number,
    endAngle: number,
    segments = 32
  ): CircleGeometry {
    const thetaLength = endAngle - startAngle;
    const actualSegments = Math.max(3, Math.round(segments * (Math.abs(thetaLength) / (Math.PI * 2))));
    
    return new CircleGeometry({
      radius,
      segments: actualSegments,
      thetaStart: startAngle,
      thetaLength,
    });
  }
}
