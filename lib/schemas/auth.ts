import { z } from 'zod'

export const roleSchema = z.enum(['USER', 'ADMIN'])

const emailSchema = z
  .string()
  .email('Enter a valid email address')
  .transform((value) => value.toLowerCase())

const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use at most 72 characters')

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80),
  email: emailSchema,
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
})

export const sessionUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  name: z.string().min(1),
  role: roleSchema,
})

export type Role = z.infer<typeof roleSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type SessionUser = z.infer<typeof sessionUserSchema>
