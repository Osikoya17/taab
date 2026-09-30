import { ScrollView, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { FormInput } from '@/components/ui/FormInput';
import { COMMON_BANKS, cleanAccountNumber, type PayoutFormErrors } from '@/features/payouts/banks';
import type { PayoutAccount } from '@/types/models';

export const EMPTY_PAYOUT: PayoutAccount = { bankName: '', accountNumber: '', accountName: '' };

/** Bank, account number and account name. Quick picks for common banks; any other can be typed. */
export function PayoutForm({ value, onChange, errors = {} }: { value: PayoutAccount; onChange: (next: PayoutAccount) => void; errors?: PayoutFormErrors }) {
  return (
    <View className="gap-4">
      <View className="gap-2">
        <FormInput
          label="Bank"
          placeholder="e.g. GTBank"
          value={value.bankName}
          onChangeText={(bankName) => onChange({ ...value, bankName })}
          error={errors.bankName}
          maxLength={60}
          autoCapitalize="words"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerClassName="gap-2">
          {COMMON_BANKS.map((bank) => (
            <Chip key={bank} label={bank} selected={value.bankName === bank} onPress={() => onChange({ ...value, bankName: bank })} />
          ))}
        </ScrollView>
      </View>
      <FormInput
        label="Account number"
        placeholder="10 digits"
        value={value.accountNumber}
        onChangeText={(text) => onChange({ ...value, accountNumber: cleanAccountNumber(text) })}
        error={errors.accountNumber}
        keyboardType="number-pad"
        maxLength={20}
      />
      <FormInput
        label="Account name"
        placeholder="As your bank shows it"
        value={value.accountName}
        onChangeText={(accountName) => onChange({ ...value, accountName })}
        error={errors.accountName}
        maxLength={80}
        autoCapitalize="words"
        hint="People check this name before they send money."
      />
    </View>
  );
}
