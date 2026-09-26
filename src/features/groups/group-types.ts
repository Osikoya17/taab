import { Briefcase, CircleDashed, Heart, House, PartyPopper, Plane, UsersRound, type LucideIcon } from 'lucide-react-native';

import type { GroupType } from '@/types/models';

export const GROUP_TYPES: { value: GroupType; label: string; icon: LucideIcon }[] = [
  { value: 'home', label: 'Home', icon: House },
  { value: 'trip', label: 'Trip', icon: Plane },
  { value: 'friends', label: 'Friends', icon: UsersRound },
  { value: 'couple', label: 'Couple', icon: Heart },
  { value: 'event', label: 'Event', icon: PartyPopper },
  { value: 'work', label: 'Work', icon: Briefcase },
  { value: 'other', label: 'Other', icon: CircleDashed },
];

export function groupTypeMeta(type: GroupType) {
  return GROUP_TYPES.find((t) => t.value === type) ?? GROUP_TYPES[GROUP_TYPES.length - 1];
}
