import { WebGPUContext, type WebGPUContextOptions } from '@scene/renderer';

type SharedWebGPUState = {
  initPromise: Promise<WebGPUContext | null> | null;
  context: WebGPUContext | null;
  refCount: number;
  destroyTimeout: ReturnType<typeof setTimeout> | null;
};

const getSharedState = (): SharedWebGPUState => {
  const root = globalThis as typeof globalThis & { __sceneSharedWebGPU?: SharedWebGPUState };
  if (!root.__sceneSharedWebGPU) {
    root.__sceneSharedWebGPU = {
      initPromise: null,
      context: null,
      refCount: 0,
      destroyTimeout: null,
    };
  }
  return root.__sceneSharedWebGPU;
};

const scheduleDestroy = (state: SharedWebGPUState): void => {
  if (state.destroyTimeout) {
    clearTimeout(state.destroyTimeout);
  }
  state.destroyTimeout = setTimeout(() => {
    if (state.refCount > 0) return;
    state.context?.destroy();
    state.context = null;
    state.initPromise = null;
    state.refCount = 0;
    state.destroyTimeout = null;
  }, 250);
};

const reconfigure = (context: WebGPUContext, canvas: HTMLCanvasElement, alphaMode?: GPUCanvasAlphaMode): void => {
  context.reconfigure(canvas, alphaMode ?? 'premultiplied');
};

export type SharedWebGPUHandle = {
  context: WebGPUContext | null;
  initialized: boolean;
  reused: boolean;
  release: () => void;
};

export const acquireSharedWebGPUContext = async (
  canvas: HTMLCanvasElement,
  options: Omit<WebGPUContextOptions, 'canvas'> = {}
): Promise<SharedWebGPUHandle> => {
  const state = getSharedState();

  if (state.destroyTimeout) {
    clearTimeout(state.destroyTimeout);
    state.destroyTimeout = null;
  }

  const release = (): void => {
    state.refCount = Math.max(0, state.refCount - 1);
    if (state.refCount === 0) {
      scheduleDestroy(state);
    }
  };

  if (state.context && (!state.context.isAvailable || !state.context.device)) {
    state.context.destroy();
    state.context = null;
  }

  if (state.context?.isAvailable && state.context.device) {
    state.refCount += 1;
    reconfigure(state.context, canvas, options.alphaMode);
    return { context: state.context, initialized: true, reused: true, release };
  }

  if (state.initPromise) {
    const existing = await state.initPromise;
    if (existing?.device) {
      state.context = existing;
      state.refCount += 1;
      reconfigure(existing, canvas, options.alphaMode);
      return { context: existing, initialized: true, reused: true, release };
    }
    return { context: null, initialized: false, reused: false, release: () => undefined };
  }

  state.initPromise = (async () => {
    const context = new WebGPUContext();
    const initialized = await context.initialize({
      canvas,
      powerPreference: options.powerPreference,
      alphaMode: options.alphaMode,
      onProgress: options.onProgress,
    });
    if (!initialized || !context.device) {
      context.destroy();
      return null;
    }
    return context;
  })();

  const created = await state.initPromise;
  state.initPromise = null;

  if (!created?.device) {
    return { context: null, initialized: false, reused: false, release: () => undefined };
  }

  state.context = created;
  state.refCount += 1;
  reconfigure(created, canvas, options.alphaMode);
  return { context: created, initialized: true, reused: false, release };
};
