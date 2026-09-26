import { Check } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import type { GroupMember } from '@/types/models';

function Participant({ member, label, selected, onToggle }: { member: GroupMember; label: string; selected: boolean; onToggle: () => void }) {
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(selected ? 1 : 0, { duration: 180 }));
  }, [selected, progress]);

  const avatarStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + progress.get() * 0.55,
    transform: [{ scale: 0.92 + progress.get() * 0.08 }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: 0.6 + progress.get() * 0.4 }],
  }));

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      className="w-[68px] items-center gap-1.5 py-1">
      <View>
        <Animated.View style={avatarStyle}>
          <Avatar name={member.name} uri={member.avatarUrl} seed={member.userId} size={48} />
        </Animated.View>
        <Animated.View
          style={[
            {
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: colors.ink,
              borderWidth: 2,
              borderColor: colors.canvas,
              alignItems: 'center',
              justifyContent: 'center',
            },
            checkStyle,
          ]}>
          <Check size={11} color={colors.canvas} strokeWidth={3} />
        </Animated.View>
      </View>
      <Text variant="caption" tone={selected ? 'ink' : 'faint'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export type ParticipantSelectorProps = {
  members: GroupMember[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  meId: string;
};

/** Avatar grid for choosing who's in on an expense. Everyone starts selected. */
export function ParticipantSelector({ members, selectedIds, onChange, meId }: ParticipantSelectorProps) {
  const allSelected = selectedIds.length === members.length;

  function toggle(id: string) {
    haptics.selection();
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : members.map((m) => m.userId).filter((m) => m === id || selectedIds.includes(m)));
  }

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Text variant="label" tone="muted">
          Split between
        </Text>
        <Pressable
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={allSelected ? 'Clear everyone' : 'Select everyone'}
          onPress={() => onChange(allSelected ? [meId] : members.map((m) => m.userId))}>
          <Text variant="label">{allSelected ? 'Just me' : 'Everyone'}</Text>
        </Pressable>
      </View>
      <View className="flex-row flex-wrap">
        {members.map((m) => (
          <Participant
            key={m.userId}
            member={m}
            label={m.userId === meId ? 'You' : m.name}
            selected={selectedIds.includes(m.userId)}
            onToggle={() => toggle(m.userId)}
          />
        ))}
      </View>
    </View>
  );
}
