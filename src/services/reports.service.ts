import { connectService } from './api/service';
import { buildGroupReport, type GroupReport } from '@/features/reports/group-report';

import { read } from './mock/db';
import { requireGroup } from './mock/ledger';
import { requireSession } from './session';

export const localReportsService = {
  /** The trip & event report: free for every member of the taab. */
  async getGroupReport(groupId: string): Promise<GroupReport> {
    const me = requireSession();
    return read((db) => {
      const group = requireGroup(db, groupId, me.userId);
      return buildGroupReport(
        group,
        db.expenses.filter((e) => e.groupId === groupId),
        db.settlements.filter((s) => s.groupId === groupId),
      );
    });
  },
};

export const reportsService = connectService('reports', localReportsService);
