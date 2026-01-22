/**
 * Basic Motion Demo
 * 
 * Demonstrates SceneValue and motion primitives:
 * - Spring animations with different presets
 * - Derived values (derive, interpolate)
 * - Velocity tracking
 */

import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { SceneProvider, useMotion, useMotion2D, springs } from '@scene/react';
import { DemoLayout } from '../../components/DemoLayout';

export const Route = createFileRoute('/demos/motion-basic')({
  component: MotionBasicDemo,
});

const SPRING_PRESETS = ['snappy', 'smooth', 'bouncy', 'stiff', 'wobbly', 'rubber'] as const;
type SpringPreset = (typeof SPRING_PRESETS)[number];

function MotionBasicDemo() {
  return (
    <SceneProvider mode="dom-interactive">
      <DemoLayout
        title="Motion Primitives"
        description="Spring animations, derived values, and presets."
      >
        <div className="flex flex-col gap-12">
          <SpringDemo />
          <DerivedDemo />
          <Motion2DDemo />
        </div>
      </DemoLayout>
    </SceneProvider>
  );
}

function SpringDemo() {
  const [preset, setPreset] = useState<SpringPreset>('snappy');
  const { value, animateTo, isAnimating } = useMotion(0);

  const toggle = () => {
    animateTo(value < 150 ? 300 : 0, springs[preset]);
  };

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-lg font-medium">Spring Presets</h3>
      
      {/* Animated bar */}
      <div className="relative h-12 bg-muted rounded-lg overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-primary rounded-lg transition-none"
          style={{ width: value }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-sm font-medium mix-blend-difference text-white">
          {Math.round(value)}px {isAnimating && '(animating)'}
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={toggle}
          className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm hover:bg-primary/90"
        >
          Toggle
        </button>
        
        <div className="flex gap-1 ml-4">
          {SPRING_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`
                px-3 py-1 rounded text-xs transition-colors
                ${preset === p ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}
              `}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function DerivedDemo() {
  const { value, animateTo } = useMotion(0);
  
  // Derived values
  const doubled = value * 2;
  const progress = Math.min(value / 300, 1);
  const opacity = 1 - progress * 0.7;
  const rotation = progress * 360;

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-lg font-medium">Derived Values</h3>
      <p className="text-sm text-muted-foreground">
        Multiple properties derived from a single animated value.
      </p>

      <div className="flex gap-8 items-center">
        {/* Input slider */}
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max="300"
            value={value}
            onChange={(e) => animateTo(Number(e.target.value), springs.stiff)}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Base: {Math.round(value)}</span>
            <span>Doubled: {Math.round(doubled)}</span>
            <span>Progress: {(progress * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Animated box */}
        <div
          className="w-20 h-20 bg-primary rounded-lg flex items-center justify-center text-primary-foreground text-sm font-medium"
          style={{
            opacity,
            transform: `rotate(${rotation}deg) scale(${0.5 + progress * 0.5})`,
          }}
        >
          {Math.round(rotation)}°
        </div>
      </div>
    </section>
  );
}

function Motion2DDemo() {
  const { x, y, animateTo, set } = useMotion2D(100, 100);
  const [trail, setTrail] = useState<Array<{ x: number; y: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const targetX = e.clientX - rect.left;
    const targetY = e.clientY - rect.top;
    
    // Add to trail
    setTrail((t) => [...t.slice(-10), { x: targetX, y: targetY }]);
    
    animateTo(targetX, targetY, springs.bouncy);
  };

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-lg font-medium">2D Motion</h3>
      <p className="text-sm text-muted-foreground">
        Click anywhere to animate the circle to that position.
      </p>

      <div
        className="relative h-[200px] bg-muted/30 border border-border rounded-lg cursor-crosshair"
        onClick={handleClick}
      >
        {/* Trail dots */}
        {trail.map((point, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-primary/30 rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{ left: point.x, top: point.y }}
          />
        ))}

        {/* Animated circle */}
        <div
          className="absolute w-8 h-8 bg-primary rounded-full -translate-x-1/2 -translate-y-1/2 shadow-lg"
          style={{ left: x, top: y }}
        />

        {/* Position label */}
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
          ({Math.round(x)}, {Math.round(y)})
        </div>
      </div>

      <button
        onClick={() => {
          set(100, 100);
          setTrail([]);
        }}
        className="self-start px-3 py-1 rounded text-sm bg-muted hover:bg-muted/80"
      >
        Reset
      </button>
    </section>
  );
}
