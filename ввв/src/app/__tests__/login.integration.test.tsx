import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginForm } from '../auth/login-form'
import { AuthContext } from '@/contexts/auth-context'

vi.mock('../shared/faulty-terminal', () => ({
  default: () => <div data-testid="faulty-terminal">Terminal</div>
}))

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

describe('Login Integration Test', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockAuthContextValue as any}>
          <BrowserRouter>
            {component}
          </BrowserRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    )
  }

  it('should render login form', () => {
    renderWithProviders(<LoginForm />)

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
  })

  it('should show validation errors for empty form', async () => {
    renderWithProviders(<LoginForm />)

    const form = document.querySelector('form')
    expect(form).toBeTruthy()

    fireEvent.submit(form!)

    await waitFor(() => {

      const usernameError = screen.queryByText('Username is required')

      const passwordError = screen.queryByText('Password is required')

      expect(usernameError || passwordError).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('should submit form with valid credentials', async () => {
    mockLogin.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /login/i })

    await user.type(usernameInput, 'testuser')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('testuser', 'password123')
    })
  })

  it('should display error message on login failure', async () => {
    const errorMessage = 'Invalid credentials'
    mockLogin.mockRejectedValue(new Error(errorMessage))

    const user = userEvent.setup()
    const errorContextValue = { ...mockAuthContextValue, error: errorMessage }
    renderWithProviders(
      <AuthContext.Provider value={errorContextValue as any}>
        <LoginForm />
      </AuthContext.Provider>
    )

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /login/i })

    await user.type(usernameInput, 'testuser')
    await user.type(passwordInput, 'wrongpassword')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })
})
