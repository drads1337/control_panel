// API Types based on backend schemas

export interface UserBase {
  email: string;
  first_name: string;
  last_name: string;
}

export interface UserCreate extends UserBase {
  password: string;
  confirm_password: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface UserResponse extends UserBase {
  id: number;
  is_active: boolean;
  created_at: string; // ISO datetime string
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface ApiErrorResponse {
  detail?: string;
  message?: string;
}

