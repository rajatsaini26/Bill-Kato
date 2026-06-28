import { format, parseISO } from 'date-fns';

// Store in DB always as: new Date().toISOString() → "2024-06-27T14:30:00.000Z"
export const toStorableDate = (date?: Date): string => (date || new Date()).toISOString();

// Display: "27 Jun 2024, 02:30 PM"
export const toDisplayDate = (iso: string): string =>
  format(parseISO(iso), 'dd MMM yyyy, hh:mm aa');

// Short: "27 Jun 2024"
export const toShortDate = (iso: string): string =>
  format(parseISO(iso), 'dd MMM yyyy');

// Month key: "2024-06"
export const toMonthKey = (iso: string): string =>
  format(parseISO(iso), 'yyyy-MM');
