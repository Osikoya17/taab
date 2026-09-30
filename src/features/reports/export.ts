import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { GroupReport } from './group-report';
import { renderGroupReportHtml } from './render-html';

/** Phones: turns the report into a PDF and opens the share sheet to save or send it. */
export async function exportGroupReport(report: GroupReport): Promise<'shared' | 'saved'> {
  const { uri } = await Print.printToFileAsync({ html: renderGroupReportHtml(report) });
  if (!(await Sharing.isAvailableAsync())) return 'saved';
  await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: `${report.groupName} report` });
  return 'shared';
}
