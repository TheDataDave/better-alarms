// Major cities for the world clock, by IANA time zone.
export const CITIES = [
  ['Honolulu', 'United States', 'Pacific/Honolulu'],
  ['Anchorage', 'United States', 'America/Anchorage'],
  ['Los Angeles', 'United States', 'America/Los_Angeles'],
  ['San Francisco', 'United States', 'America/Los_Angeles'],
  ['Seattle', 'United States', 'America/Los_Angeles'],
  ['Las Vegas', 'United States', 'America/Los_Angeles'],
  ['Vancouver', 'Canada', 'America/Vancouver'],
  ['Phoenix', 'United States', 'America/Phoenix'],
  ['Denver', 'United States', 'America/Denver'],
  ['Chicago', 'United States', 'America/Chicago'],
  ['Dallas', 'United States', 'America/Chicago'],
  ['Houston', 'United States', 'America/Chicago'],
  ['Mexico City', 'Mexico', 'America/Mexico_City'],
  ['New York', 'United States', 'America/New_York'],
  ['Washington, D.C.', 'United States', 'America/New_York'],
  ['Miami', 'United States', 'America/New_York'],
  ['Atlanta', 'United States', 'America/New_York'],
  ['Boston', 'United States', 'America/New_York'],
  ['Toronto', 'Canada', 'America/Toronto'],
  ['Halifax', 'Canada', 'America/Halifax'],
  ["St. John's", 'Canada', 'America/St_Johns'],
  ['San Juan', 'Puerto Rico', 'America/Puerto_Rico'],
  ['Bogotá', 'Colombia', 'America/Bogota'],
  ['Lima', 'Peru', 'America/Lima'],
  ['Santiago', 'Chile', 'America/Santiago'],
  ['Buenos Aires', 'Argentina', 'America/Argentina/Buenos_Aires'],
  ['São Paulo', 'Brazil', 'America/Sao_Paulo'],
  ['Reykjavík', 'Iceland', 'Atlantic/Reykjavik'],
  ['London', 'United Kingdom', 'Europe/London'],
  ['Dublin', 'Ireland', 'Europe/Dublin'],
  ['Lisbon', 'Portugal', 'Europe/Lisbon'],
  ['Paris', 'France', 'Europe/Paris'],
  ['Madrid', 'Spain', 'Europe/Madrid'],
  ['Amsterdam', 'Netherlands', 'Europe/Amsterdam'],
  ['Berlin', 'Germany', 'Europe/Berlin'],
  ['Rome', 'Italy', 'Europe/Rome'],
  ['Stockholm', 'Sweden', 'Europe/Stockholm'],
  ['Warsaw', 'Poland', 'Europe/Warsaw'],
  ['Athens', 'Greece', 'Europe/Athens'],
  ['Kyiv', 'Ukraine', 'Europe/Kyiv'],
  ['Istanbul', 'Türkiye', 'Europe/Istanbul'],
  ['Moscow', 'Russia', 'Europe/Moscow'],
  ['Cairo', 'Egypt', 'Africa/Cairo'],
  ['Lagos', 'Nigeria', 'Africa/Lagos'],
  ['Nairobi', 'Kenya', 'Africa/Nairobi'],
  ['Johannesburg', 'South Africa', 'Africa/Johannesburg'],
  ['Dubai', 'United Arab Emirates', 'Asia/Dubai'],
  ['Riyadh', 'Saudi Arabia', 'Asia/Riyadh'],
  ['Tehran', 'Iran', 'Asia/Tehran'],
  ['Karachi', 'Pakistan', 'Asia/Karachi'],
  ['Delhi', 'India', 'Asia/Kolkata'],
  ['Mumbai', 'India', 'Asia/Kolkata'],
  ['Kathmandu', 'Nepal', 'Asia/Kathmandu'],
  ['Dhaka', 'Bangladesh', 'Asia/Dhaka'],
  ['Bangkok', 'Thailand', 'Asia/Bangkok'],
  ['Jakarta', 'Indonesia', 'Asia/Jakarta'],
  ['Singapore', 'Singapore', 'Asia/Singapore'],
  ['Manila', 'Philippines', 'Asia/Manila'],
  ['Hong Kong', 'China', 'Asia/Hong_Kong'],
  ['Beijing', 'China', 'Asia/Shanghai'],
  ['Shanghai', 'China', 'Asia/Shanghai'],
  ['Taipei', 'Taiwan', 'Asia/Taipei'],
  ['Seoul', 'South Korea', 'Asia/Seoul'],
  ['Tokyo', 'Japan', 'Asia/Tokyo'],
  ['Perth', 'Australia', 'Australia/Perth'],
  ['Adelaide', 'Australia', 'Australia/Adelaide'],
  ['Brisbane', 'Australia', 'Australia/Brisbane'],
  ['Sydney', 'Australia', 'Australia/Sydney'],
  ['Melbourne', 'Australia', 'Australia/Melbourne'],
  ['Auckland', 'New Zealand', 'Pacific/Auckland'],
].map(([city, country, tz]) => ({ id: `${city}|${tz}`, city, country, tz }));

// Wall-clock parts of `now` in a time zone.
function partsIn(tz, now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(new Date(now));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), m: get('minute') };
}

/**
 * What a city's clock reads right now, relative to the phone's own zone:
 * { time: '3:05 PM', dayOffset: -1 | 0 | 1, hoursAhead: 6.5 }
 */
export function cityTime(tz, now = Date.now()) {
  const there = partsIn(tz, now);
  const here = new Date(now);
  const thereMs = Date.UTC(there.y, there.mo - 1, there.d, there.h, there.m);
  const hereMs = Date.UTC(here.getFullYear(), here.getMonth(), here.getDate(), here.getHours(), here.getMinutes());
  const dayOffset = Math.round(
    (Date.UTC(there.y, there.mo - 1, there.d) - Date.UTC(here.getFullYear(), here.getMonth(), here.getDate())) / 86400000,
  );
  const h12 = there.h % 12 === 0 ? 12 : there.h % 12;
  return {
    time: `${h12}:${String(there.m).padStart(2, '0')} ${there.h < 12 ? 'AM' : 'PM'}`,
    dayOffset,
    hoursAhead: Math.round((thereMs - hereMs) / 900000) / 4,
  };
}

export function describeOffset({ dayOffset, hoursAhead }) {
  const day = dayOffset === 0 ? 'Today' : dayOffset > 0 ? 'Tomorrow' : 'Yesterday';
  if (hoursAhead === 0) return `${day}, same time`;
  const abs = Math.abs(hoursAhead);
  const amount = Number.isInteger(abs) ? `${abs} hr` : `${abs} hrs`;
  return `${day}, ${amount} ${hoursAhead > 0 ? 'ahead' : 'behind'}`;
}
