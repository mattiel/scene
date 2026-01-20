import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Engine, InteractionMode } from '@scene/core';
import { InputManager } from '@scene/input';
import { Surface, SurfaceRegistry, LayoutTracker } from '@scene/surfaces';
import { DemoLayout } from '../../components/DemoLayout';
import { ControlGroup } from '../../components/ControlGroup';
import { EventLog } from '../../components/EventLog';
import { Button } from '../../components/ui/button';

interface PointerState {
  position: string;
  delta: string;
  dragging: string;
  hovered: string;
}

interface InertiaState {
  active: string;
  velocity: string;
}

const SURFACES = [
  { id: 'surface-1', label: 'Surface 1', left: 40, top: 40, width: 140, height: 90 },
  { id: 'surface-2', label: 'Surface 2', left: 230, top: 110, width: 120, height: 120 },
  { id: 'surface-3', label: 'Surface 3', left: 390, top: 60, width: 150, height: 80 },
];

export const Route = createFileRoute('/demos/input')({
  component: InputDemo,
});

function InputDemo() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const draggableRef = useRef<HTMLDivElement | null>(null);
  const surfaceRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragPositionRef = useRef({ x: 260, y: 240 });
  const previousPointerRef = useRef({ x: 0, y: 0 });

  const [pointerState, setPointerState] = useState<PointerState>({
    position: '-',
    delta: '-',
    dragging: 'No',
    hovered: 'None',
  });
  const [inertiaState, setInertiaState] = useState<InertiaState>({
    active: 'No',
    velocity: '-',
  });
  const [logEntries, setLogEntries] = useState<string[]>([]);

  const appendLog = useCallback((message: string): void => {
    setLogEntries((prev) => {
      const next = [`${new Date().toLocaleTimeString()} ${message}`, ...prev];
      return next.slice(0, 50);
    });
  }, []);

  const setSurfaceRef = useCallback((id: string) => {
    return (node: HTMLDivElement | null): void => {
      surfaceRefs.current[id] = node;
    };
  }, []);

  const surfaceElements = useMemo(
    () =>
      SURFACES.map((surface) => (
        <div
          key={surface.id}
          ref={setSurfaceRef(surface.id)}
          className="absolute flex items-center justify-center bg-neutral-200 text-xs font-semibold text-neutral-900"
          style={{
            left: surface.left,
            top: surface.top,
            width: surface.width,
            height: surface.height,
          }}
        >
          {surface.label}
        </div>
      )),
    [setSurfaceRef]
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const draggable = draggableRef.current;
    if (!wrapper || !draggable) return;

    const engine = new Engine({
      mode: InteractionMode.CANVAS_INTERACTIVE,
      autoStart: false,
    });

    const registry = new SurfaceRegistry();
    const tracker = new LayoutTracker(registry);
    const input = new InputManager(engine, {
      target: wrapper,
      registry: {
        all: () => registry.regular(),
      },
      inertiaOptions: {
        friction: 0.94,      // Slightly higher friction for smoother coast
        minVelocity: 0.008,  // Very low threshold for smooth stop (8 px/s)
        maxVelocity: 1.5,    // Cap at 1500 px/s for smooth feel
        bounce: 0.3,
      },
    });

    const surfaces: Surface[] = [];
    for (const surface of SURFACES) {
      const element = surfaceRefs.current[surface.id];
      if (!element) continue;
      const surfaceInstance = new Surface(surface.id, element);
      registry.add(surfaceInstance);
      surfaces.push(surfaceInstance);
    }

    const draggableSurface = new Surface('draggable', draggable);
    draggableSurface.zIndex = 10;
    registry.add(draggableSurface);

    tracker.start();
    input.initialize(wrapper);

    const updateDragPosition = (x: number, y: number): void => {
      const maxX = wrapper.clientWidth - draggable.offsetWidth;
      const maxY = wrapper.clientHeight - draggable.offsetHeight;
      const nextX = Math.max(0, Math.min(maxX, x));
      const nextY = Math.max(0, Math.min(maxY, y));
      dragPositionRef.current = { x: nextX, y: nextY };
      draggable.style.left = `${nextX}px`;
      draggable.style.top = `${nextY}px`;
      // FIX: Force update surface rects after position change
      // ResizeObserver doesn't detect position-only changes (only size changes)
      tracker.forceUpdate();
    };

    updateDragPosition(dragPositionRef.current.x, dragPositionRef.current.y);

    const updatePointerState = (x: number, y: number): void => {
      const deltaX = x - previousPointerRef.current.x;
      const deltaY = y - previousPointerRef.current.y;
      previousPointerRef.current = { x, y };
      setPointerState((prev) => ({
        ...prev,
        position: `${x.toFixed(0)}, ${y.toFixed(0)}`,
        delta: `${deltaX.toFixed(1)}, ${deltaY.toFixed(1)}`,
      }));
    };

    const unsubMove = engine.events.on('pointer:move', ({ x, y }) => {
      updatePointerState(x, y);
    });

    const unsubDragStart = input.onIntent('dragStart', ({ surfaceId, x, y }) => {
      if (surfaceId === 'draggable') {
        dragOffsetRef.current = {
          x: x - dragPositionRef.current.x,
          y: y - dragPositionRef.current.y,
        };
        setPointerState((prev) => ({ ...prev, dragging: 'Yes' }));
        draggable.style.cursor = 'grabbing';
        appendLog('Drag start');
      }
    });

    const unsubDrag = input.onIntent('drag', ({ surfaceId, deltaX, deltaY }) => {
      if (surfaceId !== 'draggable') return;
      updateDragPosition(
        dragPositionRef.current.x + deltaX,
        dragPositionRef.current.y + deltaY
      );
    });

    const unsubDragEnd = input.onIntent('dragEnd', ({ surfaceId }) => {
      if (surfaceId === 'draggable') {
        setPointerState((prev) => ({ ...prev, dragging: 'No' }));
        draggable.style.cursor = 'grab';
        appendLog('Drag end');
      }
    });

    const unsubTap = input.onIntent('tap', ({ surfaceId, x, y }) => {
      if (surfaceId) {
        appendLog(`Tap on ${surfaceId}`);
      } else {
        appendLog(`Tap at ${x.toFixed(0)}, ${y.toFixed(0)}`);
      }
    });

    const unsubHoverEnter = input.onIntent('hoverEnter', ({ surfaceId }) => {
      const surface = registry.get(surfaceId);
      if (surface?.element) {
        surface.element.style.outline = '1px solid hsl(var(--foreground))';
        surface.element.style.outlineOffset = '2px';
      }
      setPointerState((prev) => ({ ...prev, hovered: surfaceId }));
      appendLog(`Hover enter: ${surfaceId}`);
    });

    const unsubHoverLeave = input.onIntent('hoverLeave', ({ surfaceId }) => {
      const surface = registry.get(surfaceId);
      if (surface?.element) {
        surface.element.style.outline = 'none';
      }
      setPointerState((prev) => ({ ...prev, hovered: 'None' }));
      appendLog(`Hover leave: ${surfaceId}`);
    });

    const unsubInertia = input.onIntent('inertia', (state) => {
      if (state.isActive) {
        updateDragPosition(state.x - dragOffsetRef.current.x, state.y - dragOffsetRef.current.y);
      }
      setInertiaState({
        active: state.isActive ? 'Yes' : 'No',
        velocity: state.isActive
          ? `${(state.velocityX * 1000).toFixed(0)}, ${(state.velocityY * 1000).toFixed(0)} px/s`
          : '-',
      });
    });

    appendLog('Demo initialized. Drag the box or hover surfaces.');

    return () => {
      unsubMove();
      unsubDragStart();
      unsubDrag();
      unsubDragEnd();
      unsubTap();
      unsubHoverEnter();
      unsubHoverLeave();
      unsubInertia();
      tracker.destroy();
      registry.clear();
      input.destroy();
      engine.destroy();
    };
  }, [appendLog]);

  return (
    <DemoLayout
      title="@scene/input"
      description="Pointer intents, picking, and inertia in canvas-interactive mode."
      sidebar={
        <div className="flex flex-col gap-6">
          <ControlGroup title="Pointer State">
            <div className="flex flex-col gap-1 text-sm">
              <span>Position: {pointerState.position}</span>
              <span>Delta: {pointerState.delta}</span>
              <span>Dragging: {pointerState.dragging}</span>
              <span>Hovered: {pointerState.hovered}</span>
            </div>
          </ControlGroup>
          <ControlGroup title="Inertia State">
            <div className="flex flex-col gap-1 text-sm">
              <span>Active: {inertiaState.active}</span>
              <span>Velocity: {inertiaState.velocity}</span>
            </div>
          </ControlGroup>
          <EventLog entries={logEntries} />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          ref={wrapperRef}
          className="relative h-[420px] w-full bg-neutral-100"
          aria-label="Input demo surface"
        >
          {surfaceElements}
          <div
            ref={draggableRef}
            className="absolute flex h-20 w-20 items-center justify-center bg-neutral-900 text-xs font-semibold text-white"
            style={{ left: dragPositionRef.current.x, top: dragPositionRef.current.y }}
          >
            Drag
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              dragPositionRef.current = { x: 260, y: 240 };
              const wrapper = wrapperRef.current;
              const draggable = draggableRef.current;
              if (!wrapper || !draggable) return;
              const maxX = wrapper.clientWidth - draggable.offsetWidth;
              const maxY = wrapper.clientHeight - draggable.offsetHeight;
              const nextX = Math.min(maxX, dragPositionRef.current.x);
              const nextY = Math.min(maxY, dragPositionRef.current.y);
              draggable.style.left = `${nextX}px`;
              draggable.style.top = `${nextY}px`;
              appendLog('Position reset');
            }}
          >
            Reset Position
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setLogEntries([])}>
            Clear Log
          </Button>
        </div>
      </div>
    </DemoLayout>
  );
}
