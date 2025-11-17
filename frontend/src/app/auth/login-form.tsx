import React, { useCallback, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { cn } from "@/lib/utils"
import { useLoginForm } from "@/hooks/use-login-form"
import { usePerformanceDetection } from "@/hooks/use-performance-detection"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Lazy load heavy FaultyTerminal component to improve initial load time
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
    // TODO: Implement forgot password functionality
    console.log("Forgot password clicked")
  }, [])

  const handleTermsClick = useCallback(() => {
    // TODO: Navigate to Terms of Service
    console.log("Terms of Service clicked")
  }, [])

  const handlePrivacyClick = useCallback(() => {
    // TODO: Navigate to Privacy Policy
    console.log("Privacy Policy clicked")
  }, [])

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="@container/card overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-muted-foreground text-balance">
                  Login to your Panel account
                </p>
              </div>

              {/* General error */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Username or Email</Label>
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

              <div className="space-y-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
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

              <Button type="submit" className="w-full" disabled={isLoading}>
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
          </form>

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
    </div>
  )
}

// Memoize component to prevent unnecessary re-renders
export const LoginForm = React.memo(LoginFormComponent)
