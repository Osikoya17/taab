// Prints usage totals from the taab database: counts and sums only, no names or emails.
// Live:  Get-Content scripts/beta-stats.cjs -Raw | railway ssh -- node -
// Local: node scripts/beta-stats.cjs .data/taab.sqlite
const { DatabaseSync } = require('node:sqlite');

const path = process.argv[2] || process.env.DATABASE_PATH || '/data/taab.sqlite';
const database = new DatabaseSync(path, { readOnly: true });
const row = database.prepare("SELECT value FROM state WHERE key = 'taab.mock-db.v1'").get();
database.close();
if (!row) { console.log('No ledger found at', path); process.exit(0); }
const db = JSON.parse(row.value);

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const since = (days) => new Date(now - days * DAY).toISOString();
const money = (items) => {
  const totals = {};
  for (const i of items) totals[i.currency] = (totals[i.currency] || 0) + i.amount;
  return Object.fromEntries(Object.entries(totals).map(([c, minor]) => [c, (minor / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })]));
};
const activeMembers = (g) => g.members.filter((m) => m.status === 'active').length;
const actorsSince = (days) => new Set(db.activity.filter((a) => a.createdAt >= since(days) && !a.actorId.startsWith('deleted')).map((a) => a.actorId)).size;
const daysActive = new Map();
for (const a of db.activity) {
  const set = daysActive.get(a.actorId) || new Set();
  set.add(a.createdAt.slice(0, 10));
  daysActive.set(a.actorId, set);
}
const dates = db.activity.map((a) => a.createdAt).sort();
const byStatus = (s) => db.settlements.filter((p) => (p.status || 'confirmed') === s);

console.log(JSON.stringify({
  accounts: Object.keys(db.profiles).length,
  accountsFinishedSetup: Object.values(db.profiles).filter((p) => p.setupComplete).length,
  taabs: db.groups.length,
  taabsWithTwoOrMoreActiveMembers: db.groups.filter((g) => activeMembers(g) >= 2).length,
  members: { active: db.groups.reduce((n, g) => n + activeMembers(g), 0), invitedNotJoined: db.groups.reduce((n, g) => n + g.members.length - activeMembers(g), 0) },
  invitesAccepted: db.activity.filter((a) => a.type === 'member_joined').length,
  expenses: db.expenses.length,
  expenseValue: money(db.expenses),
  expensesLast7Days: db.expenses.filter((e) => e.createdAt >= since(7)).length,
  receiptPhotos: db.expenses.filter((e) => e.receiptUrl).length,
  recurringBills: db.recurring.length,
  payments: { confirmed: byStatus('confirmed').length, waiting: byStatus('pending').length, declined: byStatus('declined').length },
  paymentValueConfirmed: money(byStatus('confirmed')),
  remindersSent: db.reminders.length,
  activeUsersLast7Days: actorsSince(7),
  activeUsersLast30Days: actorsSince(30),
  usersActiveOnTwoOrMoreDays: [...daysActive.values()].filter((d) => d.size >= 2).length,
  firstActivity: dates[0] || null,
  latestActivity: dates[dates.length - 1] || null,
}, null, 2));
