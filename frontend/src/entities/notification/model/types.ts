
export interface GameNotification {
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

export interface GameNotificationsResponse {
  success: boolean;
  game_id: number;
  game_name: string;
  notifications: GameNotification[];
}
