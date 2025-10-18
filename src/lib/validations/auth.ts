import { z } from 'zod';

// Password validation schema
export const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter pelo menos 8 caracteres')
  .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
  .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
  .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
  .regex(/[^A-Za-z0-9]/, 'Senha deve conter pelo menos um caractere especial');

// Login form schema
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
  password: z
    .string()
    .min(1, 'Senha é obrigatória'),
  remember: z.boolean().optional(),
});

// Signup form schema
export const signupSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(50, 'Nome deve ter no máximo 50 caracteres'),
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
  phone: z
    .string()
    .min(1, 'Telefone é obrigatório')
    .regex(/^[\(\)\d\s\-]+$/, 'Telefone deve conter apenas números, parênteses, espaços e hífens')
    .min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  password: passwordSchema,
  confirmPassword: z.string(),
  acceptedTerms: z
    .boolean()
    .refine(val => val === true, 'Você deve aceitar os Termos de Uso e Política de Privacidade para continuar'),
  marketingConsent: z.boolean().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});

// Password strength checker
export const getPasswordStrength = (password: string): {
  score: number;
  label: string;
  color: string;
} => {
  // Verificar se password é válido
  if (!password || typeof password !== 'string') {
    return {
      score: 0,
      label: 'Digite uma senha',
      color: 'bg-neutral-300'
    };
  }

  let score = 0;

  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const strength = {
    0: { label: 'Muito fraca', color: 'bg-red-500' },
    1: { label: 'Fraca', color: 'bg-red-400' },
    2: { label: 'Razoável', color: 'bg-yellow-500' },
    3: { label: 'Boa', color: 'bg-yellow-400' },
    4: { label: 'Forte', color: 'bg-green-500' },
    5: { label: 'Muito forte', color: 'bg-green-600' },
  };

  return {
    score,
    label: strength[score as keyof typeof strength].label,
    color: strength[score as keyof typeof strength].color,
  };
};

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;