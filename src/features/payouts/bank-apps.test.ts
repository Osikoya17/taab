import { BANK_APPS, iosBankChoices, rankBankApps, sameBank, type InstalledBankApp } from './bank-apps';
import { COMMON_BANKS } from './banks';

const installed = (id: string): InstalledBankApp => {
  const app = BANK_APPS.find((a) => a.id === id)!;
  return { ...app, target: app.android[0] };
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

  it('on iPhone opens the universal link when there is one, otherwise the App Store page', () => {
    const choices = iosBankChoices(BANK_APPS, { '1467373738': 'https://icon/kuda.png' });
    const kuda = choices.find((c) => c.id === 'kuda')!;
    const gtbank = choices.find((c) => c.id === 'gtbank')!;
    expect([kuda.target, kuda.via, kuda.icon]).toEqual(['https://kuda.com/', 'app', 'https://icon/kuda.png']);
    expect([gtbank.target, gtbank.via, gtbank.icon]).toEqual(['itms-apps://apps.apple.com/app/id1227647130', 'store', undefined]);
    expect(choices).toHaveLength(BANK_APPS.length);
  });

  it('has an App Store ID for every app, and only https links', () => {
    for (const app of BANK_APPS) {
      expect(app.ios.appStoreId).toMatch(/^\d{6,12}$/);
      if (app.ios.link) expect(app.ios.link).toMatch(/^https:\/\//);
    }
  });
});
