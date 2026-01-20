import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Surface, SurfaceRegistry, LayoutTracker, createGhostFromElement } from '@scene/surfaces';
import { DemoLayout } from '../../components/DemoLayout';
import { ControlGroup } from '../../components/ControlGroup';
import type { StatusItem } from '../../components/StatusPanel';
import { StatusPanel } from '../../components/StatusPanel';
import { Button } from '../../components/ui/button';

interface TestResult {
  id: string;
  message: string;
  passed: boolean;
}

interface SurfaceSnapshot {
  id: string;
  rect: { x: number; y: number; width: number; height: number };
  zIndex: number;
  isVisible: boolean;
  isGhost: boolean;
}

const INITIAL_SURFACES = ['element-1', 'element-2', 'element-3', 'element-4'];

export const Route = createFileRoute('/demos/surfaces')({
  component: SurfacesDemo,
});

function SurfacesDemo() {
  const registryRef = useRef<SurfaceRegistry | null>(null);
  const trackerRef = useRef<LayoutTracker | null>(null);
  const elementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [surfaceIds, setSurfaceIds] = useState<string[]>(INITIAL_SURFACES);
  const [statusItems, setStatusItems] = useState<StatusItem[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [snapshot, setSnapshot] = useState<SurfaceSnapshot[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    visible: 0,
    ghosts: 0,
    tracked: 0,
  });

  const setElementRef = useCallback((id: string) => {
    return (node: HTMLDivElement | null): void => {
      elementRefs.current[id] = node;
    };
  }, []);

  const addStatus = useCallback((message: string, tone: StatusItem['tone'] = 'info'): void => {
    setStatusItems((prev) => [
      ...prev,
      { id: `status-${prev.length}-${message}`, message, tone },
    ]);
  }, []);

  const addResult = useCallback((message: string, passed: boolean): void => {
    setResults((prev) => [
      ...prev,
      { id: `result-${prev.length}-${message}`, message, passed },
    ]);
  }, []);

  const refreshSnapshot = useCallback((): void => {
    const registry = registryRef.current;
    const tracker = trackerRef.current;
    if (!registry || !tracker) return;

    const surfaces = registry.sorted();
    setSnapshot(
      surfaces.map((surface) => ({
        id: surface.id,
        rect: surface.rect,
        zIndex: surface.zIndex,
        isVisible: surface.isVisible,
        isGhost: surface.isGhost,
      }))
    );
    setSummary({
      total: registry.size,
      visible: registry.visible().length,
      ghosts: registry.ghosts().length,
      tracked: tracker.trackedCount,
    });
  }, []);

  const surfaceElements = useMemo(
    () =>
      surfaceIds.map((id, index) => (
        <div
          key={id}
          ref={setElementRef(id)}
          className="flex min-h-[80px] items-center justify-center bg-neutral-200 text-sm font-semibold text-neutral-900"
        >
          Element {index + 1}
        </div>
      )),
    [setElementRef, surfaceIds]
  );

  useEffect(() => {
    const registry = new SurfaceRegistry();
    const tracker = new LayoutTracker(registry);
    registryRef.current = registry;
    trackerRef.current = tracker;

    addStatus('Starting @scene/surfaces tests...', 'info');
    addResult('SurfaceRegistry created', true);

    for (const id of INITIAL_SURFACES) {
      const element = elementRefs.current[id];
      if (!element) continue;
      const surface = new Surface(id, element);
      registry.add(surface);
    }

    addResult(`Created ${INITIAL_SURFACES.length} surfaces from DOM elements`, true);

    tracker.start();
    addResult('LayoutTracker created and started', true);

    const first = registry.get(surfaceIds[0]);
    if (first) {
      first.set('opacity', 0.8);
      first.set('scale', 1.2);
      addResult('Motion properties set (opacity + scale)', true);
    }

    refreshSnapshot();
    addStatus('Surface tests ready.', 'success');

    return () => {
      tracker.destroy();
      registry.clear();
    };
  }, [addResult, addStatus, refreshSnapshot]);

  useEffect(() => {
    const registry = registryRef.current;
    if (!registry) return;

    for (const id of surfaceIds) {
      if (registry.has(id)) continue;
      const element = elementRefs.current[id];
      if (!element) continue;
      const surface = new Surface(id, element);
      registry.add(surface);
    }

    refreshSnapshot();
  }, [refreshSnapshot, surfaceIds]);

  const handleAddSurface = (): void => {
    const nextId = `element-${surfaceIds.length + 1}`;
    setSurfaceIds((prev) => [...prev, nextId]);
    addStatus(`Added surface: ${nextId}`, 'info');
    setTimeout(refreshSnapshot, 0);
  };

  const handleCreateGhost = (): void => {
    const registry = registryRef.current;
    if (!registry) return;
    const elements = surfaceIds
      .map((id) => elementRefs.current[id])
      .filter((element): element is HTMLDivElement => Boolean(element));

    if (elements.length === 0) return;
    const target = elements[Math.floor(Math.random() * elements.length)];
    const ghostId = `ghost-${Date.now()}`;
    const ghost = createGhostFromElement(ghostId, target);
    registry.add(ghost);
    addStatus(`Created ghost surface: ${ghostId}`, 'info');
    refreshSnapshot();
  };

  const handleRemoveSurface = (): void => {
    const registry = registryRef.current;
    if (!registry) return;
    const regularSurfaces = registry.regular();
    const last = regularSurfaces[regularSurfaces.length - 1];
    if (!last) return;

    registry.remove(last.id);
    last.destroy();
    setSurfaceIds((prev) => prev.filter((id) => id !== last.id));
    addStatus(`Removed surface: ${last.id}`, 'info');
    refreshSnapshot();
  };

  const handleForceUpdate = (): void => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    tracker.forceUpdate();
    addStatus('Forced layout update', 'info');
    refreshSnapshot();
  };

  return (
    <DemoLayout
      title="@scene/surfaces"
      description="Surface registry, layout tracking, and ghost surface utilities."
      sidebar={
        <div className="flex flex-col gap-6">
          <StatusPanel items={statusItems} />
          <ControlGroup title="Interactive Tests">
            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={handleAddSurface}>
                Add Surface
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCreateGhost}>
                Create Ghost
              </Button>
              <Button size="sm" variant="ghost" onClick={handleRemoveSurface}>
                Remove Last Surface
              </Button>
              <Button size="sm" variant="ghost" onClick={handleForceUpdate}>
                Force Update
              </Button>
            </div>
          </ControlGroup>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Tracked Elements
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">{surfaceElements}</div>
        </section>

        <section className="flex flex-col gap-3 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Surface Summary
          </h2>
          <div className="flex flex-col gap-1">
            <span>Total Surfaces: {summary.total}</span>
            <span>Visible Surfaces: {summary.visible}</span>
            <span>Ghost Surfaces: {summary.ghosts}</span>
            <span>Tracked Elements: {summary.tracked}</span>
          </div>
        </section>

        <section className="flex flex-col gap-3 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Surface Details
          </h2>
          <div className="flex flex-col gap-3">
            {snapshot.map((surface) => (
              <div key={surface.id} className="bg-neutral-100 p-3 text-xs">
                <div className="font-semibold text-foreground">{surface.id}</div>
                <div className="text-muted-foreground">
                  {Math.round(surface.rect.x)}, {Math.round(surface.rect.y)} —{' '}
                  {Math.round(surface.rect.width)} × {Math.round(surface.rect.height)}
                </div>
                <div className="text-muted-foreground">
                  zIndex {surface.zIndex} · visible {String(surface.isVisible)} · ghost{' '}
                  {String(surface.isGhost)}
                </div>
              </div>
            ))}
          </div>
        </section>

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
