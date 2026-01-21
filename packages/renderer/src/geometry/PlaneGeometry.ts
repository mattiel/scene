/**
 * PlaneGeometry - Subdivided plane for smooth deformations
 * 
 * Creates a plane with configurable subdivisions, useful for
 * applying vertex deformations like bending and ripples.
 */

import { Geometry } from './Geometry';
import { BufferAttribute } from './BufferAttribute';

/** PlaneGeometry configuration */
export interface PlaneGeometryConfig {
  /** Width of the plane */
  width?: number;
  /** Height of the plane */
  height?: number;
  /** Number of width segments */
  widthSegments?: number;
  /** Number of height segments */
  heightSegments?: number;
  /** Center the plane at origin */
  centered?: boolean;
}

/**
 * PlaneGeometry - A subdivided plane
 * 
 * @example
 * ```typescript
 * // Create a 300x420 plane with 32 subdivisions
 * const plane = new PlaneGeometry({
 *   width: 300,
 *   height: 420,
 *   widthSegments: 32,
 *   heightSegments: 32,
 * });
 * ```
 */
export class PlaneGeometry extends Geometry {
  readonly width: number;
  readonly height: number;
  readonly widthSegments: number;
  readonly heightSegments: number;

  constructor(config: PlaneGeometryConfig = {}) {
    super();

    this.width = config.width ?? 1;
    this.height = config.height ?? 1;
    this.widthSegments = Math.max(1, Math.floor(config.widthSegments ?? 1));
    this.heightSegments = Math.max(1, Math.floor(config.heightSegments ?? 1));

    const centered = config.centered ?? true;

    this.build(centered);
    this.computeBoundingBox();
  }

  /**
   * Build geometry data
   */
  private build(centered: boolean): void {
    const { width, height, widthSegments, heightSegments } = this;

    const gridX = widthSegments;
    const gridY = heightSegments;
    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;

    const segmentWidth = width / gridX;
    const segmentHeight = height / gridY;

    // Generate vertices
    const vertexCount = gridX1 * gridY1;
    const positions = new Float32Array(vertexCount * 3);
    const texCoords = new Float32Array(vertexCount * 2);

    const halfWidth = centered ? width / 2 : 0;
    const halfHeight = centered ? height / 2 : 0;

    let vertexIndex = 0;
    let uvIndex = 0;

    for (let iy = 0; iy < gridY1; iy++) {
      const y = iy * segmentHeight - halfHeight;
      const v = iy / gridY;

      for (let ix = 0; ix < gridX1; ix++) {
        const x = ix * segmentWidth - halfWidth;
        const u = ix / gridX;

        // Position (x, y, z)
        positions[vertexIndex++] = x;
        positions[vertexIndex++] = y;
        positions[vertexIndex++] = 0;

        // UV (u, v)
        texCoords[uvIndex++] = u;
        texCoords[uvIndex++] = 1 - v; // Flip V for WebGPU
      }
    }

    // Generate indices
    const indexCount = gridX * gridY * 6;
    const indices = new Uint16Array(indexCount);
    let indexIndex = 0;

    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = ix + gridX1 * iy;
        const b = ix + gridX1 * (iy + 1);
        const c = (ix + 1) + gridX1 * (iy + 1);
        const d = (ix + 1) + gridX1 * iy;

        // Two triangles per quad
        indices[indexIndex++] = a;
        indices[indexIndex++] = b;
        indices[indexIndex++] = d;

        indices[indexIndex++] = b;
        indices[indexIndex++] = c;
        indices[indexIndex++] = d;
      }
    }

    // Set attributes
    this.setAttribute('position', new BufferAttribute(positions, 3));
    this.setAttribute('texCoord', new BufferAttribute(texCoords, 2));
    this.setIndex(new BufferAttribute(indices, 1));
  }

  /**
   * Create a simple quad (no subdivisions)
   */
  static quad(width = 1, height = 1, centered = true): PlaneGeometry {
    return new PlaneGeometry({
      width,
      height,
      widthSegments: 1,
      heightSegments: 1,
      centered,
    });
  }

  /**
   * Create a plane suitable for card-style deformations
   */
  static card(
    width: number,
    height: number,
    segments = 32
  ): PlaneGeometry {
    return new PlaneGeometry({
      width,
      height,
      widthSegments: segments,
      heightSegments: Math.round(segments * (height / width)),
      centered: true,
    });
  }
}

/**
 * Create a fullscreen quad for post-processing
 * This uses clip-space coordinates directly.
 */
export function createFullscreenQuad(): Geometry {
  const geometry = new Geometry();

  // Fullscreen triangle (more efficient than quad)
  const positions = new Float32Array([
    -1, -1, 0,
    3, -1, 0,
    -1, 3, 0,
  ]);

  const texCoords = new Float32Array([
    0, 1,
    2, 1,
    0, -1,
  ]);

  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('texCoord', new BufferAttribute(texCoords, 2));

  return geometry;
}
