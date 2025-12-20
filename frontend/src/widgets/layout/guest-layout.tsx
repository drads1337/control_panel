import React, { Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Spinner } from '@/components/ui/spinner'
import { PageErrorBoundary } from '@/widgets/page-error-boundary'

const LoginPage = React.lazy(() => import("@/pages/auth/login-page"))
const SignUpPage = React.lazy(() => import("@/pages/auth/signup-page"))
const InviteSignUpPage = React.lazy(() => import("@/pages/auth/invite-signup-page"))
const ForgotPasswordPage = React.lazy(() => import("@/pages/auth/forgot-password-page"))
const ResetPasswordPage = React.lazy(() => import("@/pages/auth/reset-password-page"))

const pageVariants = {
  initial: {
    opacity: 0,
    y: 4,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -4,
  },
}

const pageTransition = {
  duration: 0.15,
  ease: [0.4, 0, 0.2, 1] as const,
}

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        transition={pageTransition}
        className="w-full h-full"
      >
        <Routes location={location}>
          <Route path="/login" element={
            <PageErrorBoundary pageName="Login">
              <LoginPage />
            </PageErrorBoundary>
          } />
          <Route path="/signup" element={
            <PageErrorBoundary pageName="Sign Up">
              <SignUpPage />
            </PageErrorBoundary>
          } />
          <Route path="/signup-invite" element={
            <PageErrorBoundary pageName="Invite Sign Up">
              <InviteSignUpPage />
            </PageErrorBoundary>
          } />
          <Route path="/forgot-password" element={
            <PageErrorBoundary pageName="Forgot Password">
              <ForgotPasswordPage />
            </PageErrorBoundary>
          } />
          <Route path="/reset-password" element={
            <PageErrorBoundary pageName="Reset Password">
              <ResetPasswordPage />
            </PageErrorBoundary>
          } />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

export function GuestLayout() {
  return (
    <main className="flex-1 min-h-0 overflow-hidden">
      <Suspense fallback={<Spinner fullscreen size="lg" message="Loading..." />}>
        <AnimatedRoutes />
      </Suspense>
    </main>
  )
}
