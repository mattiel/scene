/**
 * Uniform buffer management for Materials
 * 
 * Handles type-safe uniform management and GPU buffer synchronization.
 */

/// <reference types="@webgpu/types" />

/** Supported uniform value types */
export type UniformValue = number | number[] | Float32Array;

/** Uniform definition with type info */
export interface UniformDefinition {
  type: 'f32' | 'vec2f' | 'vec3f' | 'vec4f' | 'mat4x4f';
  default?: UniformValue;
}

/** Map of uniform names to definitions */
export type UniformSchema = Record<string, UniformDefinition>;

/** Map of uniform names to current values */
export type UniformValues<T extends UniformSchema> = {
  [K in keyof T]: UniformValue;
};

/**
 * Get the byte size of a uniform type
 */
export function uniformSize(type: UniformDefinition['type']): number {
  switch (type) {
    case 'f32': return 4;
    case 'vec2f': return 8;
    case 'vec3f': return 12;
    case 'vec4f': return 16;
    case 'mat4x4f': return 64;
    default: return 4;
  }
}

/**
 * Get the byte alignment of a uniform type
 */
export function uniformAlignment(type: UniformDefinition['type']): number {
  switch (type) {
    case 'f32': return 4;
    case 'vec2f': return 8;
    case 'vec3f': return 16; // vec3 requires 16-byte alignment in WGSL
    case 'vec4f': return 16;
    case 'mat4x4f': return 16;
    default: return 4;
  }
}

/**
 * Calculate buffer layout for a uniform schema
 */
export interface UniformLayout {
  /** Total buffer size in bytes (aligned) */
  size: number;
  /** Offset for each uniform */
  offsets: Record<string, number>;
}

export function calculateLayout(schema: UniformSchema): UniformLayout {
  const offsets: Record<string, number> = {};
  let offset = 0;

  for (const [name, def] of Object.entries(schema)) {
    const align = uniformAlignment(def.type);
    const size = uniformSize(def.type);
    
    // Align offset to requirement
    offset = Math.ceil(offset / align) * align;
    offsets[name] = offset;
    offset += size;
  }

  // Round up to 16-byte alignment for the full buffer
  const size = Math.ceil(offset / 16) * 16;

  return { size, offsets };
}

/**
 * UniformBuffer - Manages a GPU uniform buffer
 * 
 * Provides type-safe uniform access and efficient GPU updates.
 */
export class UniformBuffer {
  readonly schema: UniformSchema;
  readonly layout: UniformLayout;
  
  private data: Float32Array;
  private buffer: GPUBuffer | null = null;
  private device: GPUDevice | null = null;
  private dirty = false;

  constructor(schema: UniformSchema) {
    this.schema = schema;
    this.layout = calculateLayout(schema);
    
    // Create CPU-side buffer
    this.data = new Float32Array(this.layout.size / 4);
    
    // Initialize with defaults
    for (const [name, def] of Object.entries(schema)) {
      if (def.default !== undefined) {
        this.set(name, def.default);
      }
    }
  }

  /**
   * Initialize GPU buffer
   */
  init(device: GPUDevice): void {
    this.device = device;
    
    this.buffer = device.createBuffer({
      label: 'UniformBuffer',
      size: this.layout.size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    // Initial upload
    this.upload();
  }

  /**
   * Get the GPU buffer
   */
  getBuffer(): GPUBuffer | null {
    return this.buffer;
  }

  /**
   * Set a uniform value
   */
  set(name: string, value: UniformValue): void {
    const def = this.schema[name];
    if (!def) {
      console.warn(`Unknown uniform: ${name}`);
      return;
    }

    const offset = this.layout.offsets[name] / 4; // Convert to float index

    if (typeof value === 'number') {
      this.data[offset] = value;
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        this.data[offset + i] = value[i];
      }
    } else {
      this.data.set(value, offset);
    }

    this.dirty = true;
  }

  /**
   * Get a uniform value
   */
  get(name: string): number | Float32Array | null {
    const def = this.schema[name];
    if (!def) return null;

    const offset = this.layout.offsets[name] / 4;
    const count = uniformSize(def.type) / 4;

    if (count === 1) {
      return this.data[offset];
    }
    return this.data.slice(offset, offset + count);
  }

  /**
   * Upload dirty uniforms to GPU
   */
  upload(): void {
    if (!this.dirty || !this.device || !this.buffer) return;
    
    // Cast to satisfy WebGPU types (our Float32Array is always from ArrayBuffer)
    this.device.queue.writeBuffer(
      this.buffer, 
      0, 
      this.data.buffer as ArrayBuffer,
      this.data.byteOffset,
      this.data.byteLength
    );
    this.dirty = false;
  }

  /**
   * Force upload regardless of dirty state
   */
  forceUpload(): void {
    this.dirty = true;
    this.upload();
  }

  /**
   * Check if buffer needs upload
   */
  get needsUpload(): boolean {
    return this.dirty;
  }

  /**
   * Clean up GPU resources
   */
  destroy(): void {
    if (this.buffer) {
      this.buffer.destroy();
      this.buffer = null;
    }
    this.device = null;
  }
}

/**
 * Create WGSL uniform struct declaration from schema
 */
export function generateUniformStruct(
  name: string,
  schema: UniformSchema
): string {
  const fields = Object.entries(schema)
    .map(([fieldName, def]) => `  ${fieldName}: ${def.type},`)
    .join('\n');
  
  return `struct ${name} {\n${fields}\n}`;
}
