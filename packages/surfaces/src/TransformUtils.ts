/**
 * TransformUtils - CSS transform matrix decomposition
 * 
 * Extracts translation, rotation, scale, and skew from CSS transforms.
 * This allows Scene to understand and replicate CSS transforms on the GPU.
 */

/** Decomposed transform values */
export interface DecomposedTransform {
  /** Translation in pixels */
  translate: { x: number; y: number; z: number };
  /** Rotation in radians */
  rotate: { x: number; y: number; z: number };
  /** Scale factors */
  scale: { x: number; y: number; z: number };
  /** Skew in radians */
  skew: { x: number; y: number };
  /** Transform origin (relative to element, 0-1) */
  origin: { x: number; y: number };
  /** Whether a 3D transform is detected */
  is3D: boolean;
}

/** Default identity transform */
export const IDENTITY_TRANSFORM: DecomposedTransform = {
  translate: { x: 0, y: 0, z: 0 },
  rotate: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  skew: { x: 0, y: 0 },
  origin: { x: 0.5, y: 0.5 },
  is3D: false,
};

/**
 * Get the computed transform matrix from an element
 */
export function getTransformMatrix(element: HTMLElement): DOMMatrix {
  const style = window.getComputedStyle(element);
  const transform = style.transform;
  
  if (!transform || transform === 'none') {
    return new DOMMatrix();
  }
  
  return new DOMMatrix(transform);
}

/**
 * Get the transform origin from an element
 */
export function getTransformOrigin(element: HTMLElement): { x: number; y: number } {
  const style = window.getComputedStyle(element);
  const origin = style.transformOrigin;
  
  if (!origin) {
    return { x: 0.5, y: 0.5 };
  }
  
  // Parse "Xpx Ypx" format
  const parts = origin.split(' ');
  const rect = element.getBoundingClientRect();
  
  const x = parseFloat(parts[0]) / rect.width;
  const y = parseFloat(parts[1] || parts[0]) / rect.height;
  
  return {
    x: isNaN(x) ? 0.5 : x,
    y: isNaN(y) ? 0.5 : y,
  };
}

/**
 * Decompose a CSS transform matrix into translation, rotation, scale, and skew
 * 
 * Uses the algorithm from the CSS Transforms spec:
 * https://www.w3.org/TR/css-transforms-1/#decomposing-a-2d-matrix
 * 
 * @param element - The element to decompose
 * @returns Decomposed transform values
 */
export function decomposeTransform(element: HTMLElement): DecomposedTransform {
  const matrix = getTransformMatrix(element);
  const origin = getTransformOrigin(element);
  
  // Check if it's a 3D transform
  const is3D = matrix.is2D === false;
  
  if (is3D) {
    return decompose3DMatrix(matrix, origin);
  }
  
  return decompose2DMatrix(matrix, origin);
}

/**
 * Decompose a 2D CSS transform matrix
 */
function decompose2DMatrix(matrix: DOMMatrix, origin: { x: number; y: number }): DecomposedTransform {
  const { a, b, c, d, e, f } = matrix;
  
  // Translation
  const translate = { x: e, y: f, z: 0 };
  
  // Scale and rotation
  let scaleX = Math.sqrt(a * a + b * b);
  let scaleY = Math.sqrt(c * c + d * d);
  
  // Check for negative scale (flip)
  const determinant = a * d - b * c;
  if (determinant < 0) {
    scaleX = -scaleX;
  }
  
  // Rotation
  const rotation = Math.atan2(b, a);
  
  // Skew
  const skewX = Math.atan2(a * c + b * d, a * a + b * b);
  
  return {
    translate,
    rotate: { x: 0, y: 0, z: rotation },
    scale: { x: scaleX, y: scaleY, z: 1 },
    skew: { x: skewX, y: 0 },
    origin,
    is3D: false,
  };
}

/**
 * Decompose a 3D CSS transform matrix
 * 
 * Based on the algorithm from:
 * https://www.w3.org/TR/css-transforms-2/#decomposing-a-3d-matrix
 */
function decompose3DMatrix(matrix: DOMMatrix, origin: { x: number; y: number }): DecomposedTransform {
  // Get matrix elements
  const m11 = matrix.m11, m12 = matrix.m12, m13 = matrix.m13;
  const m21 = matrix.m21, m22 = matrix.m22, m23 = matrix.m23;
  const m31 = matrix.m31, m32 = matrix.m32, m33 = matrix.m33;
  const m41 = matrix.m41, m42 = matrix.m42, m43 = matrix.m43;
  
  // Translation
  const translate = { x: m41, y: m42, z: m43 };
  
  // Scale
  const scaleX = Math.sqrt(m11 * m11 + m12 * m12 + m13 * m13);
  const scaleY = Math.sqrt(m21 * m21 + m22 * m22 + m23 * m23);
  const scaleZ = Math.sqrt(m31 * m31 + m32 * m32 + m33 * m33);
  
  // Normalize the matrix columns
  const n11 = m11 / scaleX, n12 = m12 / scaleX, n13 = m13 / scaleX;
  const n21 = m21 / scaleY, n22 = m22 / scaleY, n23 = m23 / scaleY;
  const _n31 = m31 / scaleZ, _n32 = m32 / scaleZ, n33 = m33 / scaleZ;
  void _n31; void _n32; // May be used in future for full 3D decomposition
  
  // Extract rotation as Euler angles (XYZ order)
  let rotateX: number, rotateY: number, rotateZ: number;
  
  if (n13 < 1) {
    if (n13 > -1) {
      rotateY = Math.asin(n13);
      rotateX = Math.atan2(-n23, n33);
      rotateZ = Math.atan2(-n12, n11);
    } else {
      // n13 = -1
      rotateY = -Math.PI / 2;
      rotateX = -Math.atan2(n21, n22);
      rotateZ = 0;
    }
  } else {
    // n13 = 1
    rotateY = Math.PI / 2;
    rotateX = Math.atan2(n21, n22);
    rotateZ = 0;
  }
  
  return {
    translate,
    rotate: { x: rotateX, y: rotateY, z: rotateZ },
    scale: { x: scaleX, y: scaleY, z: scaleZ },
    skew: { x: 0, y: 0 }, // 3D skew is complex, omitting for now
    origin,
    is3D: true,
  };
}

