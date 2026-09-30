import { connectService } from './api/service';
import { buildGroupReport, type GroupReport } from '@/features/reports/group-report';

import { ServiceError } from './api/errors';
import { read } from './mock/db';
import { requireGroup } from './mock/ledger';
import { requireSession } from './session';

export const localReportsService = {
  /**
   * The polished trip & event report comes with the taab's pack. Every
   * member's own records stay free to view in the app and to share as text.
   */
  async getGroupReport(groupId: string): Promise<GroupReport> {
    const me = requireSession();
    return read((db) => {
      const group = requireGroup(db, groupId, me.userId);
      if (!db.groupPacks[groupId]) throw new ServiceError('forbidden');
      return buildGroupReport(
        group,
        db.expenses.filter((e) => e.groupId === groupId),
        db.settlements.filter((s) => s.groupId === groupId),
      );
    });
  },
};

export const reportsService = connectService('reports', localReportsService);
