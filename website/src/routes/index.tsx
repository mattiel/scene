import { createFileRoute, Link } from '@tanstack/react-router';

const demoGroups = [
  {
    title: 'Primitives',
    items: [
      {
        title: 'Motion',
        to: '/demos/motion-basic',
        description: 'Spring animations, derived values, velocity tracking, and 2D motion.',
      },
      {
        title: 'Scrollable',
        to: '/demos/scrollable-basic',
        description: '1D scroll/drag with bounds, snap points, inertia, and wheel support.',
      },
      {
        title: 'Draggable',
        to: '/demos/draggable-basic',
        description: '2D drag with bounds, axis locking, grid snapping, and inertia.',
      },
    ],
  },
  {
    title: 'Core Demo',
    items: [
      {
        title: '3D Carousel',
        to: '/demos/carousel',
        description: 'Canvas-interactive carousel with input, a11y, and transitions.',
      },
    ],
  },
  {
    title: 'Renderer',
    items: [
      {
        title: 'Quad Rendering',
        to: '/demos/renderer/quad-rendering',
        description: 'WebGPU context and quad renderer smoke test.',
      },
      {
        title: 'Effect Collision',
        to: '/demos/renderer/effect-collision',
        description: 'Rapid effect creation to verify unique names.',
      },
      {
        title: 'Multi-Effect Stack',
        to: '/demos/renderer/multi-effect-stack',
        description: 'Two-effect stack with single intermediate texture.',
      },
      {
        title: 'Memory Leak Verification',
        to: '/demos/renderer/memory-leak',
        description: 'GPU cleanup tests for failure scenarios.',
      },
    ],
  },
  {
    title: 'Screen',
    items: [
      {
        title: 'Effect Stack',
        to: '/demos/screen/effect-stack',
        description: 'Interactive blur, vignette, chromatic aberration.',
      },
      {
        title: 'Transition Effects',
        to: '/demos/screen/transition',
        description: 'Dissolve, wipe, fade-to-black, zoom transitions.',
      },
    ],
  },
  {
    title: 'Input & Surfaces',
    items: [
      {
        title: 'Input',
        to: '/demos/input',
        description: 'Pointer intents, picking, and inertia with a draggable surface.',
      },
      {
        title: 'Surfaces',
        to: '/demos/surfaces',
        description: 'Surface registry, layout tracking, and ghost surfaces.',
      },
    ],
  },
  {
    title: 'Navigation',
    items: [
      {
        title: 'Transition Demo',
        to: '/demos/navigation/transition',
        description: 'Manual transition protocol with ghost surfaces.',
      },
      {
        title: 'Transition Auto',
        to: '/demos/navigation/transition-auto',
        description: 'Automated transition checks for timeout and cancel.',
      },
    ],
  },
  {
    title: 'Accessibility',
    items: [
      {
        title: 'A11y',
        to: '/demos/a11y',
        description: 'DOM mirror, focus sync, and live announcements.',
      },
    ],
  },
];

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Scene Demos
        </p>
        <h1 className="text-3xl font-semibold">Scene Website</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          A minimal hub for all Scene demos. WebGPU-powered pages degrade gracefully
          to DOM-only output when unavailable.
        </p>
      </header>

      <section className="flex flex-col gap-10">
        {demoGroups.map((group) => (
          <div key={group.title} className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">{group.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group flex flex-col gap-2 py-2"
                >
                  <span className="text-base font-medium group-hover:underline">
                    {item.title}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {item.description}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
