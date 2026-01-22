import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WebGPUContext, ShaderLibrary, ScreenPass } from '@scene/renderer';
import { DemoLayout } from '../../../components/DemoLayout';
import type { StatusItem } from '../../../components/StatusPanel';
import { StatusPanel } from '../../../components/StatusPanel';

interface TestResult {
  id: string;
  message: string;
  passed: boolean;
}

export const Route = createFileRoute('/demos/renderer/effect-collision')({
  component: EffectCollisionDemo,
});

function EffectCollisionDemo() {
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
    let screenPass: ScreenPass | null = null;

    const runTest = async (canvas: HTMLCanvasElement): Promise<void> => {
      addStatus('Starting effect name collision test...', 'info');

      context = new WebGPUContext();
      const initialized = await context.initialize({
        canvas,
        powerPreference: 'high-performance',
      });

      if (!initialized) {
        addStatus('WebGPU not available - test cannot run.', 'warning');
        return;
      }

      addStatus('WebGPU initialized successfully.', 'success');

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

      const effectNames: string[] = [];
      const effectCount = 100;

      for (let i = 0; i < effectCount; i += 1) {
        const effectName = screenPass.createEffect({
          shaderName: 'blur_fragment',
          uniformData: new Float32Array([1.0, 0.0, 2.0, 0.0]),
        });
        effectNames.push(effectName);
      }

      addResult(`Created ${effectCount} effects rapidly`, true);

      const uniqueNames = new Set(effectNames);
      const allUnique = uniqueNames.size === effectNames.length;
      addResult(
        `All effect names unique: ${uniqueNames.size} unique out of ${effectNames.length}`,
        allUnique
      );

      const pattern = /^blur_fragment_\d+$/;
      const allMatchPattern = effectNames.every((name) => pattern.test(name));
      addResult(
        `All effect names match expected pattern (shader_N): ${allMatchPattern}`,
        allMatchPattern
      );

      const counters = effectNames.map((name) => parseInt(name.split('_').pop() ?? '0', 10));
      const areSequential = counters.every((counter, index) => counter === index + 1);
      addResult(`Effect counters are sequential (1-${effectCount})`, areSequential);

      addStatus('Collision test completed.', 'success');
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
      context?.destroy();
    };
  }, [addResult, addStatus]);

  return (
    <DemoLayout
      title="Effect Name Collision"
      description="Stress test for rapid effect creation and unique name generation."
      sidebar={<StatusPanel items={statusItems} />}
    >
      <div className="flex flex-col gap-4">
        <canvas
          ref={canvasRef}
          className="h-[320px] w-full bg-neutral-950"
          aria-label="Effect collision canvas"
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
