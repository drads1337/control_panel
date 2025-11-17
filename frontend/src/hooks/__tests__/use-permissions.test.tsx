import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePermissions } from '../use-permissions'
import { useAuthContext } from '@/contexts/auth-context'

// Mock the auth context
vi.mock('@/contexts/auth-context', () => ({
  useAuthContext: vi.fn()
}))

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return all false when user is not authenticated', () => {
    ;(useAuthContext as any).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isInitialized: true
    })

    const { result } = renderHook(() => usePermissions())

    expect(result.current.hasPermission('test.permission')).toBe(false)
    expect(result.current.hasRole('admin')).toBe(false)
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.isOwner).toBe(false)
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('should return permission checks for authenticated user', () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      permissions: ['users.view', 'users.create'],
      rbac_roles: ['developer'],
      roles: []
    }

    ;(useAuthContext as any).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isInitialized: true
    })

    const { result } = renderHook(() => usePermissions())

    expect(result.current.hasPermission('users.view')).toBe(true)
    expect(result.current.hasPermission('users.create')).toBe(true)
    expect(result.current.hasPermission('users.delete')).toBe(false)
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('should handle multiple permissions with hasAnyPermission', () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      permissions: ['users.view', 'users.create'],
      rbac_roles: [],
      roles: []
    }

    ;(useAuthContext as any).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isInitialized: true
    })

    const { result } = renderHook(() => usePermissions())

    expect(result.current.hasAnyPermission(['users.view', 'users.delete'])).toBe(true)
    expect(result.current.hasAnyPermission(['users.delete', 'users.edit'])).toBe(false)
  })

  it('should handle multiple permissions with hasAllPermissions', () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      permissions: ['users.view', 'users.create'],
      rbac_roles: [],
      roles: []
    }

    ;(useAuthContext as any).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isInitialized: true
    })

    const { result } = renderHook(() => usePermissions())

    expect(result.current.hasAllPermissions(['users.view', 'users.create'])).toBe(true)
    expect(result.current.hasAllPermissions(['users.view', 'users.delete'])).toBe(false)
  })

  it('should return false when user has no permissions', () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      permissions: [],
      rbac_roles: [],
      roles: []
    }

    ;(useAuthContext as any).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isInitialized: true
    })

    const { result } = renderHook(() => usePermissions())

    expect(result.current.hasPermission('users.view')).toBe(false)
    expect(result.current.hasAnyPermission(['users.view'])).toBe(false)
  })

  it('should handle role checks', () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      permissions: ['users.view'],
      rbac_roles: ['developer', 'support'],
      roles: []
    }

    ;(useAuthContext as any).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isInitialized: true
    })

    const { result } = renderHook(() => usePermissions())

    expect(result.current.hasRole('developer')).toBe(true)
    expect(result.current.hasRole('support')).toBe(true)
    expect(result.current.hasRole('admin')).toBe(false)
    expect(result.current.hasAnyRole(['developer', 'admin'])).toBe(true)
  })
})

