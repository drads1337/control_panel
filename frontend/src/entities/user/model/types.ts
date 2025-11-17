import { BaseEntity, PaginatedResponse } from '@/shared/api'

// User entity types
export interface User extends BaseEntity {
  username: string
  roles: string[]
  permissions?: string[] // Dynamic permissions from RBAC system
  first_name: string | null
  last_name: string | null
  email: string | null
  avatar: string | null
  expires_at: string | null
  last_login: string | null
  last_ip: string | null
  last_country: string | null
  last_city: string | null
  total_keys_generated: number
  token_balance: number
  project_id: number | null
  keys_count: number
  active_keys: number
  referral_code: string | null
  invited_by: number | null
  rbac_roles?: Array<{
    id: number
    name: string
    description: string
    assigned_at: string
  }>
}

export interface UsersResponse extends PaginatedResponse<User> {
  users: User[]
}

export interface CreateUserData {
  username: string
  password: string
  roles?: string[]
  first_name?: string
  last_name?: string
  email?: string
}

export interface UpdateUserData {
  roles?: string[]
  first_name?: string
  last_name?: string
  email?: string
  is_admin?: boolean
}

export interface UserStats {
  total_users: number
  active_users: number
  new_users_today: number
  premium_users: number
}

// Profile types
export interface ProfileData {
  username?: string
  first_name?: string
  last_name?: string
  bio?: string
  email?: string
}

export interface ProfileResponse {
  message: string
  user: {
    id: number
    username: string
    first_name: string | null
    last_name: string | null
    bio: string | null
    email: string | null
  }
}

export interface ChangePasswordData {
  current_password: string
  new_password: string
}

export interface ChangePasswordResponse {
  message: string
}

export interface AvatarUploadResponse {
  message: string
  avatar: string
}

// User Activity types
export interface UserActivity {
  id: number
  action: string
  ip_address: string | null
  country: string | null
  city: string | null
  created_at: string
  details: string | null
  user_agent: string | null
  session_id: string | null
}

export interface UserActivityResponse extends PaginatedResponse<UserActivity> {
  activities: UserActivity[]
}

export interface UserActivityStats {
  total_activities: number
  today_activities: number
  week_activities: number
  month_activities: number
  unique_ips: number
  unique_locations: number
  last_activity: string | null
}

// Invite Code types
export interface InviteCode {
  id?: number
  code: string
  created_at: string
  expires_at: string | null
  project_id: number | null
  is_used?: boolean
  used?: boolean
  used_at?: string | null
  created_by?: number | null
  role?: string
  game_ids?: number[]
}

export interface CreateInviteCodeData {
  code?: string
  expires_in_days?: number
  project_id?: number
  game_ids?: number[]
  rbac_role_ids?: number[]
}

export interface ReferralCode {
  id: number
  code: string
  role: string
  project_id: number
  created_at: string | null
  expires_at: string | null
  used: boolean
  is_expired: boolean
  game_ids: number[]
}

// Project Invite Code types
export interface CreateProjectInviteCodeData {
  expires_in_days?: number
}

export interface ProjectInviteCode {
  id: number
  code: string
  created_at: string | null
  expires_at: string | null
  used: boolean
  is_expired: boolean
}
