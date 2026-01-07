/**
 * @scene/renderer
 * 
 * WebGPU rendering foundation for Scene engine.
 * Provides WebGPU context management, quad rendering, post-processing, and shader library.
 */

export { WebGPUContext } from './WebGPUContext';
export type { WebGPUContextOptions, WebGPUContextState } from './WebGPUContext';

export { QuadRenderer } from './QuadRenderer';
export type { QuadVertex, QuadInstance, QuadRenderOptions } from './QuadRenderer';

export { ScreenPass } from './ScreenPass';
export type { ScreenPassOptions, ScreenPassEffect } from './ScreenPass';

export { ShaderLibrary } from './ShaderLibrary';
export type { ShaderModule, CompiledShader } from './ShaderLibrary';
