import { Briefcase, CircleDashed, Heart, House, PartyPopper, Plane, UsersRound, type LucideIcon } from 'lucide-react-native';

import type { Palette } from '@/constants/theme';
import type { GroupType } from '@/types/models';

/** A brand colour and the colour that reads on top of it. */
export type TypeColour = { fill: keyof Palette; on: keyof Palette };

const CYAN: TypeColour = { fill: 'brandCyan', on: 'brandInk' };
const BLUE: TypeColour = { fill: 'brandBlue', on: 'brandPaper' };
const YELLOW: TypeColour = { fill: 'brandYellow', on: 'brandInk' };
const RED: TypeColour = { fill: 'brandRed', on: 'brandPaper' };
const GREEN: TypeColour = { fill: 'brandGreen', on: 'brandPaper' };

export const GROUP_TYPES: { value: GroupType; label: string; icon: LucideIcon; colour?: TypeColour }[] = [
  { value: 'home', label: 'Home', icon: House, colour: CYAN },
  { value: 'trip', label: 'Trip', icon: Plane, colour: BLUE },
  { value: 'friends', label: 'Friends', icon: UsersRound, colour: YELLOW },
  { value: 'couple', label: 'Couple', icon: Heart, colour: RED },
  { value: 'event', label: 'Event', icon: PartyPopper, colour: GREEN },
  { value: 'work', label: 'Work', icon: Briefcase, colour: BLUE },
  { value: 'other', label: 'Other', icon: CircleDashed },
];

export function groupTypeMeta(type: GroupType) {
  return GROUP_TYPES.find((t) => t.value === type) ?? GROUP_TYPES[GROUP_TYPES.length - 1];
}
