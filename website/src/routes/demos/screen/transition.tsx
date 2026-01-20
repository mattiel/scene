import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WebGPUContext, ShaderLibrary } from '@scene/renderer';
import type { TransitionType, WipeDirection } from '@scene/screen';
import { TransitionEffect, registerTransitionShaders } from '@scene/screen';
import { DemoLayout } from '../../../components/DemoLayout';
import { ControlGroup } from '../../../components/ControlGroup';
import type { StatusItem } from '../../../components/StatusPanel';
import { StatusPanel } from '../../../components/StatusPanel';
import { Button } from '../../../components/ui/button';
import { Slider } from '../../../components/ui/slider';

export const Route = createFileRoute('/demos/screen/transition')({
  component: TransitionDemo,
});

function TransitionDemo() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<WebGPUContext | null>(null);
  const transitionRef = useRef<TransitionEffect | null>(null);
  const texturesRef = useRef<{ a: GPUTexture | null; b: GPUTexture | null }>({
    a: null,
    b: null,
  });
  const swappedRef = useRef(false);
  const [statusItems, setStatusItems] = useState<StatusItem[]>([]);
  const [transitionType, setTransitionType] = useState<TransitionType>('dissolve');
  const [wipeDirection, setWipeDirection] = useState<WipeDirection>('left-to-right');
  const [wipeSoftness, setWipeSoftness] = useState(0.1);
  const [zoomAmount, setZoomAmount] = useState(0.3);
  const [duration, setDuration] = useState(500);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [swapped, setSwapped] = useState(false);

  const addStatus = useCallback((message: string, tone: StatusItem['tone'] = 'info'): void => {
    setStatusItems((prev) => [
      ...prev,
      { id: `status-${prev.length}-${message}`, message, tone },
    ]);
  }, []);

  const renderFrame = useCallback((value: number): void => {
    const context = contextRef.current;
    const transition = transitionRef.current;
    const textureA = texturesRef.current.a;
    const textureB = texturesRef.current.b;
    if (!context?.device || !transition || !textureA || !textureB) return;

    const fromTex = swappedRef.current ? textureB : textureA;
    const toTex = swappedRef.current ? textureA : textureB;

    transition.setProgress(value);
    const commandEncoder = context.device.createCommandEncoder();
    transition.execute(commandEncoder, fromTex, toTex);
    context.device.queue.submit([commandEncoder.finish()]);
    setProgress(value);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isActive = true;
    let context: WebGPUContext | null = null;
    let shaderLibrary: ShaderLibrary | null = null;

    const renderColorToTexture = (texture: GPUTexture, color: GPUColor): void => {
      if (!context?.device) return;
      const commandEncoder = context.device.createCommandEncoder();
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: texture.createView(),
            clearValue: color,
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      pass.end();
      context.device.queue.submit([commandEncoder.finish()]);
    };

    const initialize = async (): Promise<void> => {
      addStatus('Initializing WebGPU...', 'info');

      context = new WebGPUContext();
      const initialized = await context.initialize({
        canvas,
        powerPreference: 'high-performance',
      });

      if (!initialized) {
        addStatus('WebGPU not available - demo cannot run.', 'warning');
        return;
      }

      addStatus('WebGPU initialized.', 'success');
      contextRef.current = context;

      shaderLibrary = new ShaderLibrary();
      shaderLibrary.setDevice(context.device);
      shaderLibrary.registerDefaults();
      registerTransitionShaders(shaderLibrary);

      const transition = new TransitionEffect(context, shaderLibrary, {
        type: transitionType,
        duration,
      });
      transition.initialize();
      transitionRef.current = transition;

      const rect = canvas.getBoundingClientRect();
      context.resize(rect.width, rect.height);

      const textureA = context.device.createTexture({
        size: [canvas.width, canvas.height],
        format: context.format ?? 'bgra8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      const textureB = context.device.createTexture({
        size: [canvas.width, canvas.height],
        format: context.format ?? 'bgra8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      renderColorToTexture(textureA, { r: 0.2, g: 0.2, b: 0.2, a: 1.0 });
      renderColorToTexture(textureB, { r: 0.4, g: 0.4, b: 0.4, a: 1.0 });

      texturesRef.current = { a: textureA, b: textureB };

      addStatus('Ready. Play transition to preview.', 'success');
      renderFrame(0);
    };

    initialize().catch((error: unknown) => {
      if (!isActive) return;
      const message = error instanceof Error ? error.message : String(error);
      addStatus(`Error: ${message}`, 'error');
      console.error(error);
    });

    return () => {
      isActive = false;
      transitionRef.current?.destroy();
      context?.destroy();
      texturesRef.current.a?.destroy();
      texturesRef.current.b?.destroy();
    };
  }, [addStatus, renderFrame]);

  const applyTransitionConfig = (): void => {
    if (!transitionRef.current) return;
    transitionRef.current.configure({
      type: transitionType,
      duration,
      wipeDirection,
      wipeSoftness,
      zoomAmount,
    });
  };

  useEffect(() => {
    applyTransitionConfig();
  }, [transitionType, duration, wipeDirection, wipeSoftness, zoomAmount]);

  useEffect(() => {
    swappedRef.current = swapped;
    renderFrame(progress);
  }, [progress, renderFrame, swapped]);

  const playTransition = (): void => {
    if (!transitionRef.current || isPlaying) return;
    setIsPlaying(true);

    const startTime = performance.now();
    const totalDuration = transitionRef.current.duration;

    const animate = (timestamp: number): void => {
      const elapsed = timestamp - startTime;
      const nextProgress = Math.min(elapsed / totalDuration, 1);
      renderFrame(nextProgress);

      if (nextProgress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
        setSwapped((prev) => !prev);
      }
    };

    requestAnimationFrame(animate);
  };

  return (
    <DemoLayout
      title="@scene/screen Transition Effects"
      description="Preview dissolve, wipe, fade-to-black, and zoom transitions."
      sidebar={
        <div className="flex flex-col gap-6">
          <StatusPanel items={statusItems} />
          <ControlGroup title="Transition Type">
            <select
              value={transitionType}
              onChange={(event) => setTransitionType(event.target.value as TransitionType)}
              className="h-9 w-full bg-neutral-100 px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground"
            >
              <option value="dissolve">Dissolve</option>
              <option value="wipe">Wipe</option>
              <option value="fade_to_black">Fade to Black</option>
              <option value="zoom">Zoom</option>
            </select>
          </ControlGroup>

          {transitionType === 'wipe' ? (
            <ControlGroup title="Wipe Options">
              <select
                value={wipeDirection}
                onChange={(event) => setWipeDirection(event.target.value as WipeDirection)}
                className="h-9 w-full bg-neutral-100 px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground"
              >
                <option value="left-to-right">Left → Right</option>
                <option value="right-to-left">Right → Left</option>
                <option value="top-to-bottom">Top → Bottom</option>
                <option value="bottom-to-top">Bottom → Top</option>
              </select>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">Softness</span>
                <Slider
                  value={[wipeSoftness]}
                  min={0}
                  max={0.5}
                  step={0.01}
                  onValueChange={(value) => setWipeSoftness(value[0] ?? 0)}
                />
                <span className="text-xs text-muted-foreground">{wipeSoftness.toFixed(2)}</span>
              </div>
            </ControlGroup>
          ) : null}

          {transitionType === 'zoom' ? (
            <ControlGroup title="Zoom Options">
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">Zoom Amount</span>
                <Slider
                  value={[zoomAmount]}
                  min={0.1}
                  max={1}
                  step={0.05}
                  onValueChange={(value) => setZoomAmount(value[0] ?? 0.3)}
                />
                <span className="text-xs text-muted-foreground">{zoomAmount.toFixed(2)}</span>
              </div>
            </ControlGroup>
          ) : null}

          <ControlGroup title="Duration">
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">ms</span>
              <Slider
                value={[duration]}
                min={200}
                max={2000}
                step={100}
                onValueChange={(value) => setDuration(value[0] ?? 500)}
              />
              <span className="text-xs text-muted-foreground">{duration}</span>
            </div>
          </ControlGroup>

          <ControlGroup title="Actions">
            <div className="flex gap-2">
              <Button size="sm" onClick={playTransition} disabled={isPlaying}>
                Play
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSwapped((prev) => !prev)}>
                Swap
              </Button>
            </div>
          </ControlGroup>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <canvas
          ref={canvasRef}
          className="h-[360px] w-full bg-neutral-950"
          aria-label="Transition canvas"
        />
        <div className="h-2 w-full bg-neutral-200">
          <div
            className="h-full bg-foreground transition-[width] duration-75"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </DemoLayout>
  );
}
