// utils/sortUtils.ts
import { Meeting, P1Meeting } from 'types/common';

export class SortUtilsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SortUtilsError';
  }
}

export const sortData = (
  data: Meeting[],
  column: keyof Meeting | null,
  direction: 'asc' | 'desc',
): Meeting[] => {
  try {
    if (!column) return data;

    return [...data].sort((a, b) => {
      if (a[column] < b[column]) return direction === 'asc' ? -1 : 1;
      if (a[column] > b[column]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  } catch (error) {
    console.error('Error sorting data:', error);
    throw new SortUtilsError('Failed to sort data');
  }
};

export const sortP1Data = (
  data: P1Meeting[],
  column: keyof P1Meeting | null,
  direction: 'asc' | 'desc',
): P1Meeting[] => {
  try {
    if (!column) return data;

    return [...data].sort((a, b) => {
      if (a[column] < b[column]) return direction === 'asc' ? -1 : 1;
      if (a[column] > b[column]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  } catch (error) {
    console.error('Error sorting data:', error);
    throw new SortUtilsError('Failed to sort data');
  }
};
