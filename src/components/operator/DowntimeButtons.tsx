'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { startDowntime, endDowntime } from '@/lib/actions/downtime';
import { useRouter } from 'next/navigation';

interface DowntimeStartButtonProps {
  stationId: string;
}

export function DowntimeStartButton({ stationId }: DowntimeStartButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleStart = () => {
    startTransition(async () => {
      await startDowntime(stationId);
      router.refresh();
    });
  };

  return (
    <Button
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
      await endDowntime(downtimeId);
      router.refresh();
    });
  };

  return (
    <Button
      size="lg"
      className="bg-green-600 px-8 hover:bg-green-700"
      onClick={handleEnd}
      disabled={isPending}
    >
      {isPending ? 'Ending...' : 'End Downtime'}
    </Button>
  );
}
