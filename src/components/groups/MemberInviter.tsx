import { Contact } from 'expo-contacts';
import { BookUser, Check, Mail, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Divider } from '@/components/ui/Divider';
import { FormInput } from '@/components/ui/FormInput';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { usePeopleSearch } from '@/features/groups/queries';
import { haptics } from '@/lib/haptics';
import type { Invite } from '@/services/groups.service';
import { toast } from '@/store/toast.store';

export type PendingInvite = Invite & { key: string; label: string; detail?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function inviteKey(invite: Invite) {
  return invite.kind === 'user' ? invite.userId : invite.kind === 'email' ? invite.email.toLowerCase() : invite.phone;
}

export type MemberInviterProps = {
  value: PendingInvite[];
  onChange: (next: PendingInvite[]) => void;
  /** Existing member ids, excluded from suggestions. */
  excludeIds?: string[];
};

/** Add people by taab account, email, or from contacts. */
export function MemberInviter({ value, onChange, excludeIds = [] }: MemberInviterProps) {
  const [query, setQuery] = useState('');
  const people = usePeopleSearch(query);
  const selectedKeys = new Set(value.map((v) => v.key));
  const suggestions = (people.data ?? []).filter((p) => !excludeIds.includes(p.userId)).slice(0, 6);
  const emailCandidate = EMAIL.test(query.trim()) ? query.trim() : null;

  function add(invite: PendingInvite) {
    if (selectedKeys.has(invite.key)) return;
    haptics.selection();
    onChange([...value, invite]);
  }

  function toggleUser(p: { userId: string; name: string; email: string }) {
    const key = p.userId;
    if (selectedKeys.has(key)) onChange(value.filter((v) => v.key !== key));
    else add({ kind: 'user', userId: p.userId, key, label: p.name, detail: 'On taab' });
  }

  function addEmail() {
    if (!emailCandidate) return;
    const invite: Invite = { kind: 'email', email: emailCandidate };
    add({ ...invite, key: inviteKey(invite), label: emailCandidate.split('@')[0], detail: emailCandidate });
    setQuery('');
  }

  async function pickContact() {
    try {
      const contact = await Contact.presentPicker();
      if (!contact) return;
      const [name, phones, emails] = await Promise.all([contact.getFullName(), contact.getPhones(), contact.getEmails()]);
      const email = emails[0]?.address;
      const phone = phones[0]?.number;
      if (email) {
        const invite: Invite = { kind: 'email', email, name };
        add({ ...invite, key: inviteKey(invite), label: name || email, detail: email });
      } else if (phone) {
        const invite: Invite = { kind: 'phone', phone, name: name || phone };
        add({ ...invite, key: inviteKey(invite), label: name || phone, detail: phone });
      } else {
        toast.show('That contact has no phone or email');
      }
    } catch {
      toast.error('Couldn’t open your contacts', 'Check contact permissions in Settings.');
    }
  }

  return (
    <View className="gap-3">
      {value.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {value.map((v) => (
            <View key={v.key} className="h-10 flex-row items-center gap-2 rounded-full border border-line bg-surface pl-1.5 pr-2">
              <Avatar name={v.label} seed={v.key} size={28} />
              <Text variant="label" numberOfLines={1} className="max-w-[140px]">
                {v.label}
              </Text>
              <Pressable hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${v.label}`} onPress={() => onChange(value.filter((x) => x.key !== v.key))}>
                <X size={15} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          <FormInput
            label="Add people"
            hideLabel
            icon={Mail}
            placeholder="Name or email"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="done"
            onSubmitEditing={addEmail}
          />
        </View>
        {Platform.OS !== 'web' ? <IconButton icon={BookUser} size={54} accessibilityLabel="Choose from contacts" onPress={pickContact} radius={18} /> : null}
      </View>

      {emailCandidate ? (
        <PressableScale onPress={addEmail} accessibilityLabel={`Invite ${emailCandidate} by email`} className="flex-row items-center gap-3 rounded-input border border-dashed border-line-strong px-4 py-3">
          <Plus size={18} color={colors.ink} />
          <Text variant="bodyStrong" className="flex-1" numberOfLines={1}>
            Invite {emailCandidate}
          </Text>
        </PressableScale>
      ) : null}

      {suggestions.length > 0 ? (
        <View className="rounded-card border border-line bg-surface px-4">
          {suggestions.map((p, i) => {
            const selected = selectedKeys.has(p.userId);
            return (
              <View key={p.userId}>
                {i > 0 ? <Divider inset={48} /> : null}
                <Pressable
                  onPress={() => toggleUser(p)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${p.name}, on taab`}
                  className="min-h-[56px] flex-row items-center gap-3 py-2">
                  <Avatar name={p.name} seed={p.userId} size={36} />
                  <View className="flex-1">
                    <Text variant="bodyStrong">{p.name}</Text>
                    <Text variant="caption" tone="muted">
                      {p.email}
                    </Text>
                  </View>
                  <View
                    className="h-6 w-6 items-center justify-center rounded-full border"
                    style={{ backgroundColor: selected ? colors.ink : 'transparent', borderColor: selected ? colors.ink : colors.lineStrong }}>
                    {selected ? <Check size={13} color={colors.canvas} strokeWidth={3} /> : null}
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
