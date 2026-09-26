import type { UseCase } from '@/types/models';

export const USE_CASES: { value: UseCase; label: string; example: string }[] = [
  { value: 'friends', label: 'Friends', example: 'Dinner at Nok' },
  { value: 'roommates', label: 'Roommates', example: 'Electricity' },
  { value: 'trips', label: 'Trips', example: 'Cabin in Ilashe' },
  { value: 'couples', label: 'Couples', example: 'Groceries' },
  { value: 'family', label: 'Family', example: 'Mum’s birthday gift' },
  { value: 'work', label: 'Work', example: 'Team lunch' },
  { value: 'other', label: 'Other', example: 'Football night' },
];

/** Personalises empty-state copy only. */
export function emptyStateExample(useCase?: UseCase) {
  const match = USE_CASES.find((u) => u.value === useCase);
  return match?.example ?? 'Dinner at Nok';
}

export function suggestedGroupName(useCase?: UseCase) {
  switch (useCase) {
    case 'roommates':
      return 'Flat 12';
    case 'trips':
      return 'Weekend Trip';
    case 'couples':
      return 'Us two';
    case 'family':
      return 'Family';
    case 'work':
      return 'Team lunches';
    default:
      return 'Friday crew';
  }
}
