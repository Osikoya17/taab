const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysBetween(iso: string, now: Date) {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY);
}

/** "20 Sep", or "20 Sep 2025" outside the current year. */
export function shortDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const base = `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** Compact age for feeds: "now", "10m", "2h", "Yesterday", "Friday", "20 Sep". */
export function relativeTime(iso: string, now = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < 60_000) return 'now';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m`;
  const days = daysBetween(iso, now);
  if (days === 0) return `${Math.floor(diff / (60 * 60_000))}h`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return WEEKDAYS[new Date(iso).getDay()];
  return shortDate(iso, now);
}

/** Day label for expense rows: "Today", "Yesterday", "Friday", "20 Sep". */
export function dayLabel(iso: string, now = new Date()): string {
  const days = daysBetween(iso, now);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return WEEKDAYS[new Date(iso).getDay()];
  return shortDate(iso, now);
}

/** "Updated 2h ago" style copy. */
export function updatedAgo(iso: string, now = new Date()): string {
  const rel = relativeTime(iso, now);
  if (rel === 'now') return 'Updated just now';
  if (/^\d+[mh]$/.test(rel)) return `Updated ${rel} ago`;
  return `Updated ${rel === 'Yesterday' ? 'yesterday' : rel}`;
}

/**
 * Timeline bucket for the activity feed: Today, Yesterday, Earlier this week,
 * then month names ("September", or "September 2025" in other years).
 */
export function timelineBucket(iso: string, now = new Date()): string {
  const days = daysBetween(iso, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'Earlier this week';
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() ? MONTHS[d.getMonth()] : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function monthYear(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}

/** "Fri, 20 Sep" for date pickers and detail screens. */
export function longDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()].slice(0, 3)}, ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
