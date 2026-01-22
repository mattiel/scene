/**
 * Camera - 3D camera with matrix utilities
 * 
 * Provides perspective projection, view matrix computation,
 * and common matrix operations for 3D rendering.
 */

/// <reference types="@webgpu/types" />

/** Camera configuration */
export interface CameraConfig {
  /** Camera position in world space [x, y, z] */
  position?: [number, number, number];
  /** Target point to look at [x, y, z] */
  target?: [number, number, number];
  /** Up vector [x, y, z] */
  up?: [number, number, number];
  /** Field of view in radians */
  fov?: number;
  /** Near clipping plane */
  near?: number;
  /** Far clipping plane */
  far?: number;
}

/**
 * Camera - 3D perspective camera
 * 
 * @example
 * ```typescript
 * // Create camera positioned 1200 units back
 * const camera = new Camera({
 *   position: [0, 0, 1200],
 *   fov: Math.atan(window.innerHeight / 2 / 1200) * 2,
 * });
 * 
 * // Get view-projection matrix for rendering
 * const vpMatrix = camera.getViewProjectionMatrix(width / height);
 * ```
 */
export class Camera {
  /** Camera position in world space */
  position: [number, number, number];
  /** Target point to look at */
  target: [number, number, number];
  /** Up vector */
  up: [number, number, number];
  /** Field of view in radians */
  fov: number;
  /** Near clipping plane */
  near: number;
  /** Far clipping plane */
  far: number;

  constructor(config: CameraConfig = {}) {
    this.position = config.position ?? [0, 0, 1];
    this.target = config.target ?? [0, 0, 0];
    this.up = config.up ?? [0, 1, 0];
    this.fov = config.fov ?? Math.PI / 4; // 45 degrees
    this.near = config.near ?? 0.1;
    this.far = config.far ?? 4000;
  }

  /**
   * Get view matrix (camera transformation)
   */
  getViewMatrix(): Float32Array {
    return lookAt(this.position, this.target, this.up);
  }

  /**
   * Get projection matrix
   */
  getProjectionMatrix(aspect: number): Float32Array {
    return perspective(this.fov, aspect, this.near, this.far);
  }

  /**
   * Get combined view-projection matrix
   */
  getViewProjectionMatrix(aspect: number): Float32Array {
    const view = this.getViewMatrix();
    const proj = this.getProjectionMatrix(aspect);
    return multiply(proj, view);
  }

  /**
   * Set position from x, y, z
   */
  setPosition(x: number, y: number, z: number): this {
    this.position = [x, y, z];
    return this;
  }

  /**
   * Set target from x, y, z
   */
  setTarget(x: number, y: number, z: number): this {
    this.target = [x, y, z];
    return this;
  }

  /**
   * Get camera forward direction (normalized)
   */
  getDirection(): [number, number, number] {
    const [px, py, pz] = this.position;
    const [tx, ty, tz] = this.target;
    const dx = tx - px;
    const dy = ty - py;
    const dz = tz - pz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return [dx / len, dy / len, dz / len];
  }

  /**
   * Create a camera that matches screen pixels 1:1 at z=0
   * 
   * @param viewportHeight - Viewport height in pixels
   * @param distance - Distance from origin (default: 1200)
   */
  static pixel(viewportHeight: number, distance = 1200): Camera {
    // Calculate FOV so that 1 pixel at z=0 = 1 unit
    const fov = 2 * Math.atan(viewportHeight / 2 / distance);
    return new Camera({
      position: [0, 0, distance],
      fov,
      near: 0.1,
      far: distance * 4,
    });
  }
}

// ============================================
// Matrix Utilities
// ============================================

/**
 * Create a perspective projection matrix
 */
export function perspective(
  fov: number,
  aspect: number,
  near: number,
  far: number
): Float32Array {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, (2 * far * near) * nf, 0,
  ]);
}

/**
 * Create a look-at view matrix
 */
