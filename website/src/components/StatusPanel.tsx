import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export type StatusTone = 'info' | 'success' | 'warning' | 'error';

export interface StatusItem {
  id: string;
  message: string;
  tone?: StatusTone;
}

interface StatusPanelProps {
  title?: string;
  items: StatusItem[];
  footer?: ReactNode;
}

const toneStyles: Record<StatusTone, string> = {
  info: 'text-muted-foreground',
  success: 'text-foreground',
  warning: 'text-muted-foreground',
  error: 'text-foreground',
};

export function StatusPanel({ title = 'Status', items, footer }: StatusPanelProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-col gap-2 text-sm">
        {items.length === 0 ? (
          <p className="text-muted-foreground">No updates yet.</p>
        ) : (
          items.map((item) => (
            <p key={item.id} className={cn('text-sm', toneStyles[item.tone ?? 'info'])}>
              {item.message}
            </p>
          ))
        )}
      </div>
      {footer ? <div className="text-sm text-muted-foreground">{footer}</div> : null}
    </section>
  );
}
