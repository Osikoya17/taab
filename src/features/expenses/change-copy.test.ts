import { describeChange, joinNames, summarizeChanges } from './change-copy';

const names: Record<string, string> = { me: 'you', dami: 'Dami', tolu: 'Tolu', femi: 'Femi' };
const options = { currency: 'NGN' as const, nameOf: (id: string) => names[id] ?? 'Someone' };

describe('edit history copy', () => {
  it('joins names the way people say them', () => {
    expect(joinNames(['Dami'])).toBe('Dami');
    expect(joinNames(['Dami', 'Tolu'])).toBe('Dami and Tolu');
    expect(joinNames(['Dami', 'Tolu', 'Femi'])).toBe('Dami, Tolu and Femi');
  });

  it('gives exact before and after values', () => {
    expect(describeChange({ field: 'amount', from: 800_000, to: 1_200_000 }, options)).toBe('changed the amount from ₦8,000 to ₦12,000');
    expect(describeChange({ field: 'title', from: 'Fuel', to: 'Fuel + snacks' }, options)).toBe('renamed it from “Fuel” to “Fuel + snacks”');
    expect(describeChange({ field: 'paidBy', from: [{ userId: 'dami', amount: 1 }], to: [{ userId: 'me', amount: 1 }] }, options)).toBe('changed who paid to you');
    expect(describeChange({ field: 'category', to: 'transport' }, options)).toBe('changed the category to Transport');
  });

  it('says who joined or left the split', () => {
    const from = [{ userId: 'dami', amount: 500 }, { userId: 'tolu', amount: 500 }];
    const to = [{ userId: 'dami', amount: 500 }, { userId: 'femi', amount: 500 }];
    expect(describeChange({ field: 'split', from, to, fromMethod: 'equal', toMethod: 'equal' }, options)).toBe('added Femi to the split, took Tolu off the split');
    expect(describeChange({ field: 'split', from, to: from, fromMethod: 'equal', toMethod: 'shares' }, options)).toBe('switched to shares');
    expect(describeChange({ field: 'split', from, to: [{ userId: 'dami', amount: 700 }, { userId: 'tolu', amount: 300 }], fromMethod: 'exact', toMethod: 'exact' }, options)).toBe('changed who owes what');
  });

  it('summarises many changes briefly', () => {
    expect(summarizeChanges([])).toBeUndefined();
    expect(summarizeChanges([{ field: 'date', from: '', to: '' }, { field: 'notes', to: 'x' }])).toBe('Changed the date and the notes');
    expect(summarizeChanges([
      { field: 'title', from: 'a', to: 'b' },
      { field: 'date', from: '', to: '' },
      { field: 'notes', to: 'x' },
      { field: 'receipt', change: 'added' },
    ])).toBe('Changed the name, the date and 2 more');
  });
});
