import * as Calendar from 'expo-calendar';

// Reads the on-device calendar database, which Google Calendar syncs into.
// No Google sign-in needed: whatever accounts are on the phone are visible.

const isHolidayCalendar = (c) => /holiday/i.test(c.title ?? '');

export async function hasCalendarPermission() {
  const { granted } = await Calendar.getCalendarPermissions();
  return granted;
}

export async function requestCalendarPermission() {
  const { granted } = await Calendar.requestCalendarPermissions();
  return granted;
}

export async function listCalendars() {
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  return calendars
    .map((c) => ({
      id: c.id,
      title: c.title,
      account: c.source?.name ?? '',
      color: c.color,
      holiday: isHolidayCalendar(c),
    }))
    .sort((a, b) => a.account.localeCompare(b.account) || a.title.localeCompare(b.title));
}

export async function fetchEvents(from, to) {
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  if (!calendars.length) return [];
  const holidayIds = new Set(calendars.filter(isHolidayCalendar).map((c) => c.id));
  const events = await Calendar.listEvents(calendars, from, to);
  return events.map((e) => ({
    title: e.title ?? '',
    start: new Date(e.startDate).getTime(),
    end: new Date(e.endDate).getTime(),
    allDay: !!e.allDay,
    calendarId: e.calendarId,
    status: e.status,
    holiday: holidayIds.has(e.calendarId),
  }));
}
