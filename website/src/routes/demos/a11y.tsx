import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Engine, InteractionMode } from '@scene/core';
import { A11yManager } from '@scene/a11y';
import { Surface, SurfaceRegistry, LayoutTracker } from '@scene/surfaces';
import { DemoLayout } from '../../components/DemoLayout';
import { ControlGroup } from '../../components/ControlGroup';
import { EventLog } from '../../components/EventLog';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';

interface SurfaceConfig {
  id: string;
  label: string;
  left: number;
  top: number;
}

const SURFACES: SurfaceConfig[] = [
  { id: 'card-1', label: 'Card 1', left: 30, top: 30 },
  { id: 'card-2', label: 'Card 2', left: 220, top: 30 },
  { id: 'card-3', label: 'Card 3', left: 410, top: 30 },
  { id: 'card-4', label: 'Card 4', left: 125, top: 180 },
  { id: 'card-5', label: 'Card 5', left: 315, top: 180 },
];

export const Route = createFileRoute('/demos/a11y')({
  component: A11yDemo,
});

function A11yDemo() {
  const surfaceRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const engineRef = useRef<Engine | null>(null);
  const a11yRef = useRef<A11yManager | null>(null);
  const [modeLabel, setModeLabel] = useState('Canvas-Interactive');
  const [mirrorsEnabled, setMirrorsEnabled] = useState('Yes');
  const [selectedSurface, setSelectedSurface] = useState('None');
  const [reducedMotion, setReducedMotion] = useState('No');
  const [liveMessage, setLiveMessage] = useState('(Screen reader announcements appear here)');
  const [logEntries, setLogEntries] = useState<string[]>([]);

  const appendLog = useCallback((message: string): void => {
    setLogEntries((prev) => [`${new Date().toLocaleTimeString()} ${message}`, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    const engine = new Engine({
      mode: InteractionMode.CANVAS_INTERACTIVE,
      autoStart: false,
    });
    engineRef.current = engine;

    const registry = new SurfaceRegistry();
    const tracker = new LayoutTracker(registry);
    tracker.start();

    for (const surface of SURFACES) {
      const element = surfaceRefs.current[surface.id];
      if (!element) continue;
      registry.add(new Surface(surface.id, element));
    }

    const a11y = new A11yManager(engine, {
      registry,
      navigationAxis: 'horizontal',
      wrapNavigation: true,
      skipGhosts: true,
    });
    a11yRef.current = a11y;

    SURFACES.forEach((surface) => {
      a11y.configure(surface.id, {
        label: surface.label,
        role: 'button',
      });
    });

    const unsubSelect = engine.events.on('a11y:select', ({ surfaceId }) => {
      if (!surfaceId) return;
      const index = SURFACES.findIndex((surface) => surface.id === surfaceId);
      const label = SURFACES[index]?.label ?? surfaceId;
      const message = `${label}, ${index + 1} of ${SURFACES.length}`;
      setSelectedSurface(surfaceId);
      setLiveMessage(message);
      appendLog(`select ${surfaceId}`);
    });

    const unsubActivate = engine.events.on('a11y:activate', ({ surfaceId }) => {
      const label = SURFACES.find((surface) => surface.id === surfaceId)?.label ?? surfaceId;
      const message = `Activated ${label}`;
      setLiveMessage(message);
      appendLog(`activate ${surfaceId}`);
    });

    const unsubMode = engine.events.on('mode:changed', ({ to }) => {
      const isCanvas = to === InteractionMode.CANVAS_INTERACTIVE;
      setModeLabel(isCanvas ? 'Canvas-Interactive' : 'DOM-Interactive');
      setMirrorsEnabled(isCanvas ? 'Yes' : 'No');
    });

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleReducedMotion = (event: MediaQueryListEvent | MediaQueryList): void => {
      setReducedMotion(event.matches ? 'Yes' : 'No');
    };
    handleReducedMotion(mediaQuery);
    mediaQuery.addEventListener('change', handleReducedMotion);

    appendLog('Demo initialized in Canvas-Interactive mode');
    setLiveMessage('Accessibility demo loaded. Use Tab to focus cards.');

    return () => {
      mediaQuery.removeEventListener('change', handleReducedMotion);
      unsubSelect();
      unsubActivate();
      unsubMode();
      tracker.destroy();
      registry.clear();
      a11y.destroy();
      engine.destroy();
    };
  }, [appendLog]);

  const setCanvasMode = (): void => {
    if (engineRef.current) {
      engineRef.current.mode = InteractionMode.CANVAS_INTERACTIVE;
    }
    a11yRef.current?.announce('Canvas mode active. Use arrow keys to navigate.');
    setLiveMessage('Canvas mode active. Use arrow keys to navigate.');
    appendLog('mode Canvas-Interactive');
  };

  const setDomMode = (): void => {
    if (engineRef.current) {
      engineRef.current.mode = InteractionMode.DOM_INTERACTIVE;
    }
    a11yRef.current?.announce('DOM mode active.');
    setLiveMessage('DOM mode active.');
    appendLog('mode DOM-Interactive');
  };

  return (
    <DemoLayout
      title="@scene/a11y"
      description="DOM mirrors, focus sync, and live announcements for canvas-interactive mode."
      sidebar={
        <div className="flex flex-col gap-6">
          <ControlGroup title="State">
            <div className="flex flex-col gap-1 text-sm">
              <span>Mode: {modeLabel}</span>
              <span>Mirrors Enabled: {mirrorsEnabled}</span>
              <span>Selected: {selectedSurface}</span>
              <span>Reduced Motion: {reducedMotion}</span>
            </div>
          </ControlGroup>
          <ControlGroup title="Live Announcements">
            <div className="bg-neutral-100 p-3 text-sm text-muted-foreground">{liveMessage}</div>
          </ControlGroup>
          <EventLog entries={logEntries} />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="relative h-[420px] w-full bg-neutral-100">
          {SURFACES.map((surface) => (
            <div
              key={surface.id}
              ref={(node) => {
                surfaceRefs.current[surface.id] = node;
              }}
              className={cn(
                'absolute flex h-[120px] w-[160px] items-center justify-center bg-neutral-200 text-xs font-semibold text-neutral-900 pointer-events-none',
                selectedSurface === surface.id ? 'outline-1 outline-foreground' : ''
              )}
              style={{ left: surface.left, top: surface.top }}
            >
              {surface.label}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={setCanvasMode}>
            Canvas Mode
          </Button>
          <Button size="sm" variant="ghost" onClick={setDomMode}>
            DOM Mode
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setLogEntries([])}>
            Clear Log
          </Button>
        </div>
        <section className="text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Keyboard Navigation</p>
          <ul className="mt-2 list-disc pl-4">
            <li>Tab / Shift+Tab — move between cards</li>
            <li>Arrow keys — navigate horizontally</li>
            <li>Enter / Space — activate selected card</li>
            <li>Home / End — jump to first or last</li>
          </ul>
        </section>
      </div>
    </DemoLayout>
  );
}
