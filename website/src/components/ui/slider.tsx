import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../../lib/utils';

export type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>;

export function Slider({ className, ...props }: SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn('relative flex w-full touch-none select-none items-center', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow bg-neutral-200">
        <SliderPrimitive.Range className="absolute h-full bg-foreground" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-3 w-3 bg-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground" />
    </SliderPrimitive.Root>
  );
}
