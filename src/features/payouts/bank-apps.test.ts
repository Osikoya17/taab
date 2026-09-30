import { BANK_APPS, rankBankApps, sameBank, type InstalledBankApp } from './bank-apps';
import { COMMON_BANKS } from './banks';

const installed = (id: string): InstalledBankApp => {
  const app = BANK_APPS.find((a) => a.id === id)!;
  return { ...app, packageName: app.android[0] };
};

describe('bank apps', () => {
  it('matches bank names loosely', () => {
    expect(sameBank('Zenith Bank', 'zenith')).toBe(true);
    expect(sameBank('ZENITH BANK PLC', 'Zenith Bank')).toBe(true);
    expect(sameBank('GTBank', 'Access Bank')).toBe(false);
    expect(sameBank(undefined, 'GTBank')).toBe(false);
  });

  it('puts your bank first, then theirs, then the rest in list order', () => {
    const ranked = rankBankApps([installed('opay'), installed('kuda'), installed('gtbank'), installed('zenith')], { payer: 'Zenith Bank', payee: 'Kuda' });
    expect(ranked.map((a) => [a.id, a.tag])).toEqual([
      ['zenith', 'yours'],
      ['kuda', 'theirs'],
      ['opay', undefined],
      ['gtbank', undefined],
    ]);
  });

  it('has an app for every quick-pick bank, with unique package names', () => {
    for (const bank of COMMON_BANKS) expect(BANK_APPS.some((app) => sameBank(app.bank, bank))).toBe(true);
    const packages = BANK_APPS.flatMap((app) => app.android);
    expect(new Set(packages).size).toBe(packages.length);
  });
});
