import { Eye, EyeOff } from 'lucide-react-native';
import { useState, type Ref } from 'react';
import { Pressable, type TextInput } from 'react-native';

import { FormInput, type FormInputProps } from '@/components/ui/FormInput';
import { useColors } from '@/constants/theme';

export function PasswordInput({ ref, ...props }: Omit<FormInputProps, 'secureTextEntry' | 'trailing'> & { ref?: Ref<TextInput> }) {
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  return (
    <FormInput
      ref={ref}
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}>
          {visible ? <EyeOff size={19} color={colors.muted} /> : <Eye size={19} color={colors.muted} />}
        </Pressable>
      }
    />
  );
}
