import { usePreferences } from '@/store/preferences.store';
import type { CurrencyCode, MinorUnits } from '@/types/models';
import { formatMoney, type FormatMoneyOptions } from '@/utils/money';

import { useExchangeRates } from './queries';
import { toDisplay } from './rates';

/**
 * The app-wide display currency. `convert` and `format` turn any ledger amount
 * into what the viewer chose; the ledger itself always stays in each taab's
 * own currency.
 */
export function useDisplayCurrency() {
  const display = usePreferences((s) => s.displayCurrency);
  const setDisplay = usePreferences((s) => s.setDisplayCurrency);
  const rates = useExchangeRates(display !== null);

  const convert = (amount: MinorUnits, from: CurrencyCode) => toDisplay(amount, from, display, rates.data);
  const format = (amount: MinorUnits, from: CurrencyCode, options?: FormatMoneyOptions) => {
    const shown = convert(amount, from);
    return formatMoney(shown.amount, shown.currency, options);
  };

  return {
    display,
    setDisplay,
    rates: rates.data,
    /** A display currency is chosen but today's rates couldn't be fetched. */
    ratesUnavailable: display !== null && !rates.data && !rates.isLoading,
    convert,
    format,
  };
}
