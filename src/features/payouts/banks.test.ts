import { cleanAccountNumber, formatAccountNumber, shouldShowPayoutPrompt, validatePayout } from './banks';

describe('bank details', () => {
  it('keeps digits only and groups a NUBAN for reading', () => {
    expect(cleanAccountNumber('0123 456-789')).toBe('0123456789');
    expect(formatAccountNumber('0123456789')).toBe('0123 456 789');
    expect(formatAccountNumber('12345678')).toBe('12345678');
  });

  it('explains what is missing', () => {
    expect(validatePayout({ bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Ada Obi' })).toEqual({});
    expect(Object.keys(validatePayout({ bankName: '', accountNumber: '12', accountName: '' }))).toEqual(['bankName', 'accountNumber', 'accountName']);
  });

  it('shows the Home card until an account is added, and again two weeks after “Not now”', () => {
    const now = Date.parse('2026-10-15T00:00:00.000Z');
    expect(shouldShowPayoutPrompt(false, null, now)).toBe(true);
    expect(shouldShowPayoutPrompt(true, null, now)).toBe(false);
    expect(shouldShowPayoutPrompt(false, '2026-10-10T00:00:00.000Z', now)).toBe(false);
    expect(shouldShowPayoutPrompt(false, '2026-09-30T00:00:00.000Z', now)).toBe(true);
  });
});
