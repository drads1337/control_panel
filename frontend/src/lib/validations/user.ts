import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50, 'Username must be at most 50 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be at most 128 characters'),
  first_name: z.string().max(100, 'First name must be at most 100 characters').optional(),
  last_name: z.string().max(100, 'Last name must be at most 100 characters').optional(),
  email: z.union([
    z.string().email('Invalid email format'),
    z.literal(''),
  ]).optional(),
  token_balance: z.number().int().min(0, 'Token balance must be non-negative').default(0),
  work_duration_days: z.number().int().min(1, 'Work duration must be at least 1 day').max(365, 'Work duration must be at most 365 days').default(7),
  selected_products: z.array(z.number().int().positive()).default([]),
  selected_rbac_role: z.number().int().positive().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

