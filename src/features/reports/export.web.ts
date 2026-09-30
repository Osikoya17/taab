import type { GroupReport } from './group-report';
import { renderGroupReportHtml } from './render-html';

/**
 * Web: browsers can't share a generated file, so the report downloads as a
 * self-contained page that opens anywhere and prints to PDF.
 */
export async function exportGroupReport(report: GroupReport): Promise<'shared' | 'saved'> {
  const blob = new Blob([renderGroupReportHtml(report)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${report.groupName.replace(/[^\w\- ]+/g, '').trim() || 'taab'} report.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}
