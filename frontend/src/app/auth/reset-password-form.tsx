import React, { useCallback, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react"
import { authService } from "@/services/auth-service"
import { usePerformanceDetection } from "@/hooks/use-performance-detection"

const FaultyTerminal = React.lazy(() => import("@/app/shared/faulty-terminal"))

interface ResetPasswordFormProps {
  token: string
  className?: string
}

function ResetPasswordFormComponent({
  token,
  className,
  ...props
}: ResetPasswordFormProps) {
  const navigate = useNavigate()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const isSubmitting = useRef(false)
  const { recommendedSettings } = usePerformanceDetection()

  const handleBackToLogin = useCallback(() => {
    navigate("/login")
  }, [navigate])

  const validatePassword = useCallback((pwd: string): string | null => {
    if (!pwd) {
      return "Password is required"
    }
    if (pwd.length < 8) {
      return "Password must be at least 8 characters long"
    }
    return null
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (isSubmitting.current || isLoading) {
        return
      }

      setError(null)

      const passwordError = validatePassword(password)
      if (passwordError) {
        setError(passwordError)
        return
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match")
        return
      }

      isSubmitting.current = true
      setIsLoading(true)

      try {
        await authService.resetPassword(token, password)
        setIsSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reset password")
      } finally {
        isSubmitting.current = false
        setIsLoading(false)
      }
    },
    [token, password, confirmPassword, isLoading, validatePassword]
  )

  if (isSuccess) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card className="@container/card overflow-hidden p-0">
          <CardContent className="grid p-0 md:grid-cols-2">
            <div className="p-6 md:p-8 flex flex-col gap-6">
              <div className="flex flex-col items-center text-center gap-4">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <h1 className="text-2xl font-bold">Password reset successful</h1>
                <p className="text-muted-foreground text-balance">
                  Your password has been reset successfully. You can now log in with your new password.
                </p>
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={handleBackToLogin}
              >
                Go to Login
              </Button>
            </div>

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

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="@container/card overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to login
              </button>

              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Reset password</h1>
                <p className="text-muted-foreground text-balance">
                  Enter your new password below.
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your new password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError(null)
                  }}
                  className={error ? "border-red-500" : ""}
                  disabled={isLoading}
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters long
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (error) setError(null)
                  }}
                  className={error ? "border-red-500" : ""}
                  disabled={isLoading}
                  required
                  minLength={8}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset password"
                )}
              </Button>
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

export const ResetPasswordForm = React.memo(ResetPasswordFormComponent)

