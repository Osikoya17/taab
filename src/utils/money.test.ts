import { formatMoney, MINUS, parseMoneyInput, toInputString, toMinor } from './money';

describe('formatMoney', () => {
  it('formats NGN from kobo', () => {
    expect(formatMoney(1_250_000, 'NGN')).toBe('₦12,500');
    expect(formatMoney(4_825_000, 'NGN')).toBe('₦48,250');
  });

  it('shows the fraction only when non-zero by default', () => {
    expect(formatMoney(1_250_050, 'NGN')).toBe('₦12,500.50');
    expect(formatMoney(5, 'USD')).toBe('$0.05');
  });

  it('supports fixed and hidden fractions', () => {
    expect(formatMoney(1_250_000, 'GBP', { fraction: 'always' })).toBe('£12,500.00');
    expect(formatMoney(1_250_050, 'EUR', { fraction: 'never' })).toBe('€12,501');
    expect(formatMoney(1_250_049, 'EUR', { fraction: 'never' })).toBe('€12,500');
  });

  it('uses a true minus sign and optional plus', () => {
    expect(formatMoney(-820_000, 'NGN')).toBe(`${MINUS}₦8,200`);
    expect(formatMoney(3_245_000, 'NGN', { sign: 'always' })).toBe('+₦32,450');
    expect(formatMoney(-820_000, 'NGN', { sign: 'never' })).toBe('₦8,200');
  });

  it('never signs zero', () => {
    expect(formatMoney(0, 'NGN', { sign: 'always' })).toBe('₦0');
  });

  it('groups large values', () => {
    expect(formatMoney(123_456_789_00, 'USD')).toBe('$123,456,789');
  });
});

describe('parseMoneyInput', () => {
  it('parses whole and fractional input into minor units', () => {
    expect(parseMoneyInput('48000', 'NGN')).toBe(4_800_000);
    expect(parseMoneyInput('12,500.5', 'NGN')).toBe(1_250_050);
    expect(parseMoneyInput('0.07', 'USD')).toBe(7);
    expect(parseMoneyInput('₦ 9,500', 'NGN')).toBe(950_000);
  });

  it('avoids float drift', () => {
    // 0.1 + 0.2 style inputs must be exact.
    expect(parseMoneyInput('0.29', 'USD')).toBe(29);
    expect(parseMoneyInput('1.15', 'USD')).toBe(115);
  });

  it('rejects invalid input', () => {
    for (const input of ['-100', '−100', '+100', 'abc100', '12,50', '1 00', '$100']) expect(parseMoneyInput(input, 'NGN')).toBeNull();
    expect(parseMoneyInput('', 'NGN')).toBeNull();
    expect(parseMoneyInput('.', 'NGN')).toBeNull();
    expect(parseMoneyInput('1.234', 'NGN')).toBeNull();
    expect(parseMoneyInput('abc', 'NGN')).toBeNull();
    expect(parseMoneyInput('1.2.3', 'NGN')).toBeNull();
  });
  it('parses the largest safe amount exactly and rejects overflow', () => {
    expect(parseMoneyInput('90071992547409.91', 'NGN')).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseMoneyInput('90071992547409.92', 'NGN')).toBeNull();
  });
});

describe('minor unit helpers', () => {
  it('converts major to minor', () => {
    expect(toMinor(48_000, 'NGN')).toBe(4_800_000);
  });

  it('round-trips to an editable string', () => {
    expect(toInputString(1_250_050, 'NGN')).toBe('12500.5');
    expect(toInputString(1_250_000, 'NGN')).toBe('12500');
    expect(toInputString(7, 'USD')).toBe('0.07');
  });
});
