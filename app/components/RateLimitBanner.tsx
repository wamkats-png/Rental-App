'use client';

import { useEffect, useState } from 'react';

interface RateLimitBannerProps {
  /** Milliseconds until the rate limit window resets (from the API's retryAfterMs field) */
  retryAfterMs: number;
  /** Called when the countdown reaches zero — use to re-enable the submit button */
  onReady: () => void;
}

/**
 * Shows a countdown banner when an AI or payments API returns 429.
 *
 * Usage:
 *   const [rateLimitMs, setRateLimitMs] = useState(0);
 *
 *   // In your fetch error handler:
 *   if (res.status === 429) {
 *     const { retryAfterMs } = await res.json();
 *     setRateLimitMs(retryAfterMs);
 *   }
 *
 *   // In JSX:
 *   {rateLimitMs > 0 && (
 *     <RateLimitBanner retryAfterMs={rateLimitMs} onReady={() => setRateLimitMs(0)} />
 *   )}
 */
export function RateLimitBanner({ retryAfterMs, onReady }: RateLimitBannerProps) {
  const [seconds, setSeconds] = useState(Math.ceil(retryAfterMs / 1000));

  // Reset if a new retryAfterMs is passed in (e.g. user triggered another request)
  useEffect(() => {
    setSeconds(Math.ceil(retryAfterMs / 1000));
  }, [retryAfterMs]);

  useEffect(() => {
    if (seconds <= 0) {
      onReady();
      return;
    }
    const timer = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onReady();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [seconds, onReady]);

  if (seconds <= 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-700/50 bg-amber-950/60 px-3 py-2 text-sm text-amber-300">
      <span className="text-base">⏳</span>
      <span>
        Too many requests — you can try again in{' '}
        <span className="font-semibold tabular-nums">{seconds}s</span>
      </span>
    </div>
  );
}