/**
 * Compose a transform matrix from decomposed values
 * 
 * @param transform - Decomposed transform values
 * @returns A new DOMMatrix with the composed transform
 */
export function composeTransform(transform: DecomposedTransform): DOMMatrix {
  const matrix = new DOMMatrix();
  
  // Apply in order: translate, rotate, scale, skew
  matrix.translateSelf(
    transform.translate.x,
    transform.translate.y,
    transform.translate.z
  );
  
  if (transform.is3D) {
    matrix.rotateAxisAngleSelf(1, 0, 0, transform.rotate.x * 180 / Math.PI);
    matrix.rotateAxisAngleSelf(0, 1, 0, transform.rotate.y * 180 / Math.PI);
    matrix.rotateAxisAngleSelf(0, 0, 1, transform.rotate.z * 180 / Math.PI);
  } else {
    matrix.rotateSelf(transform.rotate.z * 180 / Math.PI);
  }
  
  matrix.scaleSelf(
    transform.scale.x,
    transform.scale.y,
    transform.scale.z
  );
  
  if (transform.skew.x !== 0 || transform.skew.y !== 0) {
    matrix.skewXSelf(transform.skew.x * 180 / Math.PI);
    matrix.skewYSelf(transform.skew.y * 180 / Math.PI);
  }
  
  return matrix;
}

/**
 * Interpolate between two decomposed transforms
 * 
 * @param a - Start transform
 * @param b - End transform
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated transform
 */
export function lerpTransform(
  a: DecomposedTransform,
  b: DecomposedTransform,
  t: number
): DecomposedTransform {
  return {
    translate: {
      x: a.translate.x + (b.translate.x - a.translate.x) * t,
      y: a.translate.y + (b.translate.y - a.translate.y) * t,
      z: a.translate.z + (b.translate.z - a.translate.z) * t,
    },
    rotate: {
      x: a.rotate.x + (b.rotate.x - a.rotate.x) * t,
      y: a.rotate.y + (b.rotate.y - a.rotate.y) * t,
      z: a.rotate.z + (b.rotate.z - a.rotate.z) * t,
    },
    scale: {
      x: a.scale.x + (b.scale.x - a.scale.x) * t,
      y: a.scale.y + (b.scale.y - a.scale.y) * t,
      z: a.scale.z + (b.scale.z - a.scale.z) * t,
    },
    skew: {
      x: a.skew.x + (b.skew.x - a.skew.x) * t,
      y: a.skew.y + (b.skew.y - a.skew.y) * t,
    },
    origin: {
      x: a.origin.x + (b.origin.x - a.origin.x) * t,
      y: a.origin.y + (b.origin.y - a.origin.y) * t,
    },
    is3D: a.is3D || b.is3D,
  };
}

/**
 * Check if a transform is effectively identity (no visible change)
 */
export function isIdentityTransform(transform: DecomposedTransform): boolean {
  const epsilon = 0.0001;
  
  return (
    Math.abs(transform.translate.x) < epsilon &&
    Math.abs(transform.translate.y) < epsilon &&
    Math.abs(transform.translate.z) < epsilon &&
    Math.abs(transform.rotate.x) < epsilon &&
    Math.abs(transform.rotate.y) < epsilon &&
    Math.abs(transform.rotate.z) < epsilon &&
    Math.abs(transform.scale.x - 1) < epsilon &&
    Math.abs(transform.scale.y - 1) < epsilon &&
    Math.abs(transform.scale.z - 1) < epsilon &&
    Math.abs(transform.skew.x) < epsilon &&
    Math.abs(transform.skew.y) < epsilon
  );
}

/**
 * Get the combined transform matrix including transform-origin
 * 
 * @param element - The element to get transform from
 * @returns Transform matrix adjusted for origin
 */
export function getFullTransformMatrix(element: HTMLElement): DOMMatrix {
  const matrix = getTransformMatrix(element);
  const origin = getTransformOrigin(element);
  const rect = element.getBoundingClientRect();
  
  // Translate to origin, apply transform, translate back
  const result = new DOMMatrix();
  result.translateSelf(origin.x * rect.width, origin.y * rect.height);
  result.multiplySelf(matrix);
  result.translateSelf(-origin.x * rect.width, -origin.y * rect.height);
  
  return result;
}
