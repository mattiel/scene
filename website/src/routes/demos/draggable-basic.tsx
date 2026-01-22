/**
 * Basic Draggable Demo
 * 
 * Demonstrates the Draggable primitive with:
 * - Bounds constraints
 * - Axis locking
 * - Grid snapping
 * - Inertia
 */

import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { SceneProvider, useDraggable } from '@scene/react';
import { DemoLayout } from '../../components/DemoLayout';

export const Route = createFileRoute('/demos/draggable-basic')({
  component: DraggableBasicDemo,
});

const BOUNDS = { minX: 0, maxX: 1280, minY: 0, maxY: 640 };
const BOX_SIZE = 80;

function DraggableBasicDemo() {
  return (
    <SceneProvider mode="dom-interactive">
      <DemoLayout
        title="Draggable Primitive"
        description="Drag the box around. Try different axis and grid settings."
      >
        <DraggableContent />
      </DemoLayout>
    </SceneProvider>
  );
}

function DraggableContent() {
  const [axis, setAxis] = useState<'both' | 'x' | 'y'>('both');
  const [useGrid, setUseGrid] = useState(false);

  const { ref, x, y, isDragging, isAnimating, setPosition, setBounds } = useDraggable<HTMLDivElement>({
    initialPosition: { x: 160, y: 85 },
    bounds: {
      minX: BOUNDS.minX,
      maxX: BOUNDS.maxX - BOX_SIZE,
      minY: BOUNDS.minY,
      maxY: BOUNDS.maxY - BOX_SIZE,
    },
    axis,
    grid: useGrid ? { x: 40, y: 40 } : undefined,
    enableInertia: true,
    friction: 0.92,
  });

  return (
    <div className="flex flex-col gap-8 items-center">
      {/* Status */}
      <div className="flex gap-6 text-sm text-muted-foreground">
        <span>X: {Math.round(x)}</span>
        <span>Y: {Math.round(y)}</span>
        <span>Dragging: {isDragging ? 'Yes' : 'No'}</span>
        <span>Animating: {isAnimating ? 'Yes' : 'No'}</span>
      </div>

      {/* Drag area */}
      <div
        className="relative bg-muted/30 border border-border rounded-lg"
        style={{ width: BOUNDS.maxX, height: BOUNDS.maxY }}
      >
        {/* Grid overlay */}
        {useGrid && (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: Math.floor(BOUNDS.maxX / 40) + 1 }).map((_, i) => (
              <div
                key={`v-${i}`}
                className="absolute top-0 bottom-0 w-px bg-border/50"
                style={{ left: i * 40 }}
              />
            ))}
            {Array.from({ length: Math.floor(BOUNDS.maxY / 40) + 1 }).map((_, i) => (
              <div
                key={`h-${i}`}
                className="absolute left-0 right-0 h-px bg-border/50"
                style={{ top: i * 40 }}
              />
            ))}
          </div>
        )}

        {/* Draggable box - ref handles all events */}
        <div
          ref={ref}
          className={`
            absolute rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing
            transition-shadow select-none
            ${isDragging ? 'bg-primary shadow-lg' : 'bg-primary/80'}
          `}
          style={{
            width: BOX_SIZE,
            height: BOX_SIZE,
            transform: `translate(${x}px, ${y}px)`,
          }}
        >
          <span className="text-primary-foreground text-sm font-medium">Drag</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-6 items-center">
        {/* Axis selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Axis:</span>
          {(['both', 'x', 'y'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAxis(a)}
              className={`
                px-3 py-1 rounded text-sm transition-colors
                ${axis === a ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}
              `}
            >
              {a === 'both' ? 'Both' : a.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Grid toggle */}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={useGrid}
            onChange={(e) => setUseGrid(e.target.checked)}
            className="rounded"
          />
          <span>Grid snap (40px)</span>
        </label>

        {/* Reset */}
        <button
          onClick={() => setPosition(160, 85)}
          className="px-3 py-1 rounded text-sm bg-muted hover:bg-muted/80"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
