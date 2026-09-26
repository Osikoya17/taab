import type { ActivityEvent } from '@/types/models';
import { timelineBucket } from '@/utils/dates';

export type TimelineSection = { title: string; data: ActivityEvent[] };

/** Groups newest-first events into Today / Yesterday / Earlier this week / month sections. */
export function toTimelineSections(events: ActivityEvent[], now = new Date()): TimelineSection[] {
  const sections: TimelineSection[] = [];
  for (const event of events) {
    const title = timelineBucket(event.createdAt, now);
    const last = sections[sections.length - 1];
    if (last?.title === title) last.data.push(event);
    else sections.push({ title, data: [event] });
  }
  return sections;
}
