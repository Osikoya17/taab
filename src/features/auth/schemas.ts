import { z } from 'zod';

const email = z.string().trim().min(1, 'Enter your email').email('Check that email address');

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'What should we call you?').max(40, 'Keep it under 40 characters'),
  email,
  password: z.string().min(8, 'Use at least 8 characters'),
});

export const resetRequestSchema = z.object({ email });

export const resetCompleteSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  password: z.string().min(8, 'Use at least 8 characters'),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ResetRequestValues = z.infer<typeof resetRequestSchema>;
export type ResetCompleteValues = z.infer<typeof resetCompleteSchema>;
