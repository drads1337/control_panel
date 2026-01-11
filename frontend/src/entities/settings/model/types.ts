
export interface ProjectSettings {
  security: {
    min_password_length: number
    max_login_attempts: number
    ip_block_duration_minutes: number
    max_sessions_per_user: number
    log_retention_days: number
    security_log_level: string
  }
  security_features: {
    two_factor_auth_required: boolean
    password_complexity_required: boolean
    session_fingerprinting: boolean
    ip_whitelist_enabled: boolean
    ip_whitelist: string
    rate_limiting_enabled: boolean
    rate_limit_requests_per_minute: number
    vpn_blocking_enabled: boolean
    security_logging_enabled: boolean
    suspicious_activity_check_enabled: boolean
    session_limiting_enabled: boolean
    auto_log_cleanup_enabled: boolean
  }
  encryption_keys: {
    aes_key: string
  }
  encryption: {
    encryption_enabled: boolean
    encryption_algorithm: string
    key_rotation_days: number
  }
  offline_auth: {
    offline_auth_enabled: boolean
    offline_ticket_expiration_hours: number

  }
  appearance: Record<string, any>
  project_unique_id?: string
  project_status?: string
  project_is_active?: boolean
  project_subscription_status?: string
  project_days_until_expiry?: number | null
  project_subscription_expires_at?: string | null
}

export interface UpdateSettingsData {
  security?: Partial<ProjectSettings['security']>
  security_features?: Partial<ProjectSettings['security_features']>
  encryption?: Partial<ProjectSettings['encryption']>
  offline_auth?: Partial<ProjectSettings['offline_auth']>
  appearance?: Record<string, any>
}

export interface UpdateKeysData {
  aes_key?: string
}
