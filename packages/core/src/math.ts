/**
 * @scene/core - Math Utilities
 *
 * Common mathematical functions used across Scene packages.
 */

/**
 * Linear interpolation between two values.
 * @param a Start value
 * @param b End value
 * @param t Interpolation factor (0-1)
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp a value between min and max bounds.
 * @param value Value to clamp
 * @param min Minimum bound
 * @param max Maximum bound
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Inverse linear interpolation - find t given a value between a and b.
 * @param a Start value
 * @param b End value
 * @param value Value to find t for
 * @returns t value (0-1 if value is between a and b)
 */
export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) return 0;
  return (value - a) / (b - a);
}

/**
 * Remap a value from one range to another.
 * @param inMin Input range minimum
 * @param inMax Input range maximum
 * @param outMin Output range minimum
 * @param outMax Output range maximum
 * @param value Value to remap
 */
export function remap(
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
  value: number
): number {
  const t = inverseLerp(inMin, inMax, value);
  return lerp(outMin, outMax, t);
}

/**
 * Hermite interpolation with smooth edges at 0 and 1.
 * @param edge0 Lower edge
 * @param edge1 Upper edge
 * @param x Value to interpolate
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
