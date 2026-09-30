import { ScanLine, TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useColors } from '@/constants/theme';
import type { ScanDraft } from '@/features/billing/types';
import { WARNING_COPY } from '@/features/scans/draft';

/**
 * Sits above a form filled from a scan. It says plainly that the details were
 * read, not verified, and lists what the person should double-check.
 */
export function ScanNotice({ draft }: { draft: ScanDraft }) {
  const colors = useColors();
  return (
    <View className="gap-2 rounded-2xl bg-accent-soft px-4 py-3" accessibilityLiveRegion="polite">
      <View className="flex-row items-center gap-2">
        <ScanLine size={16} color={colors.ink} strokeWidth={2} />
        <Text variant="label">Scanned{draft.source === 'demo' ? ' · demo sample' : ''}</Text>
      </View>
      <Text variant="caption">
        {draft.source === 'demo'
          ? 'Demo mode fills in sample details, not what’s on your photo. Check everything before saving.'
          : 'Read from your photo, not verified. Check every detail before saving.'}
      </Text>
      {draft.warnings.map((w) => (
        <View key={w} className="flex-row items-start gap-2">
          <TriangleAlert size={14} color={colors.negative} strokeWidth={2} style={{ marginTop: 2 }} />
          <Text variant="caption" className="flex-1">
            {WARNING_COPY[w]}
          </Text>
        </View>
      ))}
    </View>
  );
}
