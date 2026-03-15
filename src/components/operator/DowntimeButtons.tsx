'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { startDowntime, endDowntime } from '@/lib/actions/downtime';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface DowntimeStartButtonProps {
  stationId: string;
}

export function DowntimeStartButton({ stationId }: DowntimeStartButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleStart = () => {
    startTransition(async () => {
      try {
        await startDowntime(stationId);
        toast.warning('Downtime started — select a reason');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to start downtime');
      }
    });
  };

  return (
    <Button
      data-testid="downtime-start-btn"
      variant="destructive"
      size="lg"
      className="px-8"
      onClick={handleStart}
      disabled={isPending}
    >
      {isPending ? 'Starting...' : 'Start Downtime'}
    </Button>
  );
}

interface DowntimeEndButtonProps {
  downtimeId: string;
}

export function DowntimeEndButton({ downtimeId }: DowntimeEndButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleEnd = () => {
    startTransition(async () => {
      try {
        await endDowntime(downtimeId);
        toast.success('Downtime ended — station back online');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to end downtime');
      }
    });
  };

  return (
    <Button
      data-testid="downtime-end-btn"
      size="lg"
      className="bg-green-600 px-8 hover:bg-green-700"
      onClick={handleEnd}
      disabled={isPending}
    >
      {isPending ? 'Ending...' : 'End Downtime'}
    </Button>
  );
}
