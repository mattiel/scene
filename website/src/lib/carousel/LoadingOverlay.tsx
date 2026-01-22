/**
 * Loading overlay with animated progress bar
 */

import { useState, useEffect } from 'react';

export interface LoadingOverlayProps {
  progress: number;
  message: string;
}

export function LoadingOverlay({ progress, message }: LoadingOverlayProps) {
  const [displayMessage, setDisplayMessage] = useState(message);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Animate message transitions
  useEffect(() => {
    if (message !== displayMessage) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setDisplayMessage(message);
        setIsTransitioning(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [message, displayMessage]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      style={{
        opacity: progress >= 100 ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: progress >= 100 ? 'none' : 'auto',
      }}
    >
      <div className="flex flex-col items-center gap-1 px-8">
        {/* Progress bar */}
        <div className="w-48 sm:w-64">
          <div className="h-[2px] w-full bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-neutral-400 rounded-full"
              style={{
                width: `${progress}%`,
                transition: 'width 0.3s ease-out',
              }}
            />
          </div>
        </div>

        {/* Status message */}
        <div className="h-5 flex items-center justify-center">
          <span
            className="text-xs text-neutral-500 font-light tracking-wide"
            style={{
              opacity: isTransitioning ? 0 : 1,
              transform: isTransitioning ? 'translateY(4px)' : 'translateY(0)',
              transition: 'opacity 0.15s ease, transform 0.15s ease',
            }}
          >
            {displayMessage}
          </span>

          {/* Percentage */}
          <span className="ml-1 text-xs text-neutral-600 tabular-nums">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    </div>
  );
}
