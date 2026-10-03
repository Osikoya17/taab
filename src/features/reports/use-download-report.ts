import { useState } from 'react';

import { useGroupReport } from '@/features/packs/queries';
import { haptics } from '@/lib/haptics';
import { toast } from '@/store/toast.store';

import { exportGroupReport } from './export';

/** Builds a taab's trip & event report and shares it (phones) or downloads it (web). */
export function useDownloadGroupReport() {
  const report = useGroupReport();
  const [pending, setPending] = useState(false);

  async function download(groupId: string) {
    if (pending) return;
    setPending(true);
    try {
      const data = await report.mutateAsync(groupId);
      const result = await exportGroupReport(data);
      haptics.success();
      toast.show(result === 'shared' ? 'Report ready' : 'Report downloaded', result === 'saved' ? 'Open it in your browser to print or save as PDF.' : undefined);
    } catch {
      toast.error('Couldn’t make the report', 'Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return { download, pending };
}
