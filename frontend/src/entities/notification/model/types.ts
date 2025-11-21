
export interface ProductNotification {
  id: number;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  created_at: string;
  user_id: number | null;
  repeat_count: number;
  show_count: number;
  user_count?: number;
}

export interface ProductNotificationsResponse {
  success: boolean;
  product_id: number;
  product_name: string;
  notifications: ProductNotification[];
}
