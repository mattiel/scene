import type { ReactNode } from 'react';

interface DemoLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  sidebar?: ReactNode;
}

export function DemoLayout({
  title,
  description,
  children,
  sidebar,
}: DemoLayoutProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Scene Demo
        </p>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>

      <div className={sidebar ? 'grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]' : 'flex'}>
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
        {sidebar ? <aside className="flex flex-col gap-6">{sidebar}</aside> : null}
      </div>
    </main>
  );
}
