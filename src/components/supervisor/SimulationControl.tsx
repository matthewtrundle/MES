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
  const [speed, setSpeed] = useState<1 | 2 | 5>(1);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [downtimeMessage, setDowntimeMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    activeUnits: number;
    completed: number;
    total: number;
    target: number;
  } | null>(null);
  const [workOrder, setWorkOrder] = useState<{
    orderNumber: string;
    productCode: string;
    qtyCompleted: number;
    qtyOrdered: number;
  } | null>(null);

  const runTick = useCallback(async () => {
    try {
      const response = await fetch(`/api/simulation/tick?speed=${speed}`, { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setLastAction(data.detail);
        setStats(data.stats);
        if (data.workOrder) {
          setWorkOrder(data.workOrder);
        }
        router.refresh(); // Refresh server components
      }
    } catch (error) {
      console.error('Simulation tick failed:', error);
    }
  }, [router, speed]);

  const triggerDowntime = async () => {
    try {
      const response = await fetch('/api/simulation/downtime', { method: 'POST' });
      const data = await response.json();
      setDowntimeMessage(data.message);
      router.refresh();
      // Clear message after 3 seconds
      setTimeout(() => setDowntimeMessage(null), 3000);
    } catch (error) {
      console.error('Failed to trigger downtime:', error);
    }
  };

  const clearAllDowntime = async () => {
    try {
      const response = await fetch('/api/simulation/downtime', { method: 'DELETE' });
      const data = await response.json();
      setDowntimeMessage(data.message);
      router.refresh();
      setTimeout(() => setDowntimeMessage(null), 3000);
    } catch (error) {
      console.error('Failed to clear downtime:', error);
    }
  };

  useEffect(() => {
    if (!isRunning) return;

    // Run immediately on start
    runTick();

    // Interval based on speed: 1x=3s, 2x=1.5s, 5x=600ms
    const intervalMs = Math.round(3000 / speed);
    const interval = setInterval(runTick, intervalMs);

    return () => clearInterval(interval);
  }, [isRunning, runTick, speed]);

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

      {/* Speed Controls */}
      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
        {([1, 2, 5] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              speed === s
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Status indicator */}
      {isRunning && (
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
          </span>
          <span className="text-sm font-medium text-green-600">
            {speed}x SPEED
          </span>
        </div>
      )}

      {/* Work Order Progress */}
      {workOrder && (
        <div className="flex items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5">
          <div className="text-sm">
            <span className="font-semibold text-blue-800">{workOrder.orderNumber}</span>
            <span className="text-blue-600 ml-2">{workOrder.productCode}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-blue-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${Math.round((workOrder.qtyCompleted / workOrder.qtyOrdered) * 100)}%` }}
              />
            </div>
            <span className="text-sm font-mono font-medium text-blue-800">
              {workOrder.qtyCompleted}/{workOrder.qtyOrdered}
            </span>
            <span className="text-xs text-blue-600">
              ({Math.round((workOrder.qtyCompleted / workOrder.qtyOrdered) * 100)}%)
            </span>
          </div>
        </div>
      )}

      {/* Last action */}
      {lastAction && (
        <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm">
          <Icons.activity className="h-4 w-4 text-gray-500" />
          <span className="text-gray-700 max-w-48 truncate">{lastAction}</span>
        </div>
      )}

      {/* Separator */}
      <div className="h-6 w-px bg-gray-300" />

      {/* Downtime Controls */}
      <button
        onClick={triggerDowntime}
        className="flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
      >
        <Icons.warning className="h-4 w-4" />
        <span>Trigger Downtime</span>
      </button>

      <button
        onClick={clearAllDowntime}
        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Icons.pass className="h-4 w-4" />
        <span>Clear Downtime</span>
      </button>

      {/* Downtime message */}
      {downtimeMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-1.5 text-sm text-amber-800">
          <Icons.warning className="h-4 w-4" />
          <span>{downtimeMessage}</span>
        </div>
      )}
    </div>
  );
}
