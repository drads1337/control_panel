import { z } from 'zod';

export const productSchema = z.object({
  product: z.string(),
  keys: z.number(),
});

export const userSchema = z.object({
  username: z.string(),
  activities: z.number(),
});

export const announcementSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  created_at: z.string(),
});

export const schema = z.object({
  id: z.number(),
  header: z.string(),
  type: z.string(),
  status: z.string(),
  target: z.string(),
  limit: z.string(),
  reviewer: z.string(),
});

export type ProductData = z.infer<typeof productSchema>;
export type UserData = z.infer<typeof userSchema>;
export type AnnouncementData = z.infer<typeof announcementSchema>;
export type TableData = z.infer<typeof schema>;