import { connectService } from './api/service';
import { FREE_LIMITS } from '@/features/billing/products';
import type { ActivityEvent } from '@/types/models';

import { read } from './mock/db';
import { groupsForUser, userHasPlus } from './mock/ledger';
import { requireSession } from './session';

export type ActivityPage = {
  items: ActivityEvent[];
  /** Pass back as `before` to load the next page; null when there is no more. */
  nextCursor: string | null;
  /** True when older items exist but are outside the free plan's history window. */
  historyLimited: boolean;
};

const PAGE_SIZE = 25;

export const localActivityService = {
  async listActivity({ before, groupId }: { before?: string; groupId?: string } = {}): Promise<ActivityPage> {
    const me = requireSession();
    return read((db) => {
      const groupIds = new Set(groupsForUser(db, me.userId).map((g) => g.id));
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - FREE_LIMITS.historyMonths);
      const limitHistory = !userHasPlus(db, me.userId);

      const visible = db.activity
        .filter((a) => groupIds.has(a.groupId) && (!groupId || a.groupId === groupId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

      const inWindow = limitHistory ? visible.filter((a) => a.createdAt >= cutoff.toISOString()) : visible;
      const [beforeDate, beforeId] = before?.split('|') ?? [];
      const start = beforeDate ? inWindow.filter((a) => a.createdAt < beforeDate || (a.createdAt === beforeDate && !!beforeId && a.id.localeCompare(beforeId) < 0)) : inWindow;
      const items = start.slice(0, PAGE_SIZE);
      const hasMore = start.length > PAGE_SIZE;

      return {
        items,
        nextCursor: hasMore ? `${items[items.length - 1].createdAt}|${items[items.length - 1].id}` : null,
        historyLimited: !hasMore && inWindow.length < visible.length,
      };
    });
  },
};

export const activityService = connectService('activity', localActivityService);
