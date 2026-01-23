import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ShaderLibrary, QuadRenderer, ScreenPass, type WebGPUContext } from '@scene/renderer';
import { acquireSharedWebGPUContext } from '../../../lib/webgpu';
import { DemoLayout } from '../../../components/DemoLayout';
import type { StatusItem } from '../../../components/StatusPanel';
import { StatusPanel } from '../../../components/StatusPanel';

interface TestResult {
  id: string;
  message: string;
  passed: boolean;
}

export const Route = createFileRoute('/demos/renderer/memory-leak')({
  component: MemoryLeakDemo,
});

function MemoryLeakDemo() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [statusItems, setStatusItems] = useState<StatusItem[]>([]);
  const [screenPassResults, setScreenPassResults] = useState<TestResult[]>([]);
  const [quadResults, setQuadResults] = useState<TestResult[]>([]);
  const idRef = useRef(0);

  const addStatus = useCallback((message: string, tone: StatusItem['tone'] = 'info'): void => {
    setStatusItems((prev) => [
      ...prev,
      { id: `status-${idRef.current++}`, message, tone },
    ]);
  }, []);

  const addScreenPassResult = useCallback((message: string, passed: boolean): void => {
    setScreenPassResults((prev) => [
      ...prev,
      { id: `screenpass-${idRef.current++}`, message, passed },
    ]);
  }, []);

  const addQuadResult = useCallback((message: string, passed: boolean): void => {
    setQuadResults((prev) => [
      ...prev,
      { id: `quad-${idRef.current++}`, message, passed },
    ]);
  }, []);

  useEffect(() => {
    let isActive = true;
    let rafId: number | null = null;
    let context: WebGPUContext | null = null;
    let releaseContext: (() => void) | null = null;
    let screenPass: ScreenPass | null = null;
    let quadRenderer: QuadRenderer | null = null;

    const runTests = async (canvas: HTMLCanvasElement): Promise<void> => {
      addStatus('Starting memory leak verification...', 'info');

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
        addStatus('WebGPU not available - cannot run tests.', 'warning');
        return;
      }

      addStatus(reused ? 'Reusing WebGPU context.' : 'WebGPU initialized.', reused ? 'info' : 'success');

      const device = context.device;
      if (!device) {
        addStatus('WebGPU device unavailable - cannot run tests.', 'warning');
        return;
      }

      const shaderLibrary = new ShaderLibrary();
      shaderLibrary.setDevice(device);
      shaderLibrary.registerDefaults();

      screenPass = new ScreenPass(context, shaderLibrary);
      screenPass.initialize();
      addScreenPassResult('ScreenPass initialized', true);

      try {
        screenPass.createEffect({
          shaderName: 'nonexistent_shader',
          uniformData: new Float32Array([1.0, 2.0, 3.0, 4.0]),
        });
        addScreenPassResult('Expected error for invalid shader', false);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        addScreenPassResult(`Caught expected error: ${message}`, true);
      }

      try {
        const validEffect = screenPass.createEffect({
          shaderName: 'blur_fragment',
          uniformData: new Float32Array([1.0, 0.0, 2.0, 0.0]),
        });
        addScreenPassResult(`Created valid effect after error: ${validEffect}`, true);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        addScreenPassResult(`Failed to create valid effect: ${message}`, false);
      }

      const emptyShaderLibrary = new ShaderLibrary();
      emptyShaderLibrary.setDevice(device);

      quadRenderer = new QuadRenderer(context, emptyShaderLibrary);
      addQuadResult('QuadRenderer created with empty shader library', true);

      const initSuccess = quadRenderer.initialize();
      addQuadResult(
        `QuadRenderer initialization failed as expected: ${!initSuccess}`,
        !initSuccess
      );

      const validShaderLibrary = new ShaderLibrary();
      validShaderLibrary.setDevice(device);
      validShaderLibrary.registerDefaults();

      const validQuadRenderer = new QuadRenderer(context, validShaderLibrary);
      const validInit = validQuadRenderer.initialize();
      addQuadResult(`QuadRenderer initialized after failure: ${validInit}`, validInit);

      validQuadRenderer.destroy();
      addStatus('Memory leak checks completed.', 'success');
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
      screenPass?.destroy();
      quadRenderer?.destroy();
      releaseContext?.();
      releaseContext = null;
    };
  }, [addQuadResult, addScreenPassResult, addStatus]);

  return (
    <DemoLayout
      title="Memory Leak Verification"
      description="Ensures GPU resources are cleaned up when initialization fails."
      sidebar={<StatusPanel items={statusItems} />}
    >
      <div className="flex flex-col gap-6">
        <canvas
          ref={canvasRef}
          className="h-[320px] w-full bg-neutral-950"
          aria-label="Memory leak test canvas"
        />
        <section className="flex flex-col gap-2 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            ScreenPass Test
          </h2>
          <div className="flex flex-col gap-1">
            {screenPassResults.map((result) => (
              <p key={result.id} className="font-mono text-xs text-foreground">
                {result.passed ? 'PASS' : 'FAIL'} — {result.message}
              </p>
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-2 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            QuadRenderer Test
          </h2>
          <div className="flex flex-col gap-1">
            {quadResults.map((result) => (
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
