import { z } from 'zod';

/**
 * Zod схемы для валидации ответов API пользователей
 * Используются для runtime валидации данных от сервера
 */

export const baseEntitySchema = z.object({
  id: z.number().int().positive(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable().optional(),
});

export const rbacRoleSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  description: z.string(),
  assigned_at: z.string(),
});

export const userSchema = baseEntitySchema.extend({
  username: z.string().min(1),
  roles: z.array(z.string()),
  permissions: z.array(z.string()).optional(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email: z.string().email().nullable(),
  avatar: z.string().nullable(),
  expires_at: z.string().nullable(),
  last_login: z.string().nullable(),
  last_ip: z.string().nullable(),
  last_country: z.string().nullable(),
  last_city: z.string().nullable(),
  total_keys_generated: z.number().int().nonnegative(),
  token_balance: z.number().int(),
  project_id: z.number().int().positive().nullable(),
  keys_count: z.number().int().nonnegative(),
  active_keys: z.number().int().nonnegative(),
  referral_code: z.string().nullable(),
  invited_by: z.number().int().positive().nullable(),
  rbac_roles: z.array(rbacRoleSchema).optional(),
});

export const usersResponseSchema = z.object({
  users: z.array(userSchema),
  total: z.number().int().nonnegative(),
  pages: z.number().int().nonnegative(),
  current_page: z.number().int().positive(),
  per_page: z.number().int().positive(),
});

export type UserValidated = z.infer<typeof userSchema>;
export type UsersResponseValidated = z.infer<typeof usersResponseSchema>;
