'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';

interface SimulationControlProps {
  className?: string;
}

export function SimulationControl({ className = '' }: SimulationControlProps) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    activeUnits: number;
    completed: number;
    total: number;
    target: number;
  } | null>(null);

  const runTick = useCallback(async () => {
    try {
      const response = await fetch('/api/simulation/tick', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setLastAction(data.detail);
        setStats(data.stats);
        router.refresh(); // Refresh server components
      }
    } catch (error) {
      console.error('Simulation tick failed:', error);
    }
  }, [router]);

  useEffect(() => {
    if (!isRunning) return;

    // Run immediately on start
    runTick();

    // Then run every 3 seconds
    const interval = setInterval(runTick, 3000);

    return () => clearInterval(interval);
  }, [isRunning, runTick]);

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Start/Stop Button */}
      <button
        onClick={() => setIsRunning(!isRunning)}
        className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-all ${
          isRunning
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-green-600 text-white hover:bg-green-700'
        }`}
      >
        {isRunning ? (
          <>
            <Icons.stopped className="h-5 w-5" />
            <span>Stop Simulation</span>
          </>
        ) : (
          <>
            <Icons.running className="h-5 w-5" />
            <span>Start Simulation</span>
          </>
        )}
      </button>

      {/* Status indicator */}
      {isRunning && (
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
          </span>
          <span className="text-sm font-medium text-green-600">SIMULATING</span>
        </div>
      )}

      {/* Last action */}
      {lastAction && (
        <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm">
          <Icons.activity className="h-4 w-4 text-gray-500" />
          <span className="text-gray-700">{lastAction}</span>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>WIP: {stats.activeUnits}</span>
          <span>Done: {stats.completed}/{stats.target}</span>
        </div>
      )}
    </div>
  );
}
