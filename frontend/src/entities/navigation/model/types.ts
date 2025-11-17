export interface NavigationItem {
  href: string
  permission?: string
  permissions?: string[]
  permissionPrefix?: string // Check if user has any permission starting with this prefix
  permissionPrefixes?: string[] // Check if user has any permission starting with any of these prefixes
  requireAll?: boolean
  roles?: string[]
  requireAnyRole?: boolean
}

export interface NavigationConfig {
  success: boolean
  navigation: NavigationItem[]
  role?: string
}

