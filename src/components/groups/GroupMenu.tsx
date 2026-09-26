import { DoorOpen, FileText, Repeat, UserPlus } from 'lucide-react-native';
import { View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Divider } from '@/components/ui/Divider';
import { ListRow } from '@/components/ui/ListRow';

export type GroupMenuProps = {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  onInvite: () => void;
  onRecurring: () => void;
  onExport: () => void;
  onLeave: () => void;
  exportLocked: boolean;
  recurringLocked: boolean;
};

export function GroupMenu({ visible, onClose, groupName, onInvite, onRecurring, onExport, onLeave, exportLocked, recurringLocked }: GroupMenuProps) {
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title={groupName}>
      <View className="-mx-4">
        <ListRow icon={UserPlus} title="Invite people" onPress={run(onInvite)} />
        <Divider inset={60} />
        <ListRow icon={Repeat} title="Recurring expenses" detail={recurringLocked ? 'taab+' : undefined} onPress={run(onRecurring)} />
        <Divider inset={60} />
        <ListRow icon={FileText} title="Share summary" detail={exportLocked ? 'taab+' : undefined} onPress={run(onExport)} />
        <Divider inset={60} />
        <ListRow icon={DoorOpen} title="Leave taab" destructive showChevron={false} onPress={run(onLeave)} />
      </View>
    </BottomSheet>
  );
}
