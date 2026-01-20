import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Engine } from '@scene/core';
import { Surface, SurfaceRegistry } from '@scene/surfaces';
import type { TransitionResult } from '@scene/navigation';
import { TransitionCoordinator } from '@scene/navigation';
import { DemoLayout } from '../../../components/DemoLayout';

interface TestResult {
  id: string;
  label: string;
  pass: boolean;
  detail?: string;
}

export const Route = createFileRoute('/demos/navigation/transition-auto')({
  component: TransitionAutoDemo,
});

function TransitionAutoDemo() {
  const boxRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [results, setResults] = useState<TestResult[]>([]);

  const report = useCallback((label: string, pass: boolean, detail?: string): void => {
    setResults((prev) => [
      ...prev,
      {
        id: `${label}-${prev.length}`,
        label,
        pass,
        detail,
      },
    ]);
  }, []);

  useEffect(() => {
    const engine = new Engine({ autoStart: false });
    const registry = new SurfaceRegistry();

    const box1 = boxRefs.current['auto-1'];
    const box2 = boxRefs.current['auto-2'];
    if (box1) registry.add(new Surface('auto-1', box1));
    if (box2) registry.add(new Surface('auto-2', box2));

    const coordinator = new TransitionCoordinator(engine, {
      surfaceRegistry: registry,
      defaultTimeoutMs: 500,
    });

    const run = async (): Promise<void> => {
      try {
        const result1 = (await coordinator.transition(
          { from: '/a', to: '/b' },
          { navigate: () => {}, ready: () => Promise.resolve() }
        )) as TransitionResult;
        report('completes happy path', result1.status === 'completed', result1.status);

        const result2 = (await coordinator.transition(
          { from: '/c', to: '/d' },
          {
            navigate: () => {},
            ready: () => new Promise((resolve) => setTimeout(resolve, 1000)),
            timeoutMs: 50,
          }
        )) as TransitionResult;
        report('times out when ready is slow', result2.status === 'timeout', result2.status);

        const resultPromise = coordinator.transition(
          { from: '/e', to: '/f' },
          {
            navigate: () => {},
            ready: () => new Promise((resolve) => setTimeout(resolve, 300)),
          }
        );
        coordinator.cancel();
        const result3 = (await resultPromise) as TransitionResult;
        report('supports manual cancel', result3.status === 'cancelled', result3.status);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        report('unexpected error', false, message);
      }
    };

    run();

    return () => {
      coordinator.destroy();
      registry.clear();
      engine.destroy();
    };
  }, [report]);

  return (
    <DemoLayout
      title="@scene/navigation Automated Checks"
      description="Automated transition checks for timeout and cancellation."
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div
            ref={(node) => {
              boxRefs.current['auto-1'] = node;
            }}
            className="flex h-20 w-32 items-center justify-center bg-neutral-200 text-xs font-semibold text-neutral-900"
          >
            Box 1
          </div>
          <div
            ref={(node) => {
              boxRefs.current['auto-2'] = node;
            }}
            className="flex h-20 w-32 items-center justify-center bg-neutral-200 text-xs font-semibold text-neutral-900"
          >
            Box 2
          </div>
        </div>

        <section className="flex flex-col gap-2 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Results
          </h2>
          <div className="flex flex-col gap-2">
            {results.map((result) => (
              <div key={result.id} className="bg-neutral-100 p-3 text-xs">
                <div className="font-mono">
                  {result.pass ? 'PASS' : 'FAIL'} — {result.label}
                </div>
                {result.detail ? (
                  <div className="text-muted-foreground">{result.detail}</div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </DemoLayout>
  );
}
