// utils/timeUtils.ts
import { format, parseISO } from 'date-fns';

export class TimeUtilsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeUtilsError';
  }
}

export const timeStringToMillis = (timeString: string): number => {
  try {
    const parts = timeString.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const seconds = parseInt(parts[2], 10);
      return ((hours * 60 + minutes) * 60 + seconds) * 1000;
    }
    throw new TimeUtilsError('Invalid time string format');
  } catch (error) {
    console.error('Error converting time string to milliseconds:', error);
    throw new TimeUtilsError('Failed to convert time string to milliseconds');
  }
};

export const formatDuration = (durationMillis: number): string => {
  try {
    const hours = Math.floor(durationMillis / 3600000);
    const minutes = Math.floor((durationMillis % 3600000) / 60000);
    const seconds = Math.floor((durationMillis % 60000) / 1000);

    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  } catch (error) {
    console.error('Error formatting duration:', error);
    throw new TimeUtilsError('Failed to format duration');
  }
};

export function calculateDuration(startTime: string, endTime: string): string {
  try {
    const start = new Date(startTime);
    const end = new Date(endTime);

    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  } catch (error) {
    console.error('Error calculating duration:', error);
    throw new TimeUtilsError('Failed to calculate duration');
  }
}

export const formatMeetingTime = (dateString: string): string => {
  try {
    const parsedDate = parseISO(dateString);

    return format(parsedDate, 'h:mma');
  } catch (error) {
    console.error('Error formatting meeting time:', error);
    throw new TimeUtilsError('Failed to format meeting time');
  }
};
