import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { cx } from '@/utils/cx';

const VARIANTS = {
  display: 'font-geist-semibold text-[44px] leading-[50px] tracking-[-1.6px]',
  title: 'font-geist-semibold text-[28px] leading-[34px] tracking-[-0.8px]',
  heading: 'font-geist-semibold text-[20px] leading-[26px] tracking-[-0.4px]',
  subheading: 'font-geist-medium text-[17px] leading-[22px] tracking-[-0.2px]',
  body: 'font-geist text-[16px] leading-[22px] tracking-[-0.1px]',
  bodyStrong: 'font-geist-medium text-[16px] leading-[22px] tracking-[-0.1px]',
  label: 'font-geist-medium text-[14px] leading-[19px]',
  caption: 'font-geist text-[13px] leading-[18px]',
  micro: 'font-geist-medium text-[12px] leading-[16px] tracking-[0.1px]',
} as const;

const TONES = {
  ink: 'text-ink',
  muted: 'text-muted',
  faint: 'text-faint',
  positive: 'text-positive',
  negative: 'text-negative',
  inverse: 'text-canvas',
} as const;

export type TextVariant = keyof typeof VARIANTS;
export type TextTone = keyof typeof TONES;

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  className?: string;
};

/**
 * All copy goes through this component so type stays consistent. Font scaling
 * is capped rather than disabled, so Dynamic Type works without breaking layout.
 */
export function Text({ variant = 'body', tone = 'ink', className, maxFontSizeMultiplier, ...props }: TextProps) {
  const cap = maxFontSizeMultiplier ?? (variant === 'display' || variant === 'title' ? 1.2 : 1.4);
  return <RNText maxFontSizeMultiplier={cap} className={cx(VARIANTS[variant], TONES[tone], className)} {...props} />;
}