export function lookAt(
  eye: [number, number, number],
  center: [number, number, number],
  up: [number, number, number]
): Float32Array {
  const [ex, ey, ez] = eye;
  const [cx, cy, cz] = center;
  const [ux, uy, uz] = up;

  // Calculate camera Z axis (pointing away from target)
  let zx = ex - cx;
  let zy = ey - cy;
  let zz = ez - cz;
  let len = Math.hypot(zx, zy, zz);
  zx /= len;
  zy /= len;
  zz /= len;

  // Calculate camera X axis (right) via cross product
  let xx = uy * zz - uz * zy;
  let xy = uz * zx - ux * zz;
  let xz = ux * zy - uy * zx;
  len = Math.hypot(xx, xy, xz);
  xx /= len;
  xy /= len;
  xz /= len;

  // Calculate camera Y axis (up) via cross product
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  // Build view matrix (column-major for WebGPU)
  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * ex + xy * ey + xz * ez),
    -(yx * ex + yy * ey + yz * ez),
    -(zx * ex + zy * ey + zz * ez),
    1,
  ]);
}

/**
 * Create a translation matrix
 */
export function translate(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
}

/**
 * Create a rotation matrix around Y axis
 */
export function rotateY(angle: number): Float32Array {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([
    c, 0, s, 0,
    0, 1, 0, 0,
    -s, 0, c, 0,
    0, 0, 0, 1,
  ]);
}

/**
 * Create a rotation matrix around X axis
 */
export function rotateX(angle: number): Float32Array {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([
    1, 0, 0, 0,
    0, c, -s, 0,
    0, s, c, 0,
    0, 0, 0, 1,
  ]);
}

/**
 * Create a rotation matrix around Z axis
 */
export function rotateZ(angle: number): Float32Array {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([
    c, -s, 0, 0,
    s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

/**
 * Create a scale matrix
 */
export function scale(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    x, 0, 0, 0,
    0, y, 0, 0,
    0, 0, z, 0,
    0, 0, 0, 1,
  ]);
}

/**
 * Multiply two 4x4 matrices (A * B)
 */
export function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  const b00 = b[0], b01 = b[1], b02 = b[2], b03 = b[3];
  const b10 = b[4], b11 = b[5], b12 = b[6], b13 = b[7];
  const b20 = b[8], b21 = b[9], b22 = b[10], b23 = b[11];
  const b30 = b[12], b31 = b[13], b32 = b[14], b33 = b[15];

  out[0] = a00 * b00 + a10 * b01 + a20 * b02 + a30 * b03;
  out[1] = a01 * b00 + a11 * b01 + a21 * b02 + a31 * b03;
  out[2] = a02 * b00 + a12 * b01 + a22 * b02 + a32 * b03;
  out[3] = a03 * b00 + a13 * b01 + a23 * b02 + a33 * b03;

  out[4] = a00 * b10 + a10 * b11 + a20 * b12 + a30 * b13;
  out[5] = a01 * b10 + a11 * b11 + a21 * b12 + a31 * b13;
  out[6] = a02 * b10 + a12 * b11 + a22 * b12 + a32 * b13;
  out[7] = a03 * b10 + a13 * b11 + a23 * b12 + a33 * b13;

  out[8] = a00 * b20 + a10 * b21 + a20 * b22 + a30 * b23;
  out[9] = a01 * b20 + a11 * b21 + a21 * b22 + a31 * b23;
  out[10] = a02 * b20 + a12 * b21 + a22 * b22 + a32 * b23;
  out[11] = a03 * b20 + a13 * b21 + a23 * b22 + a33 * b23;

  out[12] = a00 * b30 + a10 * b31 + a20 * b32 + a30 * b33;
  out[13] = a01 * b30 + a11 * b31 + a21 * b32 + a31 * b33;
  out[14] = a02 * b30 + a12 * b31 + a22 * b32 + a32 * b33;
  out[15] = a03 * b30 + a13 * b31 + a23 * b32 + a33 * b33;

  return out;
}

/**
 * Compose a model matrix from position, rotation, and scale
 */
export function composeModelMatrix(
  position: [number, number, number],
  rotation: [number, number, number],
  scaleXYZ: [number, number, number]
): Float32Array {
  const t = translate(position[0], position[1], position[2]);
  const rx = rotateX(rotation[0]);
  const ry = rotateY(rotation[1]);
  const rz = rotateZ(rotation[2]);
  const s = scale(scaleXYZ[0], scaleXYZ[1], scaleXYZ[2]);
  
  // TRS order: translate * rotateZ * rotateY * rotateX * scale
  return multiply(t, multiply(rz, multiply(ry, multiply(rx, s))));
}

/**
 * Create an identity matrix
 */
export function identity(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}
