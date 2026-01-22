/**
 * Basic Scrollable Demo
 * 
 * Demonstrates the Scrollable primitive with:
 * - Bounds constraints
 * - Snap points
 * - Inertia
 * - Wheel support
 */

import { createFileRoute } from '@tanstack/react-router';
import { SceneProvider, useScrollable } from '@scene/react';
import { DemoLayout } from '../../components/DemoLayout';

export const Route = createFileRoute('/demos/scrollable-basic')({
  component: ScrollableBasicDemo,
});

const ITEMS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
const ITEM_WIDTH = 200;
const GAP = 16;
const TOTAL_WIDTH = ITEMS.length * (ITEM_WIDTH + GAP) - GAP;

function ScrollableBasicDemo() {
  return (
    <SceneProvider mode="dom-interactive">
      <DemoLayout
        title="Scrollable Primitive"
        description="Drag or scroll to navigate. Items snap to center."
      >
        <ScrollableContent />
      </DemoLayout>
    </SceneProvider>
  );
}

function ScrollableContent() {
  // Snap points for each item (negative because scrolling right moves content left)
  const snapPoints = ITEMS.map((_, i) => i * (ITEM_WIDTH + GAP));
  
  const { ref, offset, isDragging, isAnimating, snapToIndex } = useScrollable<HTMLDivElement>({
    minOffset: 0,
    maxOffset: TOTAL_WIDTH - ITEM_WIDTH,
    snapPoints,
    autoSnap: true,
    direction: 'horizontal',
    friction: 0.92,
  });

  const currentIndex = Math.round(offset / (ITEM_WIDTH + GAP));

  return (
    <div className="flex flex-col gap-8 items-center">
      {/* Status */}
      <div className="flex gap-6 text-sm text-muted-foreground">
        <span>Offset: {Math.round(offset)}px</span>
        <span>Dragging: {isDragging ? 'Yes' : 'No'}</span>
        <span>Animating: {isAnimating ? 'Yes' : 'No'}</span>
        <span>Current: {ITEMS[currentIndex] ?? '-'}</span>
      </div>

      {/* Scrollable container - ref handles all events */}
      <div
        ref={ref}
        className="relative w-full max-w-[600px] h-[160px] overflow-hidden cursor-grab active:cursor-grabbing select-none"
      >
        {/* Track */}
        <div
          className="flex gap-4 absolute left-1/2 top-1/2 -translate-y-1/2"
          style={{ transform: `translateX(calc(-${ITEM_WIDTH / 2}px - ${offset}px)) translateY(-50%)` }}
        >
          {ITEMS.map((item, i) => {
            const isCenter = i === currentIndex;
            return (
              <div
                key={item}
                className={`
                  flex items-center justify-center rounded-lg transition-all duration-200
                  ${isCenter ? 'bg-primary text-primary-foreground scale-105' : 'bg-muted text-muted-foreground'}
                `}
                style={{ width: ITEM_WIDTH, height: 120 }}
              >
                <span className="text-lg font-medium">{item}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-4">
        {ITEMS.map((item, i) => (
          <button
            key={item}
            onClick={() => snapToIndex(i)}
            className={`
              px-4 py-2 rounded text-sm transition-colors
              ${i === currentIndex ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}
            `}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
