import { useEffect, useState } from 'react';

import { request } from '@/services/api/client';

/** The API keeps receipt photos out of the ledger and returns them as `/receipts/<id>`. */
export function isStoredReceipt(uri: string | undefined): uri is string {
  return !!uri && uri.startsWith('/receipts/');
}

/**
 * Resolves a receipt reference to something an Image can show. Photos picked
 * on this device (data URIs) render as-is; stored ones are fetched with the
 * signed-in session. Returns undefined while loading or if it can't be read.
 */
export function useReceiptImage(uri: string | undefined): string | undefined {
  const [loaded, setLoaded] = useState<{ ref: string; uri: string } | null>(null);

  useEffect(() => {
    if (!isStoredReceipt(uri)) return;
    let active = true;
    request<{ uri: string }>(uri, { method: 'GET' })
      .then((receipt) => {
        if (active) setLoaded({ ref: uri, uri: receipt.uri });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [uri]);

  if (!isStoredReceipt(uri)) return uri;
  return loaded?.ref === uri ? loaded.uri : undefined;
}
