import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useLoginForm } from '../use-login-form'
import { AuthContext } from '@/contexts/auth-context'
import React from 'react'

// Mock auth context
const mockLogin = vi.fn()
const mockAuthContextValue = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isInitialized: true,
  login: mockLogin,
  logout: vi.fn(),
  register: vi.fn(),
  registerWithInvite: vi.fn(),
  clearError: vi.fn(),
  updateUser: vi.fn(),
}

describe('useLoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider value={mockAuthContextValue as any}>
      {children}
    </AuthContext.Provider>
  )

  it('should initialize with empty form data', () => {
    const { result } = renderHook(() => useLoginForm(), { wrapper })
    
    expect(result.current.formData.username).toBe('')
    expect(result.current.formData.password).toBe('')
    expect(result.current.errors).toEqual({})
  })

  it('should update form data on input change', async () => {
    const { result } = renderHook(() => useLoginForm(), { wrapper })
    
    result.current.handleInputChange('username', 'testuser')
    await waitFor(() => {
      expect(result.current.formData.username).toBe('testuser')
    })
    
    result.current.handleInputChange('password', 'password123')
    await waitFor(() => {
      expect(result.current.formData.password).toBe('password123')
    })
  })

  it('should validate required fields', async () => {
    const { result } = renderHook(() => useLoginForm(), { wrapper })
    
    const form = document.createElement('form')
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
    Object.defineProperty(submitEvent, 'preventDefault', { value: vi.fn() })
    
    result.current.handleSubmit(submitEvent as any)
    
    await waitFor(() => {
      expect(result.current.errors.username).toBe('Username is required')
      expect(result.current.errors.password).toBe('Password is required')
    })
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('should validate password length', async () => {
    const { result } = renderHook(() => useLoginForm(), { wrapper })
    
    result.current.handleInputChange('username', 'testuser')
    await waitFor(() => {
      expect(result.current.formData.username).toBe('testuser')
    })
    
    result.current.handleInputChange('password', 'short')
    await waitFor(() => {
      expect(result.current.formData.password).toBe('short')
    })
    
    const form = document.createElement('form')
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
    Object.defineProperty(submitEvent, 'preventDefault', { value: vi.fn() })
    
    result.current.handleSubmit(submitEvent as any)
    
    await waitFor(() => {
      expect(result.current.errors.password).toBe('Password must be at least 8 characters')
    })
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('should call login on valid form submission', async () => {
    mockLogin.mockResolvedValue(undefined)
    
    const { result } = renderHook(() => useLoginForm(), { wrapper })
    
    result.current.handleInputChange('username', 'testuser')
    result.current.handleInputChange('password', 'password123')
    
    // Wait for state updates
    await waitFor(() => {
      expect(result.current.formData.username).toBe('testuser')
      expect(result.current.formData.password).toBe('password123')
    })
    
    const form = document.createElement('form')
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
    Object.defineProperty(submitEvent, 'preventDefault', { value: vi.fn() })
    
    result.current.handleSubmit(submitEvent as any)
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('testuser', 'password123')
    }, { timeout: 3000 })
  })

  it('should clear field errors when user types', async () => {
    const { result } = renderHook(() => useLoginForm(), { wrapper })
    
    // Trigger validation error
    const form = document.createElement('form')
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
    Object.defineProperty(submitEvent, 'preventDefault', { value: vi.fn() })
    result.current.handleSubmit(submitEvent as any)
    
    await waitFor(() => {
      expect(result.current.errors.username).toBe('Username is required')
    })
    
    // Clear error by typing
    result.current.handleInputChange('username', 'test')
    
    await waitFor(() => {
      expect(result.current.errors.username).toBeUndefined()
    })
  })

  it('should clear all errors', async () => {
    const { result } = renderHook(() => useLoginForm(), { wrapper })
    
    // Trigger validation errors
    const form = document.createElement('form')
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
    Object.defineProperty(submitEvent, 'preventDefault', { value: vi.fn() })
    result.current.handleSubmit(submitEvent as any)
    
    await waitFor(() => {
      expect(Object.keys(result.current.errors).length).toBeGreaterThan(0)
    })
    
    result.current.clearErrors()
    
    await waitFor(() => {
      expect(result.current.errors).toEqual({})
    })
  })
})

