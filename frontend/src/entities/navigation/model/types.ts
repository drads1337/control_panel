export interface NavigationItem {
  href: string
  permission?: string
  permissions?: string[]
  permissionPrefix?: string
  permissionPrefixes?: string[]
  requireAll?: boolean
  roles?: string[]
  requireAnyRole?: boolean
}

export interface NavigationConfig {
  success: boolean
  navigation: NavigationItem[]
  role?: string
}
