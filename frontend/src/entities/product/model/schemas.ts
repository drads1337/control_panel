import { z } from 'zod';

/**
 * Zod схемы для валидации ответов API продуктов
 * Используются для runtime валидации данных от сервера
 */

export const baseEntitySchema = z.object({
  id: z.number().int().positive(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable().optional(),
});

export const productSchema = baseEntitySchema.extend({
  unique_id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  status: z.string(),
  is_multi_app: z.boolean(),
  version: z.string(),
  downloads: z.number().int().nonnegative(),
  active_users: z.number().int().nonnegative(),
  logo: z.string().optional(),
  banner: z.string().optional(),
  backgrounds: z.any().optional(),
  file: z.string().optional(),
  changelog: z.string().optional(),
  notifications: z.string().optional(),
  prices: z.any().optional(),
  activeUsers: z.number().int().nonnegative().optional(),
  lastUpdate: z.string().optional(),
  custom_key_prefix: z.string().optional(),
  key_prefix_format: z.string().optional(),
  login_type: z.enum(['license_generation', 'classic_login']).optional(),
  invite_code_required: z.boolean().optional(),
  agent: z.any().optional(),
});

export const productsResponseSchema = z.object({
  success: z.boolean(),
  products: z.array(productSchema),
  total_count: z.number().int().nonnegative(),
  filter_type: z.string(),
});

export type ProductValidated = z.infer<typeof productSchema>;
export type ProductsResponseValidated = z.infer<typeof productsResponseSchema>;
