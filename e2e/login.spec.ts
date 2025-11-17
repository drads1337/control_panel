import { test, expect } from '@playwright/test'

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display login form', async ({ page }) => {
    await expect(page.getByLabel(/username/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible()
  })

  test('should show validation errors for empty form', async ({ page }) => {
    const loginButton = page.getByRole('button', { name: /login/i })
    await loginButton.click()

    await expect(page.getByText(/username is required/i)).toBeVisible()
    await expect(page.getByText(/password is required/i)).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.getByLabel(/username/i).fill('invaliduser')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /login/i }).click()

    // Wait for error message (adjust selector based on your error display)
    await expect(page.getByText(/invalid|error|credentials/i).first()).toBeVisible({
      timeout: 5000,
    })
  })

  test('should navigate to signup page', async ({ page }) => {
    const signupLink = page.getByRole('link', { name: /sign up|register/i })
    if (await signupLink.isVisible()) {
      await signupLink.click()
      await expect(page).toHaveURL(/.*signup|register.*/i)
    }
  })
})

test.describe('Protected Routes', () => {
  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login.*/i)
  })
})

