import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { FormInput } from '@/components/ui/FormInput';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { useAuthActions, useAuthSession } from '@/features/auth/auth-context';
import { useProfile, useUpdateProfile } from '@/features/profile/queries';
import { toast } from '@/store/toast.store';
import { useGoBack } from '@/hooks/use-go-back';

export default function PersonalDetailsScreen() {
  const goBack = useGoBack();
  const { user } = useAuthSession();
  const actions = useAuthActions();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const [name, setName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const value = name ?? profile?.name ?? '';

  async function changePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const url = await actions.updateAvatar({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType });
      await update.mutateAsync({ avatarUrl: url ?? asset.uri });
      toast.success('Photo updated');
    } catch {
      toast.error('Couldn’t update your photo', 'Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    try {
      await update.mutateAsync({ name: value.trim() });
      toast.success('Saved');
      goBack('/profile');
    } catch {
      toast.error('Couldn’t save your details', 'Check your connection and try again.');
    }
  }

  return (
    <Screen
      keyboard
      header={<AppHeader back title="Personal details" />}
      footer={<Button label="Save" onPress={save} loading={update.isPending && !uploading} disabled={value.trim().length === 0 || value.trim() === profile?.name} />}>
      <View className="items-center pt-4">
        <PressableScale onPress={changePhoto} accessibilityLabel="Change profile photo" pressedScale={0.96}>
          <Avatar name={value || user?.email || ''} uri={profile?.avatarUrl ?? user?.imageUrl} seed={user?.id} size={96} />
          <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-canvas bg-ink">
            <Camera size={14} color={colors.canvas} />
          </View>
        </PressableScale>
        <Text variant="caption" tone="muted" className="mt-3">
          {uploading ? 'Uploading…' : 'Tap to change your photo'}
        </Text>
      </View>
      <View className="mt-8 gap-5">
        <FormInput label="Display name" value={value} onChangeText={setName} autoCapitalize="words" maxLength={40} />
        <FormInput label="Email" value={profile?.email ?? user?.email ?? ''} editable={false} hint="Change your email from Manage account." />
      </View>
    </Screen>
  );
}
