import { cn } from '../lib/utils';

interface EventLogProps {
  title?: string;
  entries: string[];
  className?: string;
}

export function EventLog({ title = 'Event Log', entries, className }: EventLogProps) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h2>
      <div className="max-h-64 overflow-auto bg-neutral-100 p-3 text-xs text-foreground">
        {entries.length === 0 ? (
          <p className="text-muted-foreground">No events yet.</p>
        ) : (
          entries.map((entry, index) => (
            <p key={`${entry}-${index}`} className="font-mono">
              {entry}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
