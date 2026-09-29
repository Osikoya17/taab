import { Image } from 'expo-image';
import { Text as RNText, View } from 'react-native';
import { useColorScheme } from 'nativewind';

import { fonts, useColors } from '@/constants/theme';

/** Quiet, warm tints — avatars should never be the loudest thing on screen. */
const TINTS = {
  light: ['#ECE6DA', '#DFE7E1', '#E5E2EC', '#EFE2DC', '#DEE4EA', '#E9E7DC', '#E3E9E4'],
  // The same hues, dimmed to sit on a dark page.
  dark: ['#302B22', '#23302A', '#2B2934', '#35271F', '#242B32', '#2E2C22', '#26302A'],
};

function tintFor(seed: string, scheme: 'light' | 'dark') {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const tints = TINTS[scheme];
  return tints[hash % tints.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type AvatarProps = {
  name: string;
  uri?: string;
  size?: number;
  /** Seed for the tint; defaults to the name. Use the user id for stability. */
  seed?: string;
  ring?: boolean;
  dimmed?: boolean;
};

export function Avatar({ name, uri, size = 40, seed, ring = false, dimmed = false }: AvatarProps) {
  const colors = useColors();
  const { colorScheme } = useColorScheme();
  const borderWidth = ring ? 2 : 0;
  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tintFor(seed ?? name, colorScheme === 'dark' ? 'dark' : 'light'),
        borderWidth,
        borderColor: colors.canvas,
        opacity: dimmed ? 0.55 : 1,
      }}
      className="items-center justify-center overflow-hidden">
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size - borderWidth * 2, height: size - borderWidth * 2, borderRadius: size / 2 }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={uri}
        />
      ) : (
        <RNText
          allowFontScaling={false}
          style={{ fontFamily: fonts.semibold, fontSize: size * 0.38, color: colors.ink, letterSpacing: -0.3 }}>
          {initials(name)}
        </RNText>
      )}
    </View>
  );
}
