import type { ReactNode } from 'react';

interface ControlGroupProps {
  title: string;
  children: ReactNode;
}

export function ControlGroup({ title, children }: ControlGroupProps) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
