import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Engine } from '@scene/core';
import { Surface, SurfaceRegistry } from '@scene/surfaces';
import type { TransitionResult } from '@scene/navigation';
import { TransitionCoordinator } from '@scene/navigation';
import { DemoLayout } from '../../../components/DemoLayout';
import { ControlGroup } from '../../../components/ControlGroup';
import { EventLog } from '../../../components/EventLog';
import { Button } from '../../../components/ui/button';

const CARD_IDS = ['card-1', 'card-2', 'card-3'];

export const Route = createFileRoute('/demos/navigation/transition')({
  component: NavigationTransitionDemo,
});

function NavigationTransitionDemo() {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const coordinatorRef = useRef<TransitionCoordinator | null>(null);
  const [status, setStatus] = useState('Idle');
  const [logEntries, setLogEntries] = useState<string[]>([]);
  const activePromiseRef = useRef<Promise<unknown> | null>(null);

  const appendLog = useCallback((message: string): void => {
    setLogEntries((prev) => [`${new Date().toLocaleTimeString()} ${message}`, ...prev].slice(0, 40));
  }, []);

  useEffect(() => {
    const engine = new Engine({ autoStart: false });
    const registry = new SurfaceRegistry();

    for (const id of CARD_IDS) {
      const element = cardRefs.current[id];
      if (!element) continue;
      registry.add(new Surface(id, element));
    }

    const coordinator = new TransitionCoordinator(engine, {
      surfaceRegistry: registry,
      defaultTimeoutMs: 5000,
    });
    coordinatorRef.current = coordinator;

    const unsubStart = engine.events.on('transition:start', ({ from, to }) => {
      setStatus(`Transitioning ${from} → ${to}`);
      appendLog(`start ${from} → ${to}`);
    });
    const unsubComplete = engine.events.on('transition:complete', ({ to }) => {
      setStatus(`Completed: ${to}`);
      appendLog(`complete → ${to}`);
    });
    const unsubError = engine.events.on('error', ({ message }) => {
      setStatus(`Error: ${message}`);
      appendLog(`error: ${message}`);
    });

    return () => {
      unsubStart();
      unsubComplete();
      unsubError();
      coordinatorRef.current = null;
      registry.clear();
      engine.destroy();
    };
  }, [appendLog]);

  const startTransition = async (options?: { timeoutMs?: number }): Promise<void> => {
    const coordinator = coordinatorRef.current;
    if (!coordinator || activePromiseRef.current) return;

    setStatus('Starting...');
    activePromiseRef.current = coordinator.transition(
      { from: '/home', to: '/product' },
      {
        navigate: () => {
          appendLog('navigate called');
        },
        ready: () =>
          new Promise((resolve) => {
            const delay = options?.timeoutMs ? Math.min(options.timeoutMs * 4, 800) : 800;
            setTimeout(() => {
              appendLog('ready resolved');
              resolve();
            }, delay);
          }),
        timeoutMs: options?.timeoutMs,
        onCancel: () => appendLog('cancelled'),
      }
    );

    const result = (await activePromiseRef.current) as TransitionResult;
    appendLog(`result: ${result.status}`);
    setStatus(`Result: ${result.status}`);
    activePromiseRef.current = null;
  };

  return (
    <DemoLayout
      title="@scene/navigation Transition Demo"
      description="Demonstrates the transition protocol with ghost surface handoff."
      sidebar={
        <div className="flex flex-col gap-6">
          <ControlGroup title="Actions">
            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={() => startTransition()}>
                Start Transition
              </Button>
              <Button size="sm" variant="ghost" onClick={() => startTransition({ timeoutMs: 200 })}>
                Start Short Timeout
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => coordinatorRef.current?.cancel()}
              >
                Cancel
              </Button>
            </div>
          </ControlGroup>
          <ControlGroup title="Status">
            <p className="text-sm">{status}</p>
          </ControlGroup>
          <EventLog entries={logEntries} />
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {CARD_IDS.map((id, index) => (
          <div
            key={id}
            ref={(node) => {
              cardRefs.current[id] = node;
            }}
            className="flex min-h-[120px] items-center justify-center bg-neutral-200 text-sm font-semibold text-neutral-900"
          >
            Card {index + 1}
          </div>
        ))}
      </div>
    </DemoLayout>
  );
}
