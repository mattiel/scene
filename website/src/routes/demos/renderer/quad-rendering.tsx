import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WebGPUContext, ShaderLibrary, QuadRenderer, ScreenPass } from '@scene/renderer';
import { DemoLayout } from '../../../components/DemoLayout';
import type { StatusItem } from '../../../components/StatusPanel';
import { StatusPanel } from '../../../components/StatusPanel';

interface TestResult {
  id: string;
  message: string;
  passed: boolean;
}

export const Route = createFileRoute('/demos/renderer/quad-rendering')({
  component: QuadRenderingDemo,
});

function QuadRenderingDemo() {
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
    let quadRenderer: QuadRenderer | null = null;
    let screenPass: ScreenPass | null = null;

    const runTests = async (canvas: HTMLCanvasElement): Promise<void> => {
      addStatus('Starting @scene/renderer tests...', 'info');

      const isAvailable = await WebGPUContext.checkAvailability();
      addResult(
        `WebGPU availability check: ${isAvailable ? 'Available' : 'Not Available'}`,
        true
      );

      context = new WebGPUContext();
      const initialized = await context.initialize({
        canvas,
        powerPreference: 'high-performance',
      });

      if (!initialized) {
        addStatus('WebGPU unavailable - running in DOM-only mode.', 'warning');
        addResult('WebGPUContext gracefully degraded', true);
        return;
      }

      addStatus('WebGPU initialized successfully.', 'success');
      addResult('WebGPUContext initialized', true);
      addResult(`Canvas format: ${context.format ?? 'unknown'}`, true);
      const device = context.device;
      addResult(`Device available: ${device !== null}`, device !== null);
      if (!device) {
        addStatus('WebGPU device unavailable.', 'warning');
        return;
      }

      const shaderLibrary = new ShaderLibrary();
      shaderLibrary.setDevice(device);
      shaderLibrary.registerDefaults();
      addResult('ShaderLibrary initialized', true);

      quadRenderer = new QuadRenderer(context, shaderLibrary);
      const quadInit = quadRenderer.initialize();
      addResult('QuadRenderer initialized', quadInit);
      addResult(`QuadRenderer ready: ${quadRenderer.isInitialized}`, quadRenderer.isInitialized);

      screenPass = new ScreenPass(context, shaderLibrary);
      const screenInit = screenPass.initialize();
      addResult('ScreenPass initialized', screenInit);
      addResult(`ScreenPass ready: ${screenPass.isInitialized}`, screenPass.isInitialized);

      try {
        const copyEffect = screenPass.createEffect({ shaderName: 'copy_fragment' });
        addResult(`Created copy effect: ${copyEffect}`, true);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        addResult(`Failed to create effect: ${message}`, false);
      }

      const rect = canvas.getBoundingClientRect();
      context.resize(rect.width, rect.height);
      addResult(
        `Canvas resized to ${Math.round(rect.width)}x${Math.round(rect.height)}`,
        true
      );

      try {
        const commandEncoder = device.createCommandEncoder();
        const textureView = context.context?.getCurrentTexture().createView();
        if (!textureView) {
          throw new Error('Unable to access current texture');
        }

        const renderPass = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              view: textureView,
              clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
        addResult('Rendered test frame with neutral clear color', true);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        addResult(`Failed to render frame: ${message}`, false);
      }

      addStatus('Renderer tests completed.', 'success');

      setTimeout(() => {
        if (!isActive) return;
        addStatus('Cleaning up resources...', 'info');
        quadRenderer?.destroy();
        screenPass?.destroy();
        context?.destroy();
        addResult('Resources cleaned up', true);
      }, 1000);
    };

    const attemptStart = () => {
      if (!isActive) return;
      const canvas = canvasRef.current;
      if (!canvas) {
        rafId = requestAnimationFrame(attemptStart);
        return;
      }

      runTests(canvas).catch((error: unknown) => {
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
      quadRenderer?.destroy();
      screenPass?.destroy();
      context?.destroy();
    };
  }, [addResult, addStatus]);

  return (
    <DemoLayout
      title="@scene/renderer Quad Rendering"
      description="WebGPU context initialization and renderer sanity checks."
      sidebar={<StatusPanel items={statusItems} />}
    >
      <div className="flex flex-col gap-4">
        <canvas
          ref={canvasRef}
          className="h-[360px] w-full bg-neutral-950"
          aria-label="WebGPU test canvas"
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
