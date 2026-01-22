import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WebGPUContext, ShaderLibrary, ScreenPass } from '@scene/renderer';
import {
  EffectStack,
  createBlurEffect,
  createVignetteEffect,
  createChromaticAberrationEffect,
} from '@scene/screen';
import { DemoLayout } from '../../../components/DemoLayout';
import { ControlGroup } from '../../../components/ControlGroup';
import type { StatusItem } from '../../../components/StatusPanel';
import { StatusPanel } from '../../../components/StatusPanel';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { Slider } from '../../../components/ui/slider';

export const Route = createFileRoute('/demos/screen/effect-stack')({
  component: EffectStackDemo,
});

function EffectStackDemo() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const effectStackRef = useRef<EffectStack | null>(null);
  const effectIdsRef = useRef<{ blur?: string; vignette?: string; chroma?: string }>({});
  const animationRef = useRef<number | null>(null);
  const [statusItems, setStatusItems] = useState<StatusItem[]>([]);
  const [blurEnabled, setBlurEnabled] = useState(true);
  const [blurStrength, setBlurStrength] = useState(2);
  const [blurDirection, setBlurDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [vignetteEnabled, setVignetteEnabled] = useState(true);
  const [vignetteStrength, setVignetteStrength] = useState(0.5);
  const [vignetteRadius, setVignetteRadius] = useState(0.5);
  const [vignetteSoftness, setVignetteSoftness] = useState(0.5);
  const [chromaEnabled, setChromaEnabled] = useState(true);
  const [chromaStrength, setChromaStrength] = useState(0.01);

  const addStatus = useCallback((message: string, tone: StatusItem['tone'] = 'info'): void => {
    setStatusItems((prev) => [
      ...prev,
      { id: `status-${prev.length}-${message}`, message, tone },
    ]);
  }, []);

  useEffect(() => {
    let isActive = true;
    let rafId: number | null = null;
    let context: WebGPUContext | null = null;
    let screenPass: ScreenPass | null = null;
    let sourceTexture: GPUTexture | null = null;
    let animationTime = 0;

    const initialize = async (canvas: HTMLCanvasElement): Promise<void> => {
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

      const device = context.device;
      if (!device) {
        addStatus('WebGPU device unavailable - demo cannot run.', 'warning');
        return;
      }

      const shaderLibrary = new ShaderLibrary();
      shaderLibrary.setDevice(device);
      shaderLibrary.registerDefaults();

      screenPass = new ScreenPass(context, shaderLibrary);
      screenPass.initialize();

      const effectStack = new EffectStack(screenPass);
      effectStack.initialize();
      effectStack.registerFactory('blur', createBlurEffect);
      effectStack.registerFactory('vignette', createVignetteEffect);
      effectStack.registerFactory('chromatic_aberration', createChromaticAberrationEffect);
      effectStackRef.current = effectStack;

      const blur = effectStack.add({
        type: 'blur',
        params: { directionX: 1, directionY: 0, strength: blurStrength },
      });
      const vignette = effectStack.add({
        type: 'vignette',
        params: { strength: vignetteStrength, radius: vignetteRadius, softness: vignetteSoftness },
      });
      const chroma = effectStack.add({
        type: 'chromatic_aberration',
        params: { strength: chromaStrength },
      });

      if (blur) effectIdsRef.current.blur = blur.id;
      if (vignette) effectIdsRef.current.vignette = vignette.id;
      if (chroma) effectIdsRef.current.chroma = chroma.id;

      const rect = canvas.getBoundingClientRect();
      context.resize(rect.width, rect.height);

      sourceTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: context.format ?? 'bgra8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.RENDER_ATTACHMENT |
          GPUTextureUsage.COPY_DST,
      });

      addStatus('Ready. Adjust controls to test effects.', 'success');

      const render = (): void => {
        if (!isActive || !context || !screenPass || !sourceTexture) return;

        animationTime += 0.016;
        const commandEncoder = device.createCommandEncoder();
        const sourcePass = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              view: sourceTexture.createView(),
              clearValue: {
                r: 0.2 + Math.sin(animationTime) * 0.05,
                g: 0.2 + Math.cos(animationTime * 0.7) * 0.05,
                b: 0.2 + Math.sin(animationTime * 1.3) * 0.05,
                a: 1.0,
              },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
        sourcePass.end();

        effectStack.execute(commandEncoder, sourceTexture);
        device.queue.submit([commandEncoder.finish()]);

        animationRef.current = requestAnimationFrame(render);
      };

      animationRef.current = requestAnimationFrame(render);
    };

    const attemptStart = () => {
      if (!isActive) return;
      const canvas = canvasRef.current;
      if (!canvas) {
        rafId = requestAnimationFrame(attemptStart);
        return;
      }

      initialize(canvas).catch((error: unknown) => {
        if (!isActive) return;
        const message = error instanceof Error ? error.message : String(error);
        addStatus(`Error: ${message}`, 'error');
        console.error(error);
      });
    };

    attemptStart();

    return () => {
      isActive = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      effectStackRef.current?.destroy();
      screenPass?.destroy();
      context?.destroy();
      sourceTexture?.destroy();
    };
  }, [addStatus]);

  const updateEffect = (id: string | undefined, params: Record<string, number>): void => {
    if (!id || !effectStackRef.current) return;
    effectStackRef.current.updateEffect(id, params);
  };

  const handleBlurToggle = (checked: boolean): void => {
    setBlurEnabled(checked);
    const id = effectIdsRef.current.blur;
    if (!id || !effectStackRef.current) return;
    checked ? effectStackRef.current.enable(id) : effectStackRef.current.disable(id);
  };

  const handleVignetteToggle = (checked: boolean): void => {
    setVignetteEnabled(checked);
    const id = effectIdsRef.current.vignette;
    if (!id || !effectStackRef.current) return;
    checked ? effectStackRef.current.enable(id) : effectStackRef.current.disable(id);
  };

  const handleChromaToggle = (checked: boolean): void => {
    setChromaEnabled(checked);
    const id = effectIdsRef.current.chroma;
    if (!id || !effectStackRef.current) return;
    checked ? effectStackRef.current.enable(id) : effectStackRef.current.disable(id);
  };

  const setBlurOrientation = (direction: 'horizontal' | 'vertical'): void => {
    setBlurDirection(direction);
    const id = effectIdsRef.current.blur;
    updateEffect(id, { directionX: direction === 'horizontal' ? 1 : 0, directionY: direction === 'vertical' ? 1 : 0 });
  };

  const updateChromaStrength = (value: number): void => {
    setChromaStrength(value);
    updateEffect(effectIdsRef.current.chroma, { strength: value });
  };

  return (
    <DemoLayout
      title="@scene/screen Effect Stack"
      description="Interactive test for blur, vignette, and chromatic aberration effects."
      sidebar={
        <div className="flex flex-col gap-6">
          <StatusPanel items={statusItems} />
          <ControlGroup title="Blur Effect">
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={blurEnabled}
                onCheckedChange={(value) => handleBlurToggle(Boolean(value))}
              />
              <span>Enabled</span>
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">Strength</span>
              <Slider
                value={[blurStrength]}
                min={0}
                max={10}
                step={0.1}
                onValueChange={(value) => {
                  const next = value[0] ?? 0;
                  setBlurStrength(next);
                  updateEffect(effectIdsRef.current.blur, { strength: next });
                }}
              />
              <span className="text-xs text-muted-foreground">{blurStrength.toFixed(1)}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant={blurDirection === 'horizontal' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setBlurOrientation('horizontal')}
              >
                Horizontal
              </Button>
              <Button
                variant={blurDirection === 'vertical' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setBlurOrientation('vertical')}
              >
                Vertical
              </Button>
            </div>
          </ControlGroup>

          <ControlGroup title="Vignette Effect">
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={vignetteEnabled}
                onCheckedChange={(value) => handleVignetteToggle(Boolean(value))}
              />
              <span>Enabled</span>
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">Strength</span>
              <Slider
                value={[vignetteStrength]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={(value) => {
                  const next = value[0] ?? 0;
                  setVignetteStrength(next);
                  updateEffect(effectIdsRef.current.vignette, { strength: next });
                }}
              />
              <span className="text-xs text-muted-foreground">{vignetteStrength.toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">Radius</span>
              <Slider
                value={[vignetteRadius]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={(value) => {
                  const next = value[0] ?? 0;
                  setVignetteRadius(next);
                  updateEffect(effectIdsRef.current.vignette, { radius: next });
                }}
              />
              <span className="text-xs text-muted-foreground">{vignetteRadius.toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">Softness</span>
              <Slider
                value={[vignetteSoftness]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={(value) => {
                  const next = value[0] ?? 0;
                  setVignetteSoftness(next);
                  updateEffect(effectIdsRef.current.vignette, { softness: next });
                }}
              />
              <span className="text-xs text-muted-foreground">{vignetteSoftness.toFixed(2)}</span>
            </div>
          </ControlGroup>

          <ControlGroup title="Chromatic Aberration">
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={chromaEnabled}
                onCheckedChange={(value) => handleChromaToggle(Boolean(value))}
              />
              <span>Enabled</span>
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">Strength</span>
              <Slider
                value={[chromaStrength]}
                min={0}
                max={0.05}
                step={0.001}
                onValueChange={(value) => {
                  const next = value[0] ?? 0;
                  updateChromaStrength(next);
                }}
              />
              <span className="text-xs text-muted-foreground">{chromaStrength.toFixed(3)}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => updateChromaStrength(0.005)}>
                Subtle
              </Button>
              <Button size="sm" variant="ghost" onClick={() => updateChromaStrength(0.015)}>
                Moderate
              </Button>
              <Button size="sm" variant="ghost" onClick={() => updateChromaStrength(0.03)}>
                Strong
              </Button>
            </div>
          </ControlGroup>
        </div>
      }
    >
      <canvas
        ref={canvasRef}
        className="h-[360px] w-full bg-neutral-950"
        aria-label="Effect stack canvas"
      />
    </DemoLayout>
  );
}
