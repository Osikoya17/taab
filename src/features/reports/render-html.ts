import { formatMoney } from '@/utils/money';

import type { GroupReport, ReportPayment } from './group-report';

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function day(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * A self-contained, printable page: saved as a PDF on phones and as an HTML
 * file on the web. Everything the viewer entered is escaped.
 */
export function renderGroupReportHtml(report: GroupReport): string {
  const money = (amount: number) => escape(formatMoney(amount, report.currency));
  const rows = (items: string[][]) => items.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
  const paymentRows = (list: ReportPayment[]) => rows(list.map((p) => [escape(day(p.date)), `${escape(p.from)} → ${escape(p.to)}`, `<span class="num">${money(p.amount)}</span>`]));
  const period = report.period ? `${day(report.period.from)} – ${day(report.period.to)}` : 'No expenses yet';

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(report.groupName)} · taab report</title>
<style>
body{font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#111;margin:32px;line-height:1.45;font-size:13px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px;border-bottom:1px solid #D6D6D1;padding-bottom:4px}
.muted{color:#6F6F6B}.num{font-variant-numeric:tabular-nums;white-space:nowrap}.tiles{display:flex;gap:12px;margin-top:16px}
.tile{flex:1;border:1px solid #E7E7E3;border-radius:10px;padding:10px 12px}.tile b{display:block;font-size:18px;margin-top:2px}
table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:6px 8px;border-bottom:1px solid #E7E7E3;vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6F6F6B;background:#F0F0EC}
.pos{color:#2E7A57}.neg{color:#C2543F}.tag{font-size:10px;border:1px solid #C9A15B;color:#7A5A1E;border-radius:99px;padding:0 6px;margin-left:6px}
.note{font-size:11px;color:#6F6F6B;margin-top:6px}
</style></head><body>
<h1>${escape(report.groupName)}</h1>
<div class="muted">${escape(period)} · ${report.totals.expenseCount} expenses · made with taab on ${escape(day(report.generatedAt))}</div>
<div class="tiles">
<div class="tile">Total spent<b class="num">${money(report.totals.spent)}</b></div>
<div class="tile">Per person (average)<b class="num">${money(report.totals.perMember)}</b></div>
<div class="tile">Payments confirmed<b>${report.payments.confirmed.length}</b></div>
</div>

<h2>Who paid and who owes</h2>
<table><tr><th>Member</th><th>Paid</th><th>Their share</th><th>Balance</th></tr>
${rows(report.members.map((m) => [escape(m.name), `<span class="num">${money(m.paid)}</span>`, `<span class="num">${money(m.share)}</span>`,
    `<span class="num ${m.balance > 0 ? 'pos' : m.balance < 0 ? 'neg' : ''}">${m.balance > 0 ? 'gets back ' : m.balance < 0 ? 'owes ' : ''}${money(Math.abs(m.balance))}</span>`]))}
</table>
<div class="note">Balances count confirmed payments only.</div>

<h2>To settle up</h2>
${report.settleUp.length ? `<table>${rows(report.settleUp.map((t) => [`${escape(t.from)} pays ${escape(t.to)}`, `<span class="num">${money(t.amount)}</span>`]))}</table>` : '<p>Everyone is settled.</p>'}

<h2>Spending by category</h2>
<table><tr><th>Category</th><th>Amount</th><th>Share</th></tr>
${rows(report.byCategory.map((c) => [escape(c.label), `<span class="num">${money(c.amount)}</span>`, `${Math.round(c.share * 100)}%`]))}
</table>

<h2>Expenses</h2>
<table><tr><th>Date</th><th>What</th><th>Paid by</th><th>Amount</th></tr>
${rows(report.expenses.map((e) => [escape(day(e.date)), `${escape(e.title)}${e.scanned ? '<span class="tag">Scanned</span>' : ''}<div class="muted">${escape(e.category)}</div>`, escape(e.paidBy), `<span class="num">${money(e.amount)}</span>`]))}
</table>
<div class="note">“Scanned” means the details were read from a receipt photo and checked by the person who saved them. It is not a verification.</div>

<h2>Repayments</h2>
${report.payments.confirmed.length ? `<table><tr><th>Date</th><th>Payment</th><th>Amount</th></tr>${paymentRows(report.payments.confirmed)}</table>` : '<p class="muted">No confirmed repayments yet.</p>'}
${report.payments.waiting.length ? `<h2>Waiting for confirmation</h2><table>${paymentRows(report.payments.waiting)}</table><div class="note">Recorded by the payer but not yet confirmed by the receiver, so not counted in balances.</div>` : ''}
${report.payments.notReceived.length ? `<h2>Marked not received</h2><table>${paymentRows(report.payments.notReceived)}</table><div class="note">The receiver said these didn’t arrive. Not counted in balances.</div>` : ''}
</body></html>`;
}
