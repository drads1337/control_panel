import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AnimatedPage } from '@/app/shared/page-transition'
import { Spinner } from '@/components/ui/spinner'

const LoginPage = React.lazy(() => import('@/app/auth/login-page'))
const SignUpPage = React.lazy(() => import('@/app/auth/signup-page'))

export function GuestLayout() {
  return (
    <main className="flex-1 min-h-0 overflow-hidden">
      <AnimatedPage>
        <Suspense fallback={<Spinner fullscreen size="lg" message="Loading..." />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AnimatedPage>
    </main>
  )
}
