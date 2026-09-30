import { connectService } from './api/service';
import type { ActivityEvent } from '@/types/models';

import { read } from './mock/db';
import { groupsForUser } from './mock/ledger';
import { requireSession } from './session';

export type ActivityPage = {
  items: ActivityEvent[];
  /** Pass back as `before` to load the next page; null when there is no more. */
  nextCursor: string | null;
  /** Always false: all history is free. Kept so older app versions keep working. */
  historyLimited: boolean;
};

const PAGE_SIZE = 25;

export const localActivityService = {
  async listActivity({ before, groupId }: { before?: string; groupId?: string } = {}): Promise<ActivityPage> {
    const me = requireSession();
    return read((db) => {
      const groupIds = new Set(groupsForUser(db, me.userId).map((g) => g.id));
      const visible = db.activity
        .filter((a) => groupIds.has(a.groupId) && (!groupId || a.groupId === groupId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

      const [beforeDate, beforeId] = before?.split('|') ?? [];
      const start = beforeDate ? visible.filter((a) => a.createdAt < beforeDate || (a.createdAt === beforeDate && !!beforeId && a.id.localeCompare(beforeId) < 0)) : visible;
      const items = start.slice(0, PAGE_SIZE);
      const hasMore = start.length > PAGE_SIZE;

      return {
        items,
        nextCursor: hasMore ? `${items[items.length - 1].createdAt}|${items[items.length - 1].id}` : null,
        historyLimited: false,
      };
    });
  },
};

export const activityService = connectService('activity', localActivityService);
