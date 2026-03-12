import { prisma } from '@/lib/db/prisma';

/**
 * Check if a given time falls within a shift's start/end times.
 * Handles overnight shifts (e.g., 22:00-06:00).
 *
 * @param time - The time to check
 * @param startTime - Shift start in "HH:MM" 24h format
 * @param endTime - Shift end in "HH:MM" 24h format
 */
export function isTimeInShift(time: Date, startTime: string, endTime: string): boolean {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const timeMinutes = time.getHours() * 60 + time.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes < endMinutes) {
    // Normal shift (e.g., 06:00-14:00)
    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  } else {
    // Overnight shift (e.g., 22:00-06:00)
    return timeMinutes >= startMinutes || timeMinutes < endMinutes;
  }
}

/**
 * Determine the current shift for a given site based on the current time.
 * Returns null if no shift matches.
 */
export async function getCurrentShift(siteId?: string) {
  const where: { active: boolean; siteId?: string } = { active: true };
  if (siteId) {
    where.siteId = siteId;
  }

  const shifts = await prisma.shift.findMany({ where });
  const now = new Date();

  for (const shift of shifts) {
    if (isTimeInShift(now, shift.startTime, shift.endTime)) {
      return shift;
    }
  }

  return null;
}
