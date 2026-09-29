import { Text as RNText, View } from 'react-native';

import { fonts, useColors } from '@/constants/theme';

import { Avatar } from './Avatar';

export type AvatarStackProps = {
  people: { id: string; name: string; avatarUrl?: string }[];
  size?: number;
  max?: number;
};

/** Overlapping avatars with a +N overflow chip. */
export function AvatarStack({ people, size = 28, max = 4 }: AvatarStackProps) {
  const colors = useColors();
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;
  const overlap = size * 0.32;

  return (
    <View
      className="flex-row items-center"
      accessible
      accessibilityLabel={`${people.length} ${people.length === 1 ? 'person' : 'people'}: ${people.map((p) => p.name).join(', ')}`}>
      {visible.map((p, index) => (
        <View key={p.id} style={{ marginLeft: index === 0 ? 0 : -overlap, zIndex: max - index }}>
          <Avatar name={p.name} uri={p.avatarUrl} seed={p.id} size={size} ring />
        </View>
      ))}
      {overflow > 0 ? (
        <View
          style={{
            marginLeft: -overlap,
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: colors.canvas,
            backgroundColor: colors.sunken,
          }}
          className="items-center justify-center">
          <RNText allowFontScaling={false} style={{ fontFamily: fonts.medium, fontSize: size * 0.36, color: colors.muted }}>
            +{overflow}
          </RNText>
        </View>
      ) : null}
    </View>
  );
}
