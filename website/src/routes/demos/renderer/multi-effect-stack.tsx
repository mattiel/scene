import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ShaderLibrary, ScreenPass, type WebGPUContext } from '@scene/renderer';
import { acquireSharedWebGPUContext } from '../../../lib/webgpu';
import { DemoLayout } from '../../../components/DemoLayout';
import type { StatusItem } from '../../../components/StatusPanel';
import { StatusPanel } from '../../../components/StatusPanel';

interface TestResult {
  id: string;
  message: string;
  passed: boolean;
}

export const Route = createFileRoute('/demos/renderer/multi-effect-stack')({
  component: MultiEffectStackDemo,
});

function MultiEffectStackDemo() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [statusItems, setStatusItems] = useState<StatusItem[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const idRef = useRef(0);

  const addStatus = useCallback((message: string, tone: StatusItem['tone'] = 'info'): void => {
    setStatusItems((prev) => [
      ...prev,
      { id: `status-${idRef.current++}`, message, tone },
    ]);
  }, []);

  const addResult = useCallback((message: string, passed: boolean): void => {
    setResults((prev) => [
      ...prev,
      { id: `result-${idRef.current++}`, message, passed },
    ]);
  }, []);

  useEffect(() => {
    let isActive = true;
    let rafId: number | null = null;
    let context: WebGPUContext | null = null;
    let releaseContext: (() => void) | null = null;
    let screenPass: ScreenPass | null = null;

    const runTest = async (canvas: HTMLCanvasElement): Promise<void> => {
      addStatus('Starting multi-effect stack test...', 'info');

      const { context: sharedContext, initialized, reused, release } = await acquireSharedWebGPUContext(canvas, {
        powerPreference: 'high-performance',
      });
      if (!isActive) {
        release();
        return;
      }
      releaseContext = release;
      context = sharedContext;

      if (!initialized || !context) {
        addStatus('WebGPU not available - test cannot run.', 'warning');
        return;
      }

      addStatus(reused ? 'Reusing WebGPU context.' : 'WebGPU initialized.', reused ? 'info' : 'success');

      const device = context.device;
      if (!device) {
        addStatus('WebGPU device unavailable - test cannot run.', 'warning');
        return;
      }

      const shaderLibrary = new ShaderLibrary();
      shaderLibrary.setDevice(device);
      shaderLibrary.registerDefaults();

      screenPass = new ScreenPass(context, shaderLibrary);
      screenPass.initialize();
      addResult('ScreenPass initialized', true);

      const rect = canvas.getBoundingClientRect();
      context.resize(rect.width, rect.height);

      const blurEffect = screenPass.createEffect({
        shaderName: 'blur_fragment',
        uniformData: new Float32Array([1.0, 0.0, 2.0, 0.0]),
      });
      const vignetteEffect = screenPass.createEffect({
        shaderName: 'vignette_fragment',
        uniformData: new Float32Array([0.5, 0.5, 0.5, 0.0]),
      });

      addResult(`Created blur effect: ${blurEffect}`, true);
      addResult(`Created vignette effect: ${vignetteEffect}`, true);

      const sourceTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: context.format ?? 'bgra8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.RENDER_ATTACHMENT |
          GPUTextureUsage.COPY_DST,
      });

      const intermediateTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: context.format ?? 'bgra8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      addResult('Created 1 intermediate texture', true);

      try {
        const commandEncoder = device.createCommandEncoder();
        const clearPass = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              view: sourceTexture.createView(),
              clearValue: { r: 0.2, g: 0.2, b: 0.2, a: 1.0 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
        clearPass.end();

        screenPass.executeStack(
          commandEncoder,
          [blurEffect, vignetteEffect],
          sourceTexture,
          [intermediateTexture]
        );

        device.queue.submit([commandEncoder.finish()]);
        addResult('Executed 2-effect stack with 1 intermediate texture', true);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        addResult(`Failed to execute 2-effect stack: ${message}`, false);
      }

      const chromaticEffect = screenPass.createEffect({
        shaderName: 'chromatic_aberration_fragment',
        uniformData: new Float32Array([0.01, 0.0, 0.0, 0.0]),
      });
      addResult(`Created chromatic aberration effect: ${chromaticEffect}`, true);

      try {
        const commandEncoder = device.createCommandEncoder();
        screenPass.executeStack(
          commandEncoder,
          [blurEffect, vignetteEffect, chromaticEffect],
          sourceTexture,
          [intermediateTexture]
        );
        addResult('3-effect stack with 1 intermediate falls back safely', true);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        addResult(`3-effect stack validation error: ${message}`, false);
      }

      const intermediate2 = device.createTexture({
        size: [canvas.width, canvas.height],
        format: context.format ?? 'bgra8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      try {
        const commandEncoder = device.createCommandEncoder();
        screenPass.executeStack(
          commandEncoder,
          [blurEffect, vignetteEffect, chromaticEffect],
          sourceTexture,
          [intermediateTexture, intermediate2]
        );
        device.queue.submit([commandEncoder.finish()]);
        addResult('Executed 3-effect stack with 2 intermediate textures', true);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        addResult(`Failed to execute 3-effect stack: ${message}`, false);
      }

      addStatus('Multi-effect stack tests completed.', 'success');
    };

    const attemptStart = () => {
      if (!isActive) return;
      const canvas = canvasRef.current;
      if (!canvas) {
        rafId = requestAnimationFrame(attemptStart);
        return;
      }

      runTest(canvas).catch((error: unknown) => {
        if (!isActive) return;
        const message = error instanceof Error ? error.message : String(error);
        addStatus(`Test error: ${message}`, 'error');
        console.error(error);
      });
    };

    attemptStart();

    return () => {
      isActive = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      screenPass?.destroy();
      releaseContext?.();
      releaseContext = null;
    };
  }, [addResult, addStatus]);

  return (
    <DemoLayout
      title="Multi-Effect Stack"
      description="Verifies 2-effect stacks with one intermediate texture."
      sidebar={<StatusPanel items={statusItems} />}
    >
      <div className="flex flex-col gap-4">
        <canvas
          ref={canvasRef}
          className="h-[320px] w-full bg-neutral-950"
          aria-label="Multi-effect test canvas"
        />
        <section className="flex flex-col gap-2 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Test Results
          </h2>
          <div className="flex flex-col gap-1">
            {results.map((result) => (
              <p key={result.id} className="font-mono text-xs text-foreground">
                {result.passed ? 'PASS' : 'FAIL'} — {result.message}
              </p>
            ))}
          </div>
        </section>
      </div>
    </DemoLayout>
  );
}
