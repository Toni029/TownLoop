import { useMemo } from 'react';

export interface PortalDatesState {
  todayStr: string;
  tomorrowStr: string;
  monthNames: string[];
  formattedHeaderDate: string;
  currentMonthEdition: string;
}

export function usePortalDates(): PortalDatesState {
  const monthNames = useMemo(
    () => [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    []
  );

  const { todayStr, tomorrowStr, formattedHeaderDate, currentMonthEdition } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    const tomYear = tom.getFullYear();
    const tomMonth = String(tom.getMonth() + 1).padStart(2, '0');
    const tomDay = String(tom.getDate()).padStart(2, '0');
    const tomorrow = `${tomYear}-${tomMonth}-${tomDay}`;

    const formatted = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const monthName = monthNames[now.getMonth()];
    const edition = `${monthName} ${year}`;

    return {
      todayStr: today,
      tomorrowStr: tomorrow,
      formattedHeaderDate: formatted,
      currentMonthEdition: edition,
    };
  }, [monthNames]);

  return {
    todayStr,
    tomorrowStr,
    monthNames,
    formattedHeaderDate,
    currentMonthEdition,
  };
}
