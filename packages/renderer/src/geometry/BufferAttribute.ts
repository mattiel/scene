/**
 * BufferAttribute - Vertex attribute data management
 * 
 * Manages typed array data for vertex attributes (position, texCoord, etc.)
 */

/// <reference types="@webgpu/types" />

/** Typed array types for vertex data */
export type TypedArray = Float32Array | Uint16Array | Uint32Array;

/**
 * BufferAttribute - Holds vertex attribute data
 * 
 * @example
 * ```typescript
 * // Create position attribute with 4 vertices (3 components each)
 * const positions = new BufferAttribute(
 *   new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
 *   3
 * );
 * ```
 */
export class BufferAttribute {
  /** Raw typed array data */
  readonly array: TypedArray;
  /** Number of components per vertex (1, 2, 3, or 4) */
  readonly itemSize: number;
  /** Number of items (vertices) */
  readonly count: number;
  /** Whether data needs upload to GPU */
  needsUpdate = false;

  constructor(array: TypedArray, itemSize: number) {
    this.array = array;
    this.itemSize = itemSize;
    this.count = array.length / itemSize;
  }

  /**
   * Get x component at index
   */
  getX(index: number): number {
    return this.array[index * this.itemSize];
  }

  /**
   * Get y component at index
   */
  getY(index: number): number {
    return this.array[index * this.itemSize + 1];
  }

  /**
   * Get z component at index
   */
  getZ(index: number): number | undefined {
    if (this.itemSize < 3) return undefined;
    return this.array[index * this.itemSize + 2];
  }

  /**
   * Set x component at index
   */
  setX(index: number, value: number): this {
    this.array[index * this.itemSize] = value;
    this.needsUpdate = true;
    return this;
  }

  /**
   * Set y component at index
   */
  setY(index: number, value: number): this {
    this.array[index * this.itemSize + 1] = value;
    this.needsUpdate = true;
    return this;
  }

  /**
   * Set z component at index
   */
  setZ(index: number, value: number): this {
    if (this.itemSize >= 3) {
      this.array[index * this.itemSize + 2] = value;
      this.needsUpdate = true;
    }
    return this;
  }

  /**
   * Set xyz at index
   */
  setXYZ(index: number, x: number, y: number, z: number): this {
    const i = index * this.itemSize;
    this.array[i] = x;
    this.array[i + 1] = y;
    if (this.itemSize >= 3) {
      this.array[i + 2] = z;
    }
    this.needsUpdate = true;
    return this;
  }

  /**
   * Set xy at index
   */
  setXY(index: number, x: number, y: number): this {
    const i = index * this.itemSize;
    this.array[i] = x;
    this.array[i + 1] = y;
    this.needsUpdate = true;
    return this;
  }

  /**
   * Copy values from another attribute
   */
  copy(source: BufferAttribute): this {
    this.array.set(source.array);
    this.needsUpdate = true;
    return this;
  }

  /**
   * Clone this attribute
   */
  clone(): BufferAttribute {
    const TypedArrayConstructor = this.array.constructor as {
      new (array: TypedArray): TypedArray;
    };
    return new BufferAttribute(
      new TypedArrayConstructor(this.array),
      this.itemSize
    );
  }
}

/**
 * Create a Float32 buffer attribute
 */
export function float32Attribute(
  data: number[] | Float32Array,
  itemSize: number
): BufferAttribute {
  const array = data instanceof Float32Array ? data : new Float32Array(data);
  return new BufferAttribute(array, itemSize);
}

/**
 * Create a Uint16 index buffer attribute
 */
export function uint16Index(data: number[] | Uint16Array): BufferAttribute {
  const array = data instanceof Uint16Array ? data : new Uint16Array(data);
  return new BufferAttribute(array, 1);
}

/**
 * Create a Uint32 index buffer attribute
 */
export function uint32Index(data: number[] | Uint32Array): BufferAttribute {
  const array = data instanceof Uint32Array ? data : new Uint32Array(data);
  return new BufferAttribute(array, 1);
}
