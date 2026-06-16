// src/utils/dateUtils.ts

import { format, parseISO } from 'date-fns';
import { timeStringToMillis } from './timeUtils';

export class DateUtilsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DateUtilsError';
  }
}

export function formatTimestampStartTime(
  timestamp: string,
): { dateStr: string; timeStr: string } {
  try {
    const dt = new Date(timestamp);

    const DateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };

    const dateStr = new Intl.DateTimeFormat('en-US', DateOptions).format(dt);

    const TimeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    };

    const timeStr = new Intl.DateTimeFormat('en-US', TimeOptions)
      .format(dt)
      .replace(' GMT', ' UTC');

    return { dateStr, timeStr };
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    throw error;
  }
}

export const getMeetingStartDateUTC = (meetStartTime: string): Date => {
  try {
    const meetingStartTimeMillis = timeStringToMillis(meetStartTime);
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    const result = new Date(startDate.getTime() + meetingStartTimeMillis);

    return result;
  } catch (error) {
    console.error('Error getting meeting start date:', error);
    throw error;
  }
};

export const formatDate = (date: string): string => {
  try {
    const dateObject = new Date(date);

    return dateObject.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    throw error;
  }
};

export const formatMeetingDate = (dateString: string): string => {
  try {
    const parsedDate = parseISO(dateString);

    return format(parsedDate, 'dd.MMM.yyyy');
  } catch (error) {
    console.error('Error formatting meeting date:', error);
    throw error;
  }
};
