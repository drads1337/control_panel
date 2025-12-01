import React, { useCallback, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { useLoginForm } from "@/hooks/use-login-form"
import { usePerformanceDetection } from "@/hooks/use-performance-detection"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const FaultyTerminal = React.lazy(() => import("../shared/faulty-terminal"))

function LoginFormComponent({
  className,
  onLoginSuccess,
  ...props
}: React.ComponentProps<"div"> & {
  onLoginSuccess?: () => void
}) {
  const navigate = useNavigate()
  const {
    formData,
    errors,
    isLoading,
    error,
    handleInputChange,
    handleSubmit,
    clearErrors,
  } = useLoginForm()

  const { recommendedSettings } = usePerformanceDetection()

  const handleSignUpClick = useCallback(() => {
    navigate("/signup")
  }, [navigate])

  const handleForgotPassword = useCallback(() => {
    navigate("/forgot-password")
  }, [navigate])

  const handleTermsClick = useCallback(() => {

  }, [])

  const handlePrivacyClick = useCallback(() => {

  }, [])

  return (
    <motion.div 
      className={cn("flex flex-col gap-6", className)} 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
    >
      <Card className="@container/card overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <motion.form 
            className="p-6 md:p-8" 
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="flex flex-col">
              <div className="flex flex-col items-center text-center mb-6">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-muted-foreground text-balance">
                  Login to your Panel account
                </p>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2 mb-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="username">Username or Email</Label>
                </div>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username or email"
                  value={formData.username}
                  onChange={(e) =>
                    handleInputChange("username", e.target.value)
                  }
                  className={errors.username ? "border-red-500" : ""}
                  disabled={isLoading}
                  required
                />
                {errors.username && (
                  <p className="text-sm text-red-500">{errors.username}</p>
                )}
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-primary cursor-pointer border-none bg-transparent p-0 underline underline-offset-4"
                    onClick={handleForgotPassword}
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) =>
                    handleInputChange("password", e.target.value)
                  }
                  className={errors.password ? "border-red-500" : ""}
                  disabled={isLoading}
                  required
                />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password}</p>
                )}
              </div>

              <Button type="submit" className="w-full mb-6" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </Button>

              <div className="text-center text-sm">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="hover:text-primary cursor-pointer border-none bg-transparent p-0 underline underline-offset-4"
                  onClick={handleSignUpClick}
                >
                  Sign up
                </button>
              </div>
            </div>
          </motion.form>

          <div className="bg-muted relative hidden md:block">
            <React.Suspense
              fallback={<div className="bg-muted absolute inset-0" />}
            >
              <FaultyTerminal
                scale={1.5}
                gridMul={[3, 2]}
                digitSize={1.2}
                timeScale={0.4}
                scanlineIntensity={0.4}
                glitchAmount={1.1}
                flickerAmount={0.8}
                noiseAmp={1.2}
                chromaticAberration={0.002}
                dither={0.5}
                curvature={0.15}
                tint="#00ff88"
                mouseReact={true}
                mouseStrength={0.3}
                pageLoadAnimation={true}
                brightness={1.1}
                className="absolute inset-0"
                lowPowerMode={recommendedSettings.lowPowerMode}
                maxFPS={recommendedSettings.maxFPS}
                adaptiveQuality={recommendedSettings.adaptiveQuality}
              />
            </React.Suspense>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export const LoginForm = React.memo(LoginFormComponent)