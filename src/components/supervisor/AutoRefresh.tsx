'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';

interface AutoRefreshProps {
  intervalSeconds?: number;
  showIndicator?: boolean;
  className?: string;
}

export function AutoRefresh({
  intervalSeconds = 30,
  showIndicator = true,
  className = '',
}: AutoRefreshProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(intervalSeconds);
  const [isPaused, setIsPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setLastUpdate(new Date());
    // Use startTransition or setTimeout to avoid calling router.refresh during render
    setTimeout(() => {
      router.refresh();
      setTimeout(() => {
        setIsRefreshing(false);
        setCountdown(intervalSeconds);
      }, 500);
    }, 0);
  }, [router, intervalSeconds]);

  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Schedule refresh outside of setState to avoid update-during-render
          setTimeout(() => refresh(), 0);
          return intervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, intervalSeconds, refresh]);

  if (!showIndicator) return null;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Last update time */}
      <span className="text-xs text-gray-500">
        Last data update: {lastUpdate.toLocaleTimeString()}
      </span>

      {/* Refresh button and countdown */}
      <div className="flex items-center gap-2">
        <button
          onClick={refresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          title="Refresh now"
        >
          <Icons.refresh
            className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
          />
          {!isRefreshing && <span>{countdown}s</span>}
        </button>

        {/* Pause/Resume button */}
        <button
          onClick={() => setIsPaused(!isPaused)}
          className={`rounded-lg border p-1.5 transition-colors ${
            isPaused
              ? 'border-amber-200 bg-amber-50 text-amber-600'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          }`}
          title={isPaused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
        >
          {isPaused ? (
            <Icons.running className="h-4 w-4" />
          ) : (
            <Icons.stopped className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Live indicator */}
      {!isPaused && (
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="text-xs font-medium text-green-600">LIVE</span>
        </div>
      )}

      {isPaused && (
        <span className="text-xs font-medium text-amber-600">PAUSED</span>
      )}
    </div>
  );
}

// Hook version for programmatic refresh
export function useAutoRefresh(intervalSeconds: number = 30) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    // Defer router.refresh to avoid update-during-render issues
    setTimeout(() => {
      router.refresh();
      setTimeout(() => setIsRefreshing(false), 500);
    }, 0);
  }, [router]);

  useEffect(() => {
    const timer = setInterval(refresh, intervalSeconds * 1000);
    return () => clearInterval(timer);
  }, [intervalSeconds, refresh]);

  return { refresh, isRefreshing };
}
