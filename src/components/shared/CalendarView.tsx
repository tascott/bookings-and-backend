'use client';

import React from 'react';
import { Calendar, dateFnsLocalizer, View, Event } from 'react-big-calendar';
import { format } from 'date-fns/format';
import { parse } from 'date-fns/parse';
import { startOfWeek as dateFnsStartOfWeek } from 'date-fns/startOfWeek';
import { getDay } from 'date-fns/getDay';
import { enUS } from 'date-fns/locale/en-US';
import type { Locale } from 'date-fns';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Setup the localizer by providing the functions we imported from date-fns
const locales = {
  'en-US': enUS,
};

// Customize startOfWeek to use Monday as the start day
const startOfWeek = (date: Date, options?: { locale?: Locale, weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 }) => {
    return dateFnsStartOfWeek(date, { weekStartsOn: 1, locale: options?.locale }); // Always set weekStartsOn to 1 (Monday)
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Define a generic event structure that our calendar will use.
// The consuming component will need to map its data to this structure.
export interface CalendarEvent extends Event {
  id: string | number;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: unknown; // Use unknown instead of any
}

interface CalendarViewProps {
  events: CalendarEvent[];
  defaultView?: View;
  views?: View[];
  date?: Date;
  onNavigate?: (newDate: Date, view: View, action: string) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date; slots: Date[] | string[]; action: 'select' | 'click' | 'doubleClick' }) => void;
  onSelectEvent?: (event: CalendarEvent, e: React.SyntheticEvent<HTMLElement>) => void;
  dayPropGetter?: (date: Date) => { style?: React.CSSProperties; className?: string };
  // We might add more props later for customization (e.g., custom components for events/days)
}

const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  defaultView = 'month',
  views = ['month', 'week', 'day'],
  date,
  onNavigate,
  onSelectSlot,
  onSelectEvent,
  dayPropGetter,
}) => {
  const handleSelectSlot = (slotInfo: {
    start: Date;
    end: Date;
    slots: Date[] | string[];
    action: 'select' | 'click' | 'doubleClick';
  }) => {
    // For 'day' clicks, the action is often 'click' on the background
    // or 'select' if dragging. We primarily care about single day clicks.
    if (onSelectSlot && (slotInfo.action === 'click' || slotInfo.action === 'select')) {
        // Check if it spans a single day (or less)
        const startDay = new Date(slotInfo.start.getFullYear(), slotInfo.start.getMonth(), slotInfo.start.getDate());
        const endDay = new Date(slotInfo.end.getFullYear(), slotInfo.end.getMonth(), slotInfo.end.getDate());

        // Adjust end date if the selection ends exactly at midnight of the next day
        if (slotInfo.end.getHours() === 0 && slotInfo.end.getMinutes() === 0 && slotInfo.end.getSeconds() === 0 && slotInfo.end > slotInfo.start) {
            endDay.setDate(endDay.getDate() -1);
        }

        if (startDay.getTime() === endDay.getTime()) {
             // Pass only the start date for a single day click
            onSelectSlot({ ...slotInfo, end: slotInfo.start });
        } else {
            // Optionally handle range selection differently or ignore
            // console.log("Date range selected, not firing single day click.");
        }
    }
  };

  return (
    <div style={{ height: 700 }}> {/* Set a default height */}
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        defaultView={defaultView}
        views={views}
        date={date}
        onNavigate={onNavigate}
        style={{ /* Add any necessary custom styles here */ }}
        selectable={true} // Allows clicking/dragging to select slots
        onSelectSlot={handleSelectSlot} // Use the wrapper for day clicks
        onSelectEvent={onSelectEvent} // Handle clicks directly on events
        dayPropGetter={dayPropGetter}
        // Add other props like eventPropGetter for custom event styling later
      />
    </div>
  );
};

export default CalendarView;