import React, { useCallback, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react"
import { authService } from "@/lib/api/auth-service"
import { usePerformanceDetection } from "@/lib/hooks"

const FaultyTerminal = React.lazy(() => import("@/components/shared/faulty-terminal"))

interface ForgotPasswordFormProps {
  className?: string
}

function ForgotPasswordFormComponent({
  className,
  ...props
}: ForgotPasswordFormProps) {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const isSubmitting = useRef(false)
  const { recommendedSettings } = usePerformanceDetection()

  const handleBackToLogin = useCallback(() => {
    navigate("/login")
  }, [navigate])

  const validateEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (isSubmitting.current || isLoading) {
        return
      }

      setError(null)

      if (!email.trim()) {
        setError("Email is required")
        return
      }

      if (!validateEmail(email)) {
        setError("Please enter a valid email address")
        return
      }

      isSubmitting.current = true
      setIsLoading(true)

      try {
        await authService.forgotPassword(email.trim().toLowerCase())
        setIsSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send reset email")
      } finally {
        isSubmitting.current = false
        setIsLoading(false)
      }
    },
    [email, isLoading, validateEmail]
  )

  if (isSuccess) {
    return (
      <motion.div 
        className={cn("flex flex-col gap-6", className)} 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        {...props}
      >
        <Card className="@container/card overflow-hidden p-0">
          <CardContent className="grid p-0 md:grid-cols-2">
            <motion.div 
              className="p-6 md:p-8 flex flex-col gap-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            >
              <button
                type="button"
                onClick={handleBackToLogin}
                className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to login
              </button>

              <div className="flex flex-col items-center text-center gap-4">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <h1 className="text-2xl font-bold">Check your email</h1>
                <p className="text-muted-foreground text-balance">
                  If an account with that email exists, we&apos;ve sent you a password reset link.
                </p>
                <p className="text-sm text-muted-foreground">
                  Please check your inbox and follow the instructions to reset your password.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleBackToLogin}
              >
                Back to Login
              </Button>
            </motion.div>

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

  return (
    <motion.div 
      className={cn("flex flex-col gap-6", className)} 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    >
      <Card className="@container/card overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <motion.form 
            className="p-6 md:p-8" 
            onSubmit={handleSubmit}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          >
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
                <h1 className="text-2xl font-bold">Forgot password?</h1>
                <p className="text-muted-foreground text-balance">
                  Enter your email address and we&apos;ll send you a link to reset your password.
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (error) setError(null)
                  }}
                  className={error ? "border-red-500" : ""}
                  disabled={isLoading}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>
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

export const ForgotPasswordForm = React.memo(ForgotPasswordFormComponent)

